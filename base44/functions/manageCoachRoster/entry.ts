import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// MANAGE_COACH_ROSTER_V1 — lets a coach manage their own team's roster while
// the editing window is open, and mark the roster as final.
//
// Actions:
//   'save'     — full-roster save (create/update players, delete removed ones)
//   'markDone' — coach confirms the roster is final; locks coach editing for
//                this team and emails the league admin(s)
//   'remind'   — ROSTER_REMIND_V1: a league admin nudges the coach of a team
//                that has not finished its roster. Admin-only, changes nothing,
//                and is handled before the coach checks below.
//
// The editing window is OPEN only when ALL of these are true:
//   1. The league is not manually locked (RosterSettings.locked !== true)
//   2. The due date has not passed (RosterSettings.due_date empty or in future)
//   3. The team has not marked its roster done (no TeamRosterStatus with done)
//   4. The team has no completed or in-progress games (protects stat data)
// Every write re-checks the window server-side. Coaches cannot write Player
// records directly (RLS locks them to admins) — this function applies changes
// with the service role after the checks pass.

// ROSTER_REMIND_V1 — the role a user effectively holds inside one league: the
// per-league entry wins, otherwise their global type. Same helper, same rules,
// as manageVideoAdmins and useEffectiveRole on the frontend.
function roleInLeague(user, leagueId) {
  if (!user) return null;
  const assigned = Array.isArray(user.assigned_league_ids) ? user.assigned_league_ids : [];
  const map = (user.league_role_map && typeof user.league_role_map === 'object') ? user.league_role_map : {};
  if (map[leagueId]) return map[leagueId];
  if (!assigned.includes(leagueId)) return null;
  return user.user_type || 'viewer';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Not signed in' }, { status: 401 });
    }

    const { action, leagueId, teamId, roster, removedIds, deadlineText } = await req.json();
    if (!action || !leagueId || !teamId) {
      return Response.json({ error: 'action, leagueId, and teamId are required' }, { status: 400 });
    }

    // =================================================================
    // ACTION: remind — ROSTER_REMIND_V1
    // =================================================================
    // The organiser chasing a coach who has not finished their roster. This is
    // an ADMIN action, so it is answered here, BEFORE the coach authorisation
    // and editing-window checks below — those exist for 'save' and 'markDone'
    // and would reject an admin outright. It writes nothing to the roster:
    // one email to the coach, one RosterAuditLog row so the organiser can see
    // who has already been chased.
    if (action === 'remind') {
      const callerRole = roleInLeague(user, leagueId);
      if (user.user_type !== 'app_admin' && callerRole !== 'league_admin') {
        return Response.json({ error: 'Only a league admin can send a roster reminder.' }, { status: 403 });
      }

      let team = null;
      try { team = await base44.asServiceRole.entities.Team.get(teamId); } catch (_e) { team = null; }
      if (!team || team.league_id !== leagueId) {
        return Response.json({ error: 'That team is not part of this league.' }, { status: 400 });
      }

      // The coach of this team, from their per-league identity row.
      let coachUser = null;
      try {
        const coachRows = await base44.asServiceRole.entities.UserLeagueIdentity.filter({
          league_id: leagueId,
          team_id: teamId,
          role: 'coach',
        });
        for (const row of (coachRows || [])) {
          if (!row || !row.user_id) continue;
          try {
            const u = await base44.asServiceRole.entities.User.get(row.user_id);
            if (u && u.email) { coachUser = u; break; }
          } catch (_e) { /* try the next identity row */ }
        }
      } catch (_e) { /* handled by the guard below */ }
      if (!coachUser) {
        return Response.json({ error: 'No coach is linked to this team yet, so there is nobody to remind.' }, { status: 400 });
      }

      const teamName = team.name || 'your team';
      const coachName = coachUser.full_name || coachUser.email;
      // The deadline is formatted by the caller in the organiser's own time zone;
      // tags are stripped because it lands in an HTML email body.
      const dueText = String(deadlineText || '').replace(/[<>]/g, '').slice(0, 60);
      const organiser = user.full_name || user.email || 'Your league organizer';

      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: coachUser.email,
          subject: 'Roster reminder: ' + teamName,
          body: '<h2>Your roster is still open</h2>' +
            '<p>Hi ' + coachName + ',</p>' +
            '<p><strong>' + organiser + '</strong> is waiting on the roster for <strong>' + teamName + '</strong>.</p>' +
            (dueText ? '<p><strong>Roster deadline: ' + dueText + '.</strong></p>' : '') +
            '<p>Open <strong>My Roster</strong> in Courtside by AI, add your players, and mark the roster final when it is complete.</p>' +
            '<p style="color:#888">Courtside by AI &middot; Numbers Don\'t Lie</p>',
        });
      } catch (e) {
        console.error('Roster reminder email failed for', coachUser.email, e);
        return Response.json({ error: 'The reminder email could not be sent. Please try again.' }, { status: 502 });
      }

      const remindedAt = new Date().toISOString();
      try {
        await base44.asServiceRole.entities.RosterAuditLog.create({
          league_id: leagueId,
          team_id: teamId,
          team_name: teamName,
          action: 'roster_reminded',
          performed_by: user.email || '',
          performed_by_name: user.full_name || user.email || '',
          performed_role: user.user_type || '',
          performed_at: remindedAt,
          details: ['Reminder emailed to ' + coachName],
        });
      } catch (e) {
        console.error('Roster reminder audit log failed:', e);
      }

      return Response.json({ success: true, sent_to: coachUser.email, coach_name: coachName, reminded_at: remindedAt });
    }

    // --- Who is allowed: the coach linked to this team, or the app admin ---
    const isAppAdmin = user.user_type === 'app_admin';
    let isTeamCoach = false;
    const coachPairs = Array.isArray(user.league_team_pairs) ? user.league_team_pairs : [];
    const pairMatchesTeam = coachPairs.some(p => p && p.league_id === leagueId && p.team_id === teamId);
    if (user.user_type === 'coach') {
      if (pairMatchesTeam) {
        isTeamCoach = true;
      } else {
        const identities = await base44.asServiceRole.entities.UserLeagueIdentity.filter({
          user_id: user.id,
          league_id: leagueId,
          role: 'coach'
        });
        if (identities.some(i => i.team_id === teamId)) isTeamCoach = true;
      }
    } else if (!isAppAdmin) {
      // ADMIN_COACH_AUTH_V1: a user whose global type is not "coach" (e.g. a league admin
      // who also coaches a team) may still edit this roster, but ONLY if they hold a
      // verified coach identity in this exact league AND are linked to this exact team.
      // Players can never pass this check because their identity role is "player".
      const identities = await base44.asServiceRole.entities.UserLeagueIdentity.filter({
        user_id: user.id,
        league_id: leagueId,
        role: 'coach'
      });
      if (identities.length > 0 && (pairMatchesTeam || identities.some(i => i.team_id === teamId))) {
        isTeamCoach = true;
      }
    }
    if (!isAppAdmin && !isTeamCoach) {
      return Response.json({ error: 'Your account is not linked to this team yet. Ask your league admin to link you.' }, { status: 403 });
    }

    // --- Window checks (all must pass) ---
    const settingsList = await base44.asServiceRole.entities.RosterSettings.filter({ league_id: leagueId });
    const settings = settingsList[0] || null;
    if (settings && settings.locked === true) {
      return Response.json({ error: 'Roster editing has been closed by your league admin.' }, { status: 400 });
    }
    if (!settings || !settings.due_date) {
      return Response.json({ error: 'Roster editing is not open yet. Ask your league admin to set a roster deadline.' }, { status: 400 });
    }

    // ROSTER_REOPEN_V1 — the team status must be read BEFORE the deadline and
    // first-game checks, because an admin reopening a single team is exactly the
    // override for both. It used to be read afterwards, which is why reopening a
    // team after the deadline did nothing at all.
    const statusList = await base44.asServiceRole.entities.TeamRosterStatus.filter({ team_id: teamId });
    const teamStatus = statusList[0] || null;
    if (teamStatus && teamStatus.done === true) {
      return Response.json({ error: 'Your roster is already marked as final. Contact your league admin to reopen editing.' }, { status: 400 });
    }

    // ROSTER_REOPEN_V1 — "reopened" means an admin cleared done and stamped
    // reopened_at, and that stamp is newer than the last time this coach marked
    // the roster final. The league-wide locked flag above still wins over this.
    const reopenedAt = teamStatus && teamStatus.reopened_at ? new Date(teamStatus.reopened_at) : null;
    const doneAt = teamStatus && teamStatus.done_at ? new Date(teamStatus.done_at) : null;
    const isReopened = !!(
      reopenedAt &&
      !isNaN(reopenedAt.getTime()) &&
      (!doneAt || isNaN(doneAt.getTime()) || reopenedAt > doneAt)
    );

    if (!isReopened && new Date() > new Date(settings.due_date)) {
      return Response.json({ error: 'The roster deadline has passed. Contact your league admin for changes.' }, { status: 400 });
    }

    const leagueGames = await base44.asServiceRole.entities.Game.filter({ league_id: leagueId });
    const teamHasPlayed = leagueGames.some(g =>
      (g.status === 'completed' || g.status === 'in_progress') &&
      (g.home_team_id === teamId || g.away_team_id === teamId)
    );
    if (teamHasPlayed && !isReopened) {
      return Response.json({ error: 'Roster editing is locked after your first game. Contact your league admin for corrections.' }, { status: 400 });
    }

    // ROSTER_REOPEN_V1 — a reopened team that has already played is a mid-season
    // change. The client uses this to warn the coach. Deleting a player who
    // already has recorded stats stays blocked by the existing check below.
    const reopenWarning = isReopened && teamHasPlayed;

    // =================================================================
    // ACTION: save — full-roster save
    // =================================================================
    if (action === 'save') {
      const rows = Array.isArray(roster) ? roster : [];
      const toDelete = Array.isArray(removedIds) ? removedIds : [];

      // Validate rows: every kept row needs a name and a valid jersey number
      const cleaned = [];
      for (const row of rows) {
        const name = String(row.name || '').trim();
        const jerseyStr = String(row.jersey_number ?? '').trim();
        if (name === '' && jerseyStr === '') continue;
        if (name === '') {
          return Response.json({ error: 'Every player needs a name.' }, { status: 400 });
        }
        const jn = parseInt(jerseyStr, 10);
        if (isNaN(jn)) {
          return Response.json({ error: 'Player "' + name + '" needs a jersey number.' }, { status: 400 });
        }
        cleaned.push({ id: row.id || null, name, jersey_number: jn, position: row.position || 'PG' });
      }

      // Duplicate jersey check (same rule as JERSEY_DEDUPE_V1: #7 = #07)
      const counts = {};
      cleaned.forEach(r => { counts[r.jersey_number] = (counts[r.jersey_number] || 0) + 1; });
      const clashes = Object.keys(counts).filter(k => counts[k] > 1).sort((a, b) => a - b).map(n => '#' + n);
      if (clashes.length > 0) {
        return Response.json({ error: 'Two players share the same number: ' + clashes.join(', ') + '. Make each number unique, then save.' }, { status: 400 });
      }

      // Existing roster, for sanity checks
      const existing = await base44.asServiceRole.entities.Player.filter({ team_id: teamId });
      const existingIds = new Set(existing.map(p => p.id));
      const existingById = new Map(existing.map(p => [p.id, p]));
      const auditLines = [];

      // Deletions: only players on this team, and never a player with stat rows
      for (const pid of toDelete) {
        if (!existingIds.has(pid)) continue;
        const statRows = await base44.asServiceRole.entities.PlayerStats.filter({ player_id: pid });
        if (statRows.length > 0) {
          return Response.json({ error: 'One of the removed players already has recorded stats and cannot be deleted. Contact your league admin.' }, { status: 400 });
        }
        await base44.asServiceRole.entities.Player.delete(pid);
        const gone = existingById.get(pid);
        if (gone) auditLines.push('Removed ' + (gone.name || 'Unnamed') + ' #' + (gone.jersey_number ?? '?'));
      }

      // Creates and updates
      let saved = 0;
      for (const row of cleaned) {
        if (row.id && existingIds.has(row.id)) {
          const before = existingById.get(row.id);
          const changes = [];
          if (before && String(before.name || '') !== row.name) changes.push('name "' + (before.name || '') + '" to "' + row.name + '"');
          if (before && Number(before.jersey_number) !== row.jersey_number) changes.push('jersey #' + (before.jersey_number ?? '?') + ' to #' + row.jersey_number);
          if (before && String(before.position || '') !== row.position) changes.push('position ' + (before.position || '?') + ' to ' + row.position);
          await base44.asServiceRole.entities.Player.update(row.id, {
            name: row.name,
            jersey_number: row.jersey_number,
            position: row.position
          });
          if (changes.length > 0) auditLines.push('Changed ' + row.name + ': ' + changes.join(', '));
        } else {
          await base44.asServiceRole.entities.Player.create({
            name: row.name,
            jersey_number: row.jersey_number,
            position: row.position,
            team_id: teamId
          });
          auditLines.push('Added ' + row.name + ' #' + row.jersey_number);
        }
        saved++;
      }

      if (auditLines.length > 0) {
        try {
          const teamsForAudit = await base44.asServiceRole.entities.Team.filter({ id: teamId });
          await base44.asServiceRole.entities.RosterAuditLog.create({
            league_id: leagueId,
            team_id: teamId,
            team_name: (teamsForAudit[0] && teamsForAudit[0].name) || '',
            action: 'roster_save',
            performed_by: user.email || '',
            performed_by_name: user.full_name || user.email || '',
            performed_role: user.user_type || '',
            performed_at: new Date().toISOString(),
            details: auditLines
          });
        } catch (e) {
          console.error('Audit log failed:', e);
        }
      }

      return Response.json({ success: true, saved: saved, deleted: toDelete.length, reopened: isReopened, played_warning: reopenWarning });
    }

    // =================================================================
    // ACTION: markDone — roster is final; lock coach editing and notify
    // =================================================================
    if (action === 'markDone') {
      const players = await base44.asServiceRole.entities.Player.filter({ team_id: teamId });
      if (players.length === 0) {
        return Response.json({ error: 'Your roster is empty. Add your players before marking it final.' }, { status: 400 });
      }

      const teams = await base44.asServiceRole.entities.Team.filter({ id: teamId });
      const teamName = (teams[0] && teams[0].name) || 'Unknown team';
      const nowIso = new Date().toISOString();

      if (teamStatus) {
        await base44.asServiceRole.entities.TeamRosterStatus.update(teamStatus.id, {
          done: true,
          done_at: nowIso,
          coach_user_id: user.id,
          coach_name: user.full_name || user.email || 'Coach',
          coach_email: user.email || '',
          player_count: players.length
        });
      } else {
        await base44.asServiceRole.entities.TeamRosterStatus.create({
          team_id: teamId,
          league_id: leagueId,
          done: true,
          done_at: nowIso,
          coach_user_id: user.id,
          coach_name: user.full_name || user.email || 'Coach',
          coach_email: user.email || '',
          player_count: players.length
        });
      }

      // Notify league admin(s); fall back to the app admin if none found
      try {
        await base44.asServiceRole.entities.RosterAuditLog.create({
          league_id: leagueId,
          team_id: teamId,
          team_name: teamName,
          action: 'roster_done',
          performed_by: user.email || '',
          performed_by_name: user.full_name || user.email || '',
          performed_role: user.user_type || '',
          performed_at: new Date().toISOString(),
          details: ['Marked roster final (' + players.length + ' players)']
        });
      } catch (e) {
        console.error('Audit log failed:', e);
      }

      const users = await base44.asServiceRole.entities.User.list();
      const leagueAdmins = users.filter(u =>
        u.user_type === 'league_admin' &&
        Array.isArray(u.assigned_league_ids) &&
        u.assigned_league_ids.includes(leagueId)
      );
      const recipients = leagueAdmins.length > 0
        ? leagueAdmins.map(u => u.email).filter(Boolean)
        : ['adwin.imperial@gmail.com'];

      for (const to of recipients) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to,
            subject: 'Roster final: ' + teamName,
            body: '<h2>Roster Marked Final</h2>' +
              '<p>Coach <strong>' + (user.full_name || user.email) + '</strong> has marked the roster for <strong>' + teamName + '</strong> as final.</p>' +
              '<p><strong>Players on the roster:</strong> ' + players.length + '</p>' +
              '<p>Coach editing for this team is now locked. You can reopen it from the Teams page if a change is needed.</p>' +
              '<p style="color:#888">Courtside by AI &middot; Numbers Don\'t Lie</p>'
          });
        } catch (e) {
          console.error('Email failed for', to, e);
        }
      }

      return Response.json({ success: true, player_count: players.length, reopened: isReopened, played_warning: reopenWarning });
    }

    return Response.json({ error: 'Unknown action: ' + String(action) }, { status: 400 });
  } catch (error) {
    console.error('manageCoachRoster error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
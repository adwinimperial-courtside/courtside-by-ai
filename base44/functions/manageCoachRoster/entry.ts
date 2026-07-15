import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// MANAGE_COACH_ROSTER_V1 — lets a coach manage their own team's roster while
// the editing window is open, and mark the roster as final.
//
// Actions:
//   'save'     — full-roster save (create/update players, delete removed ones)
//   'markDone' — coach confirms the roster is final; locks coach editing for
//                this team and emails the league admin(s)
//
// The editing window is OPEN only when ALL of these are true:
//   1. The league is not manually locked (RosterSettings.locked !== true)
//   2. The due date has not passed (RosterSettings.due_date empty or in future)
//   3. The team has not marked its roster done (no TeamRosterStatus with done)
//   4. The team has no completed or in-progress games (protects stat data)
// Every write re-checks the window server-side. Coaches cannot write Player
// records directly (RLS locks them to admins) — this function applies changes
// with the service role after the checks pass.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Not signed in' }, { status: 401 });
    }

    const { action, leagueId, teamId, roster, removedIds } = await req.json();
    if (!action || !leagueId || !teamId) {
      return Response.json({ error: 'action, leagueId, and teamId are required' }, { status: 400 });
    }

    // --- Who is allowed: the coach linked to this team, or the app admin ---
    const isAppAdmin = user.user_type === 'app_admin';
    let isTeamCoach = false;
    if (user.user_type === 'coach') {
      const pairs = Array.isArray(user.league_team_pairs) ? user.league_team_pairs : [];
      if (pairs.some(p => p && p.league_id === leagueId && p.team_id === teamId)) {
        isTeamCoach = true;
      } else {
        const identities = await base44.asServiceRole.entities.UserLeagueIdentity.filter({
          user_id: user.id,
          league_id: leagueId,
          role: 'coach'
        });
        if (identities.some(i => i.team_id === teamId)) isTeamCoach = true;
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
    if (settings && settings.due_date && new Date() > new Date(settings.due_date)) {
      return Response.json({ error: 'The roster deadline has passed. Contact your league admin for changes.' }, { status: 400 });
    }

    const statusList = await base44.asServiceRole.entities.TeamRosterStatus.filter({ team_id: teamId });
    const teamStatus = statusList[0] || null;
    if (teamStatus && teamStatus.done === true) {
      return Response.json({ error: 'Your roster is already marked as final. Contact your league admin to reopen editing.' }, { status: 400 });
    }

    const leagueGames = await base44.asServiceRole.entities.Game.filter({ league_id: leagueId });
    const teamHasPlayed = leagueGames.some(g =>
      (g.status === 'completed' || g.status === 'in_progress') &&
      (g.home_team_id === teamId || g.away_team_id === teamId)
    );
    if (teamHasPlayed) {
      return Response.json({ error: 'Roster editing is locked after your first game. Contact your league admin for corrections.' }, { status: 400 });
    }

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

      // Deletions: only players on this team, and never a player with stat rows
      for (const pid of toDelete) {
        if (!existingIds.has(pid)) continue;
        const statRows = await base44.asServiceRole.entities.PlayerStats.filter({ player_id: pid });
        if (statRows.length > 0) {
          return Response.json({ error: 'One of the removed players already has recorded stats and cannot be deleted. Contact your league admin.' }, { status: 400 });
        }
        await base44.asServiceRole.entities.Player.delete(pid);
      }

      // Creates and updates
      let saved = 0;
      for (const row of cleaned) {
        if (row.id && existingIds.has(row.id)) {
          await base44.asServiceRole.entities.Player.update(row.id, {
            name: row.name,
            jersey_number: row.jersey_number,
            position: row.position
          });
        } else {
          await base44.asServiceRole.entities.Player.create({
            name: row.name,
            jersey_number: row.jersey_number,
            position: row.position,
            team_id: teamId
          });
        }
        saved++;
      }

      return Response.json({ success: true, saved: saved, deleted: toDelete.length });
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

      return Response.json({ success: true, player_count: players.length });
    }

    return Response.json({ error: 'Unknown action: ' + String(action) }, { status: 400 });
  } catch (error) {
    console.error('manageCoachRoster error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
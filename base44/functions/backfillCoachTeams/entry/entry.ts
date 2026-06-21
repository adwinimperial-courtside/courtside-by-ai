import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// COACH_TEAM_BACKFILL_V1 — one-time, idempotent, NON-DESTRUCTIVE backfill of league_team_pairs
// for coaches approved before COACH_TEAM_PERSIST_V1. For each approved coach application it reads
// the team the coach chose and fills any MISSING league/team pair on that user's record. It never
// overwrites an existing pair, never touches non-coaches, and skips leagues the user is no longer in.
// Call with { dryRun: true } to preview (zero writes); { dryRun: false } to apply.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (me?.user_type !== 'app_admin') {
      return Response.json({ error: 'Forbidden: app_admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false; // default to preview unless explicitly false

    const [apps, leagues, teams] = await Promise.all([
      base44.asServiceRole.entities.UserApplication.list('-applied_at', 5000),
      base44.asServiceRole.entities.League.list('-created_date', 1000),
      base44.asServiceRole.entities.Team.list('-created_date', 5000),
    ]);

    const leagueMap = Object.fromEntries(leagues.map((l) => [l.id, l]));
    const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));

    // userId -> { [leagueId]: teamId } chosen across that user's approved coach applications
    const desiredByUser = {};
    let coachAppsScanned = 0;

    for (const app of apps) {
      if (app.requested_role !== 'coach') continue;
      if (app.status !== 'Approved') continue;
      const uid = app.user_id;
      if (!uid) continue;
      coachAppsScanned++;
      if (!desiredByUser[uid]) desiredByUser[uid] = {};

      const want = (leagueId, teamId) => {
        if (!leagueId || !teamId) return;
        if (!desiredByUser[uid][leagueId]) desiredByUser[uid][leagueId] = teamId; // first non-empty wins
      };

      if (Array.isArray(app.league_team_pairs)) {
        for (const p of app.league_team_pairs) {
          if (p && p.league_id) want(p.league_id, p.team_id);
        }
      }
      if (app.league_id) want(app.league_id, app.team_id);
    }

    const additions = []; // { userId, email, name, leagueName, teamName }
    const skipped = [];   // { email, league, reason }
    const errors = [];    // { email, error }

    for (const uid of Object.keys(desiredByUser)) {
      let targetUser;
      try {
        targetUser = await base44.asServiceRole.entities.User.get(uid);
      } catch (_e) {
        errors.push({ email: uid, error: 'user record not found' });
        continue;
      }

      const email = targetUser.email || uid;
      const assigned = Array.isArray(targetUser.assigned_league_ids) ? targetUser.assigned_league_ids : [];
      const existingPairs = Array.isArray(targetUser.league_team_pairs) ? targetUser.league_team_pairs : [];
      const haveLeague = new Set(existingPairs.filter((p) => p && p.league_id).map((p) => p.league_id));

      const toAdd = [];
      for (const [leagueId, teamId] of Object.entries(desiredByUser[uid])) {
        const leagueName = leagueMap[leagueId]?.name || leagueId;
        const teamName = teamMap[teamId]?.name || teamId;

        if (!assigned.includes(leagueId)) {
          skipped.push({ email, league: leagueName, reason: 'user no longer assigned to this league' });
          continue;
        }
        if (haveLeague.has(leagueId)) {
          skipped.push({ email, league: leagueName, reason: 'already has a team for this league' });
          continue;
        }
        if (!teamMap[teamId]) {
          skipped.push({ email, league: leagueName, reason: 'chosen team no longer exists' });
          continue;
        }
        toAdd.push({ league_id: leagueId, team_id: teamId });
        additions.push({ userId: uid, email, name: targetUser.full_name || '', leagueName, teamName });
      }

      if (toAdd.length > 0 && !dryRun) {
        try {
          await base44.asServiceRole.entities.User.update(uid, {
            league_team_pairs: [...existingPairs, ...toAdd],
          });
        } catch (e) {
          errors.push({ email, error: e.message });
        }
      }
    }

    const usersAffected = new Set(additions.map((a) => a.userId)).size;

    return Response.json({
      mode: dryRun ? 'preview' : 'committed',
      coachApplicationsScanned: coachAppsScanned,
      coachesConsidered: Object.keys(desiredByUser).length,
      usersAffected,
      additionsCount: additions.length,
      additions,
      skippedCount: skipped.length,
      skipped,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
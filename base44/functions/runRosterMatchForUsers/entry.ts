import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const normalizeName = (name) =>
  (name || '').toLowerCase().trim().replace(/\s+/g, ' ');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.user_type !== 'app_admin') {
      return Response.json({ error: 'Forbidden: app_admin only' }, { status: 403 });
    }

    const [allUsers, allPlayers, allTeams, allLeagues] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 2000),
      base44.asServiceRole.entities.Player.list('-created_date', 10000),
      base44.asServiceRole.entities.Team.list('-created_date', 2000),
      base44.asServiceRole.entities.League.list('-created_date', 500),
    ]);

    const noLeagueUsers = allUsers.filter(u =>
      u.user_type !== 'app_admin' &&
      (!u.assigned_league_ids || u.assigned_league_ids.length === 0)
    );

    const teamMap = Object.fromEntries(allTeams.map(t => [t.id, t]));
    const leagueMap = Object.fromEntries(allLeagues.map(l => [l.id, l]));

    const matches = [];

    for (const u of noLeagueUsers) {
      const normalizedUserName = normalizeName(u.full_name);
      if (!normalizedUserName) continue;

      for (const player of allPlayers) {
        if (normalizeName(player.name) !== normalizedUserName) continue;

        const team = teamMap[player.team_id];
        if (!team) continue;
        const league = leagueMap[team.league_id];
        if (!league) continue;

        matches.push({
          userId: u.id,
          userName: u.full_name,
          userEmail: u.email,
          playerId: player.id,
          playerName: player.name,
          teamId: player.team_id,
          teamName: team.name,
          leagueId: team.league_id,
          leagueName: league.name,
          confidence: 'exact',
        });
      }
    }

    const matchedUserIds = new Set(matches.map(m => m.userId));
    const unmatched = noLeagueUsers.filter(u => !matchedUserIds.has(u.id)).length;

    return Response.json({
      matches,
      unmatched,
      total: noLeagueUsers.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
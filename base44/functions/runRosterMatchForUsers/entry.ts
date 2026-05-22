import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const normalizeName = (name) =>
  (name || '')
    .toLowerCase()
    .trim()
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\bde la\b/g, 'dela')
    .replace(/\bde los\b/g, 'delos')
    .replace(/\bde las\b/g, 'delas')
    .replace(/\bsan \b/g, 'san')
    .replace(/\s+/g, ' ')
    .trim();

const removeMiddleInitial = (name) =>
  name.replace(/\b[a-z]\b\s/g, '').trim();

const getFirstInitial = (name) =>
  name.trim().split(' ')[0]?.charAt(0) || '';

const getLastPart = (name) => {
  const parts = name.trim().split(' ');
  return parts.slice(1).join(' ');
};

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
      const rawUserName = normalizeName(u.full_name);
      const cleanUserName = removeMiddleInitial(rawUserName);
      if (!rawUserName) continue;

      const userMatches = new Set();

      for (const player of allPlayers) {
        const rawPlayerName = normalizeName(player.name);
        const cleanPlayerName = removeMiddleInitial(rawPlayerName);

        const team = teamMap[player.team_id];
        if (!team) continue;
        const league = leagueMap[team.league_id];
        if (!league) continue;

        const matchKey = u.id + team.league_id;
        if (userMatches.has(matchKey)) continue;

        let confidence = null;

        if (rawUserName === rawPlayerName) {
          confidence = 'exact';
        } else if (cleanUserName === cleanPlayerName) {
          confidence = 'normalized';
        } else {
          const userInitial = getFirstInitial(rawUserName);
          const userLast = getLastPart(rawUserName);
          const playerInitial = getFirstInitial(rawPlayerName);
          const playerLast = getLastPart(rawPlayerName);

          if (
            userLast === playerLast &&
            userLast.length > 2 &&
            (
              (rawUserName.length <= 3 && userInitial === playerInitial) ||
              (rawPlayerName.length <= 3 && userInitial === playerInitial)
            )
          ) {
            confidence = 'initial';
          }
        }

        if (confidence) {
          userMatches.add(matchKey);
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
            confidence,
          });
        }
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
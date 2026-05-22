import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const gameId = url.searchParams.get('gameId');
    if (!gameId) return Response.json(
      { error: 'gameId required' }, { status: 400 }
    );

    const base44 = createClientFromRequest(req);

    const game = await base44.asServiceRole.entities.Game.get(gameId);

    console.log('Game found:', game?.id, 'home:', game?.home_score, 'away:', game?.away_score);

    if (!game) return Response.json(
      { error: 'Game not found' }, { status: 404 }
    );

    const allTeams = await base44.asServiceRole.entities.Team.list('-created_date', 500);

    const homeTeam = allTeams.find(t => t.id === game.home_team_id);
    const awayTeam = allTeams.find(t => t.id === game.away_team_id);

    return Response.json({
      homeTeamName: homeTeam?.name || 'Home',
      awayTeamName: awayTeam?.name || 'Away',
      homeScore: game.home_score ?? 0,
      awayScore: game.away_score ?? 0,
      period: game.clock_period || 1,
      periodType: game.period_type || 'quarters',
      timeLeft: game.clock_time_left || '',
      status: game.status,
      appId: Deno.env.get('BASE44_APP_ID') || '',
      serverUrl: Deno.env.get('BASE44_BACKEND_URL') || '',
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
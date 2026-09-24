import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// SECURITY_F5_B_STAMP_V1 — labels a finished game's stat rows with its league.
// Copies Game.league_id onto every GameLog and PlayerStats row of the game
// whose league_id is still empty. Called fire-and-forget right after a game is
// marked completed. Safe to call any number of times (idempotent): rows that
// already carry a league_id are never touched. Only runs for completed games,
// so rows of a game in progress stay unlabelled and editable.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Not signed in' }, { status: 401 });
    }

    const { game_id } = await req.json();
    if (!game_id) {
      return Response.json({ error: 'game_id required' }, { status: 400 });
    }

    const svc = base44.asServiceRole.entities;
    const games = await svc.Game.filter({ id: game_id }, '-created_date', 1);
    const game = games && games[0];
    if (!game) {
      return Response.json({ error: 'Game not found' }, { status: 404 });
    }
    if (game.status !== 'completed') {
      return Response.json({ success: true, skipped: 'game not completed', stamped: 0 });
    }
    if (!game.league_id) {
      return Response.json({ success: true, skipped: 'game has no league_id', stamped: 0 });
    }

    const PAGE = 1000;
    const listForGame = async (entity) => {
      const all = [];
      let skip = 0;
      while (true) {
        const page = await svc[entity].filter({ game_id }, 'created_date', PAGE, skip);
        if (!page || page.length === 0) break;
        all.push(...page);
        skip += page.length;
      }
      return all;
    };

    const counts = {};
    for (const entity of ['GameLog', 'PlayerStats']) {
      const rows = await listForGame(entity);
      let stamped = 0;
      for (const row of rows) {
        if (row.league_id) continue;
        await svc[entity].update(row.id, { league_id: game.league_id });
        stamped++;
      }
      counts[entity] = { total: rows.length, stamped };
    }

    return Response.json({ success: true, league_id: game.league_id, counts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
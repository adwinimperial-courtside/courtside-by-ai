// MIGRATE_MANUAL_POINTS_V2 — DIAGNOSTIC ONLY, writes nothing.
// Classifies every manual/edited completed game by what format its
// PlayerStats.points_2 is ACTUALLY in, by testing both formulas against the
// stored score:
//   raw  sum = points_2 + 3*points_3 + free_throws
//   count sum= points_2*2 + 3*points_3 + free_throws
// Buckets:
//   clean_raw      -> raw sum matches score AND all points_2 even  (convert later)
//   already_count  -> count sum matches score                       (leave; cutover fixes)
//   needs_review   -> neither matches                               (human fix required)
// NEVER reads or writes home_score / away_score; never updates any row.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const me = await base44.auth.me();
    const full = await base44.asServiceRole.entities.User.get(me.id);
    const isAdmin = full?.role === 'admin' || full?.user_type === 'app_admin';
    if (!isAdmin) return Response.json({ error: 'forbidden' }, { status: 403 });
  } catch (e) {
    return Response.json({ error: 'auth_failed', detail: String(e) }, { status: 401 });
  }

  const filterAll = async (entity, query, sort) => {
    const PAGE = 1000;
    let all = [], skip = 0;
    while (true) {
      const page = await base44.asServiceRole.entities[entity].filter(query, sort, PAGE, skip);
      if (!page || page.length === 0) break;
      all = all.concat(page);
      skip += page.length;
      if (page.length < PAGE) break;
    }
    return all;
  };

  const rawSumOf = (rows) => rows.reduce((a, s) =>
    a + (s.points_2 || 0) + (s.points_3 || 0) * 3 + (s.free_throws || 0), 0);
  const countSumOf = (rows) => rows.reduce((a, s) =>
    a + (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0), 0);

  const report = {
    games_seen: 0,
    clean_raw: 0,
    already_count: 0,
    needs_review: 0,
    rows_to_convert: 0,
    needs_review_games: [],
  };

  const games = await filterAll('Game', { status: 'completed' }, '-game_date');
  const targets = games.filter(
    g => (g.entry_type === 'manual' || g.edited === true) && !g.is_default_result
  );

  for (const game of targets) {
    report.games_seen++;
    const rows = await filterAll('PlayerStats', { game_id: game.id });
    if (!rows.length) continue;

    const score = (game.home_score || 0) + (game.away_score || 0);
    const rawSum = rawSumOf(rows);
    const countSum = countSumOf(rows);
    const allEven = rows.every(r => ((r.points_2 || 0) % 2) === 0);

    if (rawSum === score && allEven) {
      report.clean_raw++;
      report.rows_to_convert += rows.filter(r => (r.points_2 || 0) !== 0).length;
    } else if (countSum === score) {
      report.already_count++;
    } else {
      report.needs_review++;
      report.needs_review_games.push({
        game_id: game.id, league_id: game.league_id,
        stored_score: score, raw_sum: rawSum, count_sum: countSum,
        entry_type: game.entry_type, edited: !!game.edited,
        all_even: allEven,
      });
    }
  }

  return Response.json(report);
});
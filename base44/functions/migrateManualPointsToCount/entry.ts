// MIGRATE_MANUAL_POINTS_V1
// Converts manual/edited games' PlayerStats.points_2 from RAW 2-point POINTS
// to a COUNT of made 2-pointers (points_2 / 2).
// SAFETY: DRY_RUN=true reports only and writes nothing. Each game must pass a
// pre-convert score check, an even-number check, and a post-convert score
// check. Any game that fails ANY check is flagged and left completely
// untouched. This function NEVER reads or writes home_score / away_score.

import { createClient } from 'npm:@base44/sdk@0.8.32';

Deno.serve(async (req) => {
  const base44 = createClient({ appId: Deno.env.get('BASE44_APP_ID') });
  base44.auth.setToken(req.headers.get('authorization')?.replace('Bearer ', ''));

  // ===== SET THIS TO false ONLY WHEN YOU ARE READY TO WRITE =====
  const DRY_RUN = true;
  // ===============================================================

  // --- caller must be app admin ---
  let me;
  try {
    me = await base44.auth.me();
    const full = await base44.asServiceRole.entities.User.get(me.id);
    const isAdmin = full?.role === 'admin' || full?.user_type === 'app_admin';
    if (!isAdmin) return Response.json({ error: 'forbidden' }, { status: 403 });
  } catch (e) {
    return Response.json({ error: 'auth_failed', detail: String(e) }, { status: 401 });
  }

  // --- cap-agnostic paged fetch (advance by returned length, stop on empty/short) ---
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

  // raw sum  = points_2 + 3*points_3 + free_throws
  // count sum = (points_2/2)*2 + 3*points_3 + free_throws
  const sumPoints = (rows, useCount) =>
    rows.reduce((acc, s) =>
      acc + (useCount ? (s.points_2 || 0) / 2 * 2 : (s.points_2 || 0))
          + (s.points_3 || 0) * 3 + (s.free_throws || 0), 0);

  const report = {
    dry_run: DRY_RUN,
    games_seen: 0,
    games_converted: 0,
    games_skipped_mismatch: 0,
    games_skipped_odd: 0,
    rows_converted: 0,
    flagged: [],
  };

  // --- target games: completed, (manual OR edited), not forfeit/default ---
  const games = await filterAll('Game', { status: 'completed' }, '-game_date');
  const targetGames = games.filter(
    g => (g.entry_type === 'manual' || g.edited === true) && !g.is_default_result
  );

  for (const game of targetGames) {
    report.games_seen++;
    const rows = await filterAll('PlayerStats', { game_id: game.id });
    if (!rows.length) continue;

    const scoreTotal = (game.home_score || 0) + (game.away_score || 0);

    // CHECK 1 (pre-convert): raw player-point sum must already equal the score.
    // If not, this game is NOT clean raw format (maybe already count, or bad
    // data) -> skip, flag for human review. Nothing in it is touched.
    const rawSum = sumPoints(rows, false);
    if (rawSum !== scoreTotal) {
      report.games_skipped_mismatch++;
      report.flagged.push({
        game_id: game.id, league_id: game.league_id, reason: 'pre_convert_mismatch',
        stored_score: scoreTotal, raw_sum: rawSum,
        entry_type: game.entry_type, edited: !!game.edited,
      });
      continue;
    }

    // CHECK 2: every points_2 must be even (odd would lose a point on /2).
    const oddRow = rows.find(r => ((r.points_2 || 0) % 2) !== 0);
    if (oddRow) {
      report.games_skipped_odd++;
      report.flagged.push({
        game_id: game.id, league_id: game.league_id, reason: 'odd_points_2',
        offending_row: oddRow.id, points_2: oddRow.points_2,
      });
      continue;
    }

    // CHECK 3 (post-convert): count-format sum must still equal the score.
    const countSum = sumPoints(rows, true);
    if (countSum !== scoreTotal) {
      report.games_skipped_mismatch++;
      report.flagged.push({
        game_id: game.id, league_id: game.league_id, reason: 'post_convert_mismatch',
        stored_score: scoreTotal, count_sum: countSum,
      });
      continue;
    }

    // All checks pass -> convert (or simulate only, if dry run).
    if (!DRY_RUN) {
      for (const r of rows) {
        const newVal = (r.points_2 || 0) / 2;
        if (newVal !== (r.points_2 || 0)) {
          await base44.asServiceRole.entities.PlayerStats.update(r.id, { points_2: newVal });
        }
      }
    }
    report.games_converted++;
    report.rows_converted += rows.filter(r => (r.points_2 || 0) !== 0).length;
  }

  return Response.json(report);
});
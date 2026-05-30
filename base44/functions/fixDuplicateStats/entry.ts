import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { game_id } = await req.json();
    if (!game_id) return Response.json({ error: 'game_id required' }, { status: 400 });

    // Fetch all stats for this game using user's token (RLS applies, admin can read all)
    const allStats = await base44.entities.PlayerStats.filter({ game_id });

    // Group by player_id
    const byPlayer = {};
    for (const stat of allStats) {
      if (!byPlayer[stat.player_id]) byPlayer[stat.player_id] = [];
      byPlayer[stat.player_id].push(stat);
    }

    const fixed = [];
    for (const [player_id, rows] of Object.entries(byPlayer)) {
      if (rows.length <= 1) continue;

      // Sort: keep the one with most stats (highest minutes_played), or most recently updated
      rows.sort((a, b) => {
        const aStats = (a.minutes_played || 0) + (a.points_2 || 0) + (a.points_3 || 0) + (a.assists || 0);
        const bStats = (b.minutes_played || 0) + (b.points_2 || 0) + (b.points_3 || 0) + (b.assists || 0);
        if (bStats !== aStats) return bStats - aStats;
        return new Date(b.updated_date) - new Date(a.updated_date);
      });

      // The first row is the "keeper" — set the rest to is_starter: false, is_active: false
      const [keeper, ...dupes] = rows;
      for (const dupe of dupes) {
        await base44.entities.PlayerStats.update(dupe.id, {
          is_starter: false,
          is_active: false,
        });
        fixed.push({ player_id, removed_id: dupe.id, kept_id: keeper.id });
      }
    }

    return Response.json({ success: true, fixed_count: fixed.length, fixed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
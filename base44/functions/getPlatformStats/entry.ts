import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// PLATFORM_STATS_V1 — proof numbers for the home screens. Returns the saved counts and
// recounts only when they are older than 10 days, so the heavy count runs at most once per 10 days.
const MAX_AGE_MS = 10 * 24 * 60 * 60 * 1000;
const PAGE = 1000;

async function listAll(entity: any, query: Record<string, unknown> | null) {
  const rows: any[] = [];
  let skip = 0;
  while (true) {
    const page = query
      ? await entity.filter(query, '-created_date', PAGE, skip)
      : await entity.list('-created_date', PAGE, skip);
    if (!page || page.length === 0) break;
    rows.push(...page);
    skip += page.length;
  }
  return rows;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const me = await base44.auth.me().catch(() => null);
  if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = base44.asServiceRole.entities;
  const saved = await svc.PlatformStats.list('-counted_at', 1).catch(() => []);
  const current = saved && saved[0];
  const age = current?.counted_at ? Date.now() - new Date(current.counted_at).getTime() : Infinity;
  if (current && age < MAX_AGE_MS) {
    return Response.json({ stats: current, refreshed: false });
  }

  try {
    const [games, teams, users, groups, leagues] = await Promise.all([
      listAll(svc.Game, { status: 'completed' }),
      listAll(svc.Team, null),
      listAll(svc.User, null),
      listAll(svc.LeagueGroup, null),
      listAll(svc.League, null),
    ]);
    const ungrouped = leagues.filter((l: any) => !l.group_id).length;
    const next = {
      games: games.length,
      leagues: groups.length + ungrouped,
      users: users.length,
      teams: teams.length,
      counted_at: new Date().toISOString(),
    };
    const stats = current
      ? await svc.PlatformStats.update(current.id, next)
      : await svc.PlatformStats.create(next);
    return Response.json({ stats: { ...next, id: stats?.id || current?.id }, refreshed: true });
  } catch (e) {
    // Never break the home screen: fall back to the last saved numbers if the recount fails.
    if (current) return Response.json({ stats: current, refreshed: false, error: String(e?.message || e) });
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
});
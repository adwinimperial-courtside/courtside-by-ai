import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const [games, leagues, users] = await Promise.all([
      base44.asServiceRole.entities.Game.filter({ status: 'completed' }, null, 5000),
      base44.asServiceRole.entities.League.list(null, 500),
      base44.asServiceRole.entities.User.filter({ application_status: 'Approved' }, null, 2000),
    ]);

    const games_count = games.length;
    const leagues_count = leagues.length;
    const users_count = users.length;

    const existing = await base44.asServiceRole.entities.PlatformStats.list();
    const record = existing[0];

    if (!record) {
      await base44.asServiceRole.entities.PlatformStats.create({
        games_count,
        leagues_count,
        users_count,
        last_updated: new Date().toISOString(),
      });
      return Response.json({ updated: true, games_count, leagues_count, users_count });
    }

    const gamesGrew = games_count - (record.games_count || 0) >= 10;
    const leaguesGrew = leagues_count - (record.leagues_count || 0) >= 10;
    const usersGrew = users_count - (record.users_count || 0) >= 10;

    if (gamesGrew || leaguesGrew || usersGrew) {
      await base44.asServiceRole.entities.PlatformStats.update(record.id, {
        games_count,
        leagues_count,
        users_count,
        last_updated: new Date().toISOString(),
      });
      return Response.json({ updated: true, games_count, leagues_count, users_count });
    }

    return Response.json({ updated: false, games_count, leagues_count, users_count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
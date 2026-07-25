import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.user_type !== 'app_admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const [users, applications] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 2000),
      base44.asServiceRole.entities.UserApplication.list('-applied_at', 3000),
    ]);

    const appByUserId = {};
    const appByEmail = {};
    for (const app of applications) {
      if (app.user_id && !appByUserId[app.user_id]) appByUserId[app.user_id] = app;
      const em = (app.user_email || '').toLowerCase();
      if (em && !appByEmail[em]) appByEmail[em] = app;
    }

    const filteredUsers = users
      .filter(
        (u) =>
          (!u.assigned_league_ids || u.assigned_league_ids.length === 0) &&
          u.user_type !== 'app_admin'
      )
      .map((u) => {
        const app = appByUserId[u.id] || appByEmail[(u.email || '').toLowerCase()] || null;
        return {
          ...u,
          application_country: app?.country || null,
          application_id: app?.id || null,
          application_name: app?.display_name || app?.user_name || null,
        };
      });

    return Response.json({ users: filteredUsers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
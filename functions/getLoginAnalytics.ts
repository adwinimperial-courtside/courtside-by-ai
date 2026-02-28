import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, email: targetEmail } = body;

    // Today's date boundaries (UTC)
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(todayStart.getTime() - 13 * 24 * 60 * 60 * 1000);

    if (action === 'today') {
      // Get all login events from today
      const events = await base44.asServiceRole.entities.LoginEvent.filter(
        { logged_at: { '$gte': todayStart.toISOString(), '$lt': todayEnd.toISOString() } },
        '-logged_at',
        200
      );

      const logins = events
        .map(e => ({
          time: e.logged_at,
          full_name: e.full_name,
          email: e.user_email,
          user_type: e.user_type,
        }))
        .sort((a, b) => new Date(b.time) - new Date(a.time));

      return Response.json({ logins });
    }

    if (action === 'daily_active') {
      // Get all events from last 14 days
      const events = await base44.asServiceRole.entities.LoginEvent.filter(
        { logged_at: { '$gte': fourteenDaysAgo.toISOString() } },
        '-logged_at',
        2000
      );

      // Build daily buckets
      const dailyMap = {};
      for (let d = 0; d < 14; d++) {
        const day = new Date(todayStart.getTime() - d * 24 * 60 * 60 * 1000);
        const key = day.toISOString().slice(0, 10);
        dailyMap[key] = { date: key, unique_users: new Set(), total_logins: 0 };
      }

      for (const e of events) {
        const key = new Date(e.logged_at).toISOString().slice(0, 10);
        if (dailyMap[key]) {
          dailyMap[key].unique_users.add(e.user_id);
          dailyMap[key].total_logins += 1;
        }
      }

      const rows = Object.values(dailyMap)
        .map(d => ({
          date: d.date,
          unique_users: d.unique_users.size,
          total_logins: d.total_logins,
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

      return Response.json({ rows });
    }

    if (action === 'user_history') {
      if (!targetEmail) return Response.json({ events: [] });

      const events = await base44.asServiceRole.entities.LoginEvent.filter(
        { user_email: targetEmail },
        '-logged_at',
        30
      );

      return Response.json({
        events: events.map(e => ({
          time: e.logged_at,
          full_name: e.full_name,
          email: e.user_email,
          user_type: e.user_type,
        }))
      });
    }

    if (action === 'search_users') {
      const { query } = body;
      const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const q = (query || '').toLowerCase();
      const filtered = users
        .filter(u => u.data?.user_type && u.data.user_type !== 'app_admin')
        .filter(u =>
          !q ||
          (u.full_name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q)
        )
        .slice(0, 20)
        .map(u => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          user_type: u.data?.user_type || 'unknown',
        }));
      return Response.json({ users: filtered });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
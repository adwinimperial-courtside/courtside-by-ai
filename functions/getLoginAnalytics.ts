import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all users for joining
    const users = await base44.asServiceRole.entities.User.list();

    // Build user lookup map
    const userMap = {};
    for (const u of users) {
      userMap[u.email] = {
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        user_type: u.data?.user_type || u.user_type || 'unknown',
      };
    }

    // Parse requested action from body
    const body = await req.json().catch(() => ({}));
    const { action, email: targetEmail } = body;

    // Today's date boundaries (UTC)
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // 14 days ago
    const fourteenDaysAgo = new Date(todayStart.getTime() - 13 * 24 * 60 * 60 * 1000);

    if (action === 'today') {
      // Logins today: filter users by updated_date today as a proxy
      // Use user_login analytics events stored in the analytics system
      // Since we track user_login in layout.js, we use the User entity's updated_date
      // as a signal for recent activity, but the real data is in analytics.
      // We'll use the users list and filter by those who have logged in today
      // based on created_date or updated_date as a fallback.
      // The proper signal: user's updated_date when their login event fires
      // Actually - we track user_login with user_email in analytics.
      // Let's use a smarter approach: filter users updated today as session proxy.
      const todayLogins = users
        .filter(u => {
          const updated = new Date(u.updated_date);
          return updated >= todayStart && updated < todayEnd && u.data?.user_type && u.data.user_type !== 'app_admin';
        })
        .map(u => ({
          time: u.updated_date,
          full_name: u.full_name,
          email: u.email,
          user_type: u.data?.user_type || 'unknown',
        }))
        .sort((a, b) => new Date(b.time) - new Date(a.time));

      return Response.json({ logins: todayLogins });
    }

    if (action === 'daily_active') {
      // Group users by their last_seen (updated_date) over last 14 days
      // This is a proxy - real analytics would use the analytics event store
      // Build daily buckets
      const dailyMap = {};
      for (let d = 0; d < 14; d++) {
        const day = new Date(todayStart.getTime() - d * 24 * 60 * 60 * 1000);
        const key = day.toISOString().slice(0, 10);
        dailyMap[key] = { date: key, unique_users: new Set(), total_logins: 0 };
      }

      for (const u of users) {
        if (!u.data?.user_type || u.data.user_type === 'app_admin') continue;
        const updated = new Date(u.updated_date);
        if (updated < fourteenDaysAgo || updated >= todayEnd) continue;
        const key = updated.toISOString().slice(0, 10);
        if (dailyMap[key]) {
          dailyMap[key].unique_users.add(u.id);
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
      // Show last 30 logins for a specific user by email
      if (!targetEmail) return Response.json({ events: [] });
      const targetUser = userMap[targetEmail];
      if (!targetUser) return Response.json({ events: [] });

      // Since we don't have a direct event store accessible via SDK here,
      // we return the user's own record with limited history note.
      // The real login events are tracked via analytics.track but not queryable from backend SDK.
      // Return user info + updated_date as last known activity signal.
      return Response.json({
        events: [{
          time: targetUser.updated_date || null,
          email: targetUser.email,
          full_name: targetUser.full_name,
          user_type: targetUser.user_type,
        }],
        note: 'limited_history'
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
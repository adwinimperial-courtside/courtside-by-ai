import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ANALYTICS_V2

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.user_type !== 'app_admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, email: targetEmail } = body;

    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(todayStart.getTime() - 13 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    // Paginated fetch: base44 silently caps single fetches around 1500 rows,
    // so we always loop in pages of 1000 until an incomplete page comes back.
    const fetchEventsSince = async (sinceIso) => {
      const PAGE = 1000;
      let skip = 0;
      const all = [];
      while (true) {
        const page = await base44.asServiceRole.entities.LoginEvent.filter(
          { logged_at: { '$gte': sinceIso } },
          '-logged_at',
          PAGE,
          skip
        );
        if (!page || page.length === 0) break;
        all.push(...page);
        skip += page.length;
        if (page.length < PAGE) break;
      }
      return all;
    };

    // ROLE_LOOKUP_V1: historical login events were stamped user_type 'unknown'
    // due to a wrong field path in recordLoginEvent. Resolve roles from current
    // User records at read time so old events display correctly too.
    const fetchAllUsers = async () => {
      const PAGE = 500;
      let skip = 0;
      const all = [];
      while (true) {
        const page = await base44.asServiceRole.entities.User.list('-created_date', PAGE, skip);
        if (!page || page.length === 0) break;
        all.push(...page);
        skip += page.length;
        if (page.length < PAGE) break;
      }
      return all;
    };
    const buildRoleMap = async () => {
      const users = await fetchAllUsers();
      const map = {};
      for (const u of users) {
        if (u.email) map[u.email.toLowerCase()] = u.user_type || 'unknown';
      }
      return map;
    };
    const resolveType = (map, email, stamped) => {
      if (stamped && stamped !== 'unknown') return stamped;
      return map[(email || '').toLowerCase()] || 'unknown';
    };

    if (action === 'today') {
      const events = (await fetchEventsSince(todayStart.toISOString()))
        .filter(e => e.logged_at < todayEnd.toISOString());

      const roleMap = await buildRoleMap();
      const logins = events
        .map(e => ({
          time: e.logged_at,
          full_name: e.full_name,
          email: e.user_email,
          user_type: resolveType(roleMap, e.user_email, e.user_type),
        }))
        .sort((a, b) => new Date(b.time) - new Date(a.time));

      return Response.json({ logins });
    }

    if (action === 'daily_active') {
      const events = await fetchEventsSince(fourteenDaysAgo.toISOString());

      const dailyMap = {};
      for (let d = 0; d < 14; d++) {
        const day = new Date(todayStart.getTime() - d * 24 * 60 * 60 * 1000);
        const key = day.toISOString().slice(0, 10);
        dailyMap[key] = { date: key, unique_users: new Set(), total_logins: 0 };
      }

      const weeklyUsers = new Set();
      const sevenDaysAgoIso = sevenDaysAgo.toISOString();

      for (const e of events) {
        const key = new Date(e.logged_at).toISOString().slice(0, 10);
        if (dailyMap[key]) {
          dailyMap[key].unique_users.add(e.user_id);
          dailyMap[key].total_logins += 1;
        }
        if (e.logged_at >= sevenDaysAgoIso) {
          weeklyUsers.add(e.user_id);
        }
      }

      const rows = Object.values(dailyMap)
        .map(d => ({
          date: d.date,
          unique_users: d.unique_users.size,
          total_logins: d.total_logins,
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

      return Response.json({ rows, weekly_unique: weeklyUsers.size });
    }

    if (action === 'most_active') {
      const events = await fetchEventsSince(thirtyDaysAgo.toISOString());

      const byUser = {};
      for (const e of events) {
        const key = e.user_email || 'unknown';
        if (!byUser[key]) {
          byUser[key] = {
            email: e.user_email,
            full_name: e.full_name,
            user_type: e.user_type,
            sessions: 0,
            last_seen: e.logged_at,
          };
        }
        byUser[key].sessions += 1;
        if (e.logged_at > byUser[key].last_seen) {
          byUser[key].last_seen = e.logged_at;
          byUser[key].full_name = e.full_name || byUser[key].full_name;
          byUser[key].user_type = e.user_type || byUser[key].user_type;
        }
      }

      const roleMap = await buildRoleMap();
      const leaders = Object.values(byUser)
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 10)
        .map(l => ({ ...l, user_type: resolveType(roleMap, l.email, l.user_type) }));

      return Response.json({ leaders });
    }

    if (action === 'user_history') {
      if (!targetEmail) return Response.json({ events: [] });

      const events = await base44.asServiceRole.entities.LoginEvent.filter(
        { user_email: targetEmail },
        '-logged_at',
        30
      );

      const roleMap = await buildRoleMap();
      return Response.json({
        events: events.map(e => ({
          time: e.logged_at,
          full_name: e.full_name,
          email: e.user_email,
          user_type: resolveType(roleMap, e.user_email, e.user_type),
        }))
      });
    }

    // LEAGUE_ACTIVITY_V1: unique active users and sessions per league (last 30 days),
    // joined via User.assigned_league_ids. Users in several leagues count in each.
    if (action === 'league_activity') {
      const events = await fetchEventsSince(thirtyDaysAgo.toISOString());

      const sessionsByEmail = {};
      for (const e of events) {
        const em = (e.user_email || '').toLowerCase();
        if (!em) continue;
        sessionsByEmail[em] = (sessionsByEmail[em] || 0) + 1;
      }

      const allUsers = await fetchAllUsers();
      const userLeagues = {};
      for (const u of allUsers) {
        if (u.email && Array.isArray(u.assigned_league_ids)) {
          userLeagues[u.email.toLowerCase()] = u.assigned_league_ids;
        }
      }

      const leagues = await base44.asServiceRole.entities.League.list('-created_date', 500);
      const byLeague = {};
      for (const lg of leagues) {
        byLeague[lg.id] = { league_id: lg.id, league_name: lg.name || 'Unnamed league', users: 0, sessions: 0 };
      }

      for (const [em, sessions] of Object.entries(sessionsByEmail)) {
        const ids = userLeagues[em] || [];
        for (const id of ids) {
          if (!byLeague[id]) continue;
          byLeague[id].users += 1;
          byLeague[id].sessions += sessions;
        }
      }

      const rows = Object.values(byLeague)
        .sort((a, b) => b.users - a.users || b.sessions - a.sessions);

      return Response.json({ rows });
    }

    if (action === 'search_users') {
      const { query } = body;
      const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const q = (query || '').toLowerCase();
      const filtered = users
        .filter(u => u.user_type !== 'app_admin')
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
          user_type: u.user_type || 'unknown',
        }));
      return Response.json({ users: filtered });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
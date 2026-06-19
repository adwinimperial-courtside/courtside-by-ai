import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Returns the full Command Center dataset for a trusted staff viewer.
// Direct entity reads of User / UserApplication are blocked for non-platform-admins,
// so Operations Admins (ops_admin) get this read-only snapshot through the service role.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.user_type !== 'app_admin' && user.user_type !== 'ops_admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Paginate fully so per-response caps can never silently truncate totals.
    const listAll = async (entity, sort) => {
      const PAGE = 1000;
      let all = [];
      let skip = 0;
      while (true) {
        const page = await base44.asServiceRole.entities[entity].list(sort, PAGE, skip);
        if (!page || page.length === 0) break;
        all = all.concat(page);
        skip += page.length;
        if (page.length < PAGE) break;
      }
      return all;
    };

    // One entity at a time — true totals with no request burst.
    const leagues = await listAll('League', '-created_date');
    const teams = await listAll('Team', '-created_date');
    const players = await listAll('Player', '-created_date');
    const games = await listAll('Game', '-game_date');
    const applications = await listAll('UserApplication', '-created_date');
    const users = await listAll('User', '-created_date');
    const auditLogs = await listAll('LeagueAuditLog', '-performed_at');
    const deletions = await listAll('DeletionLog', '-deletion_date');

    return Response.json({ leagues, teams, players, games, applications, users, auditLogs, deletions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
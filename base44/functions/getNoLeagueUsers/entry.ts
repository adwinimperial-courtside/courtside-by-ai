import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.user_type !== 'app_admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const users = await base44.asServiceRole.entities.User.list('-created_date', 2000);

    const filteredUsers = users.filter(
      (u) =>
        u.application_status === 'Approved' &&
        (!u.assigned_league_ids || u.assigned_league_ids.length === 0) &&
        u.user_type !== 'app_admin'
    );

    return Response.json({ users: filteredUsers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
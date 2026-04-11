import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.user_type !== 'app_admin' && user.user_type !== 'league_admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);

  return Response.json({ users: allUsers });
});
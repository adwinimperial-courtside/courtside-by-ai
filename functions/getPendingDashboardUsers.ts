import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only app_admin can access
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get pending requests from the User entity by role
    const allUsers = await base44.asServiceRole.entities.User.list('', 1000);
    
    // Filter for users with role 'user' (default) - these are pending sign-ups
    const pendingUsers = allUsers.filter(u => u.role === 'user');
    
    return Response.json({ users: pendingUsers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
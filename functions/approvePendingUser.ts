import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only app_admin can access
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { action, userId } = await req.json();

    // Get all users and filter for pending
    if (action === 'list') {
      const allUsers = await base44.asServiceRole.entities.User.list();
      const pendingUsers = allUsers.filter(u => !u.user_type);
      return Response.json({ users: pendingUsers });
    }

    // Approve or reject user
    if (!userId || !['approve', 'reject'].includes(action)) {
      return Response.json({ error: 'Missing userId or invalid action' }, { status: 400 });
    }

    if (action === 'approve') {
      await base44.asServiceRole.entities.User.update(userId, { user_type: 'viewer' });
    } else if (action === 'reject') {
      await base44.asServiceRole.entities.User.update(userId, { user_type: 'rejected' });
    }

    return Response.json({ success: true, message: `User ${action}ed successfully` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
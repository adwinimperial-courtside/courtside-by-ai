import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only app_admin can approve users
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { userId, action } = await req.json();

    if (!userId || !['approve', 'reject'].includes(action)) {
      return Response.json({ error: 'Missing userId or invalid action' }, { status: 400 });
    }

    if (action === 'approve') {
      // Approve user by setting their role to 'user' (removes pending status)
      await base44.asServiceRole.entities.User.update(userId, { role: 'user' });
    } else if (action === 'reject') {
      // Reject by setting role to 'rejected'
      await base44.asServiceRole.entities.User.update(userId, { role: 'rejected' });
    }

    return Response.json({ success: true, message: `User ${action}ed successfully` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
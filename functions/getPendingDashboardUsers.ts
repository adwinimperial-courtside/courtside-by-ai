import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only app_admin can access
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get pending applications from UserApplication entity
    const pendingApplications = await base44.asServiceRole.entities.UserApplication.filter({ status: 'Pending' }, '-applied_at', 1000);
    
    return Response.json({ users: pendingApplications });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
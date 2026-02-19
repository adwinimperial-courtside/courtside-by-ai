import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only app_admin can access
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all users from the User entity (this includes users who signed up via Base44 auth)
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);
    
    // Filter for users who haven't been approved yet
    // These are users who signed up but haven't been approved by an app_admin
    // Include users who are unverified OR have user_type === 'user' (default type = not approved)
    const pendingUsers = allUsers.filter(u => 
      u.is_verified === false || u.user_type === 'user'
    );
    
    return Response.json({ users: pendingUsers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
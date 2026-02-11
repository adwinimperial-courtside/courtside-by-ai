import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only app_admin can approve
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { requestId, userId, leagueIds } = await req.json();

    // Update user with assigned leagues and viewer type
    await base44.asServiceRole.entities.User.update(userId, {
      assigned_league_ids: leagueIds,
      user_type: "viewer"
    });

    // Update request status
    await base44.entities.LeagueAccessRequest.update(requestId, {
      status: "approved"
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
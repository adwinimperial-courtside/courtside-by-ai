import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only app_admin can approve
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { requestId, userId, leagueIds, requested_roles, player_matches } = await req.json();

    // Determine highest role across all requested leagues
    const rolePriority = { league_admin: 4, coach: 3, player: 2, viewer: 1 };
    const roles = Object.values(requested_roles || {});
    const highestRole = roles.reduce((best, r) =>
      (rolePriority[r] || 0) > (rolePriority[best] || 0) ? r : best,
      "viewer"
    );

    // Update user with assigned leagues and highest role
    await base44.asServiceRole.entities.User.update(userId, {
      assigned_league_ids: leagueIds,
      user_type: highestRole
    });

    // Create UserLeagueIdentity records with per-league roles and player matches
    for (const leagueId of leagueIds) {
      const role = requested_roles?.[leagueId] || "viewer";
      const match = player_matches?.[leagueId];
      await base44.asServiceRole.entities.UserLeagueIdentity.create({
        user_id: userId,
        league_id: leagueId,
        role: role,
        team_id: match?.teamId || null,
        matched_player_id: match?.playerId || null,
        matched_player_name: match?.playerName || null,
        match_status: match ? "matched" : "unmatched",
        match_confidence: match?.confidence || null,
        match_method: match ? "manual_admin" : "none",
        matched_at: match ? new Date().toISOString() : null,
        matched_by: user.email || "app_admin",
        identity_status: match ? "completed" : "pending",
      });
    }

    // Update request status
    await base44.entities.LeagueAccessRequest.update(requestId, {
      status: "approved"
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
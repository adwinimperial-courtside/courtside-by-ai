import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.user_type !== 'app_admin') {
      return Response.json({ error: 'Forbidden: app_admin only' }, { status: 403 });
    }

    const { approvedMatches } = await req.json();
    if (!Array.isArray(approvedMatches) || approvedMatches.length === 0) {
      return Response.json({ error: 'approvedMatches array is required' }, { status: 400 });
    }

    // Group matches by userId
    const byUser = {};
    for (const match of approvedMatches) {
      if (!byUser[match.userId]) byUser[match.userId] = [];
      byUser[match.userId].push(match);
    }

    let applied = 0;
    const errors = [];

    for (const [userId, userMatches] of Object.entries(byUser)) {
      try {
        const newLeagueIds = userMatches.map(m => m.leagueId);

        // Fetch current user to merge league ids
        const targetUser = await base44.asServiceRole.entities.User.get(userId);
        const existingLeagueIds = targetUser.assigned_league_ids || [];
        const mergedLeagueIds = [...new Set([...existingLeagueIds, ...newLeagueIds])];

        // Update user
        await base44.asServiceRole.entities.User.update(userId, {
          assigned_league_ids: mergedLeagueIds,
          user_type: 'player',
        });

        // Create UserLeagueIdentity for each match
        for (const match of userMatches) {
          // Check if identity already exists
          const existing = await base44.asServiceRole.entities.UserLeagueIdentity.filter({
            user_id: userId,
            league_id: match.leagueId,
          });

          const identityData = {
            user_id: userId,
            league_id: match.leagueId,
            role: 'player',
            team_id: match.teamId || null,
            matched_player_id: match.playerId || null,
            matched_player_name: match.playerName || null,
            match_status: 'matched',
            match_confidence: match.confidence || 'exact',
            match_method: 'normalized_name',
            matched_at: new Date().toISOString(),
            matched_by: user.email,
            identity_status: 'completed',
          };

          if (existing.length > 0) {
            await base44.asServiceRole.entities.UserLeagueIdentity.update(existing[0].id, identityData);
          } else {
            await base44.asServiceRole.entities.UserLeagueIdentity.create(identityData);
          }
        }

        applied++;
      } catch (err) {
        errors.push({ userId, error: err.message });
      }
    }

    return Response.json({ applied, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
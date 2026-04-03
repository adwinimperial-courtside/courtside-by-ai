import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.user_type !== 'app_admin') {
      return Response.json({ error: 'Forbidden: app_admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { targetLeagueId, matches } = body;

    if (!targetLeagueId || !Array.isArray(matches)) {
      return Response.json({ error: 'Missing targetLeagueId or matches' }, { status: 400 });
    }

    let applied = 0;
    const errors = [];

    for (const match of matches) {
      try {
        const { userId, playerId, playerName, teamId, confidence, matchMethod } = match;
        if (!userId || !targetLeagueId) continue;

        // Upsert UserLeagueIdentity for target league
        const existing = await base44.asServiceRole.entities.UserLeagueIdentity.filter({
          user_id: userId,
          league_id: targetLeagueId
        });

        const identityData = {
          user_id: userId,
          league_id: targetLeagueId,
          team_id: teamId || null,
          matched_player_name: playerName,
          matched_player_id: playerId || null,
          match_status: 'matched',
          match_confidence: confidence || 'medium',
          match_method: matchMethod || 'normalized_name',
          matched_at: new Date().toISOString(),
          matched_by: user.email,
        };

        if (existing.length > 0) {
          await base44.asServiceRole.entities.UserLeagueIdentity.update(existing[0].id, identityData);
        } else {
          await base44.asServiceRole.entities.UserLeagueIdentity.create(identityData);
        }

        // Add target league to user's assigned_league_ids
        const targetUser = await base44.asServiceRole.entities.User.get(userId);
        const existingLeagueIds = targetUser.assigned_league_ids || [];
        if (!existingLeagueIds.includes(targetLeagueId)) {
          await base44.asServiceRole.entities.User.update(userId, {
            assigned_league_ids: [...existingLeagueIds, targetLeagueId],
          });
        }

        applied++;
      } catch (err) {
        errors.push({ userId: match.userId, error: err.message });
      }
    }

    return Response.json({ applied, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
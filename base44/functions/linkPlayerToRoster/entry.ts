import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// PLAYER_ROSTER_LINK_V1 — admin links a player account to a roster slot from the People page.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ ok: false, reason: 'forbidden' }, { status: 403 });

    let caller;
    try { caller = await base44.asServiceRole.entities.User.get(me.id); } catch (_e) { caller = me; }
    const callerType = caller && caller.user_type;
    const isAppAdmin = me.role === 'admin' || callerType === 'app_admin';
    const isLeagueAdmin = callerType === 'league_admin';
    const callerLeagueIds = Array.isArray(caller && caller.assigned_league_ids) ? caller.assigned_league_ids : [];

    const body = await req.json();
    const user_id = body.user_id;
    const league_id = body.league_id;
    const matched_player_id = body.matched_player_id || '';
    if (!user_id || !league_id) return Response.json({ ok: false, reason: 'missing_params' }, { status: 400 });

    // Auth: app admin anywhere, or league admin for this league only.
    if (!isAppAdmin && !(isLeagueAdmin && callerLeagueIds.includes(league_id))) {
      return Response.json({ ok: false, reason: 'forbidden' }, { status: 403 });
    }

    // Find this user's existing identity row for the league.
    let existingRows = [];
    try {
      existingRows = await base44.asServiceRole.entities.UserLeagueIdentity.filter({ user_id, league_id });
    } catch (_e) { existingRows = []; }
    const existing = (existingRows && existingRows[0]) || null;

    // UNLINK / no slot chosen: keep them a player, clear the roster fields.
    if (!matched_player_id) {
      const clearPayload = { role: 'player', matched_player_id: null, matched_player_name: null, team_id: null };
      if (existing) {
        await base44.asServiceRole.entities.UserLeagueIdentity.update(existing.id, clearPayload);
      } else {
        await base44.asServiceRole.entities.UserLeagueIdentity.create({ user_id, league_id, ...clearPayload });
      }
      return Response.json({ ok: true, linked: false });
    }

    // Look up the roster player.
    let player;
    try { player = await base44.asServiceRole.entities.Player.get(matched_player_id); } catch (_e) { player = null; }
    if (!player) return Response.json({ ok: false, reason: 'player_not_found' });

    // One-claim guard: is this roster slot already held by a DIFFERENT user in this league?
    let claims = [];
    try {
      claims = await base44.asServiceRole.entities.UserLeagueIdentity.filter({ league_id, matched_player_id });
    } catch (_e) { claims = []; }
    const conflict = (claims || []).find((c) => c && c.user_id && c.user_id !== user_id);
    if (conflict) {
      let ownerLabel = '';
      try {
        const owner = await base44.asServiceRole.entities.User.get(conflict.user_id);
        if (owner) ownerLabel = [owner.full_name || owner.name, owner.email].filter(Boolean).join(' — ');
      } catch (_e) {}
      const jersey = player.jersey_number ? (' #' + player.jersey_number) : '';
      return Response.json({
        ok: false,
        reason: 'already_claimed',
        claimed_by: (player.name || 'that slot') + jersey + (ownerLabel ? ' (held by ' + ownerLabel + ')' : ''),
      });
    }

    // Upsert the link.
    const identityData = {
      user_id,
      league_id,
      role: 'player',
      team_id: player.team_id || null,
      matched_player_id,
      matched_player_name: player.name || '',
      match_status: 'matched',
      match_method: 'admin_manual',
      matched_by: (caller && caller.email) || me.email || '',
      matched_at: new Date().toISOString(),
    };
    if (existing) {
      await base44.asServiceRole.entities.UserLeagueIdentity.update(existing.id, identityData);
    } else {
      await base44.asServiceRole.entities.UserLeagueIdentity.create(identityData);
    }

    return Response.json({ ok: true, linked: true, player_name: player.name || '', jersey: player.jersey_number || '' });
  } catch (e) {
    return Response.json({ ok: false, reason: 'error', message: (e && e.message) || String(e) });
  }
});
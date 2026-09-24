import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// LIVE_OVERLAY_V1 — data for the no-login phone-stream overlay page (/live/<token>).
// Mode 1: { token } — anyone, no login. Returns ONE game's scoreboard and nothing else.
// Mode 2: { action: 'link', gameId, reset } — logged-in app_admin, or a league_admin /
// video_admin of that game's league. Returns the game's overlay token (creates it if missing,
// replaces it when reset is true, which makes the old link stop working).
const LIVE_OVERLAY_V1 = true;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += CHARS[b % CHARS.length];
  return s;
}

function secondsLeft(game: any) {
  const left = Number(game.clock_time_left) || 0;
  if (!game.clock_running || !game.clock_started_at) return Math.max(0, left);
  const elapsed = (Date.now() - new Date(game.clock_started_at).getTime()) / 1000;
  return Math.max(0, left - elapsed);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities;

    if (body && body.action === 'link') {
      const me = await base44.auth.me().catch(() => null);
      if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const game = body.gameId ? await svc.Game.get(body.gameId).catch(() => null) : null;
      if (!game) return Response.json({ error: 'Game not found' }, { status: 404 });

      let allowed = me.user_type === 'app_admin';
      if (!allowed) {
        const full = (await svc.User.get(me.id).catch(() => null)) || me;
        const assigned = Array.isArray(full.assigned_league_ids) ? full.assigned_league_ids : [];
        const map = (full.league_role_map && typeof full.league_role_map === 'object') ? full.league_role_map : {};
        const leagueRole = map[game.league_id];
        allowed = assigned.includes(game.league_id) && (
          full.user_type === 'league_admin' || full.user_type === 'video_admin' ||
          leagueRole === 'league_admin' || leagueRole === 'video_admin'
        );
      }
      if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });

      const existing = await svc.OverlayLink.filter({ game_id: game.id }, '-created_date', 10).catch(() => []);
      if (existing && existing.length > 0 && !body.reset) {
        return Response.json({ token: existing[0].token });
      }
      for (const row of existing || []) {
        await svc.OverlayLink.delete(row.id).catch(() => {});
      }
      const token = newToken();
      await svc.OverlayLink.create({ game_id: game.id, league_id: game.league_id, token, created_by_email: me.email || '' });
      return Response.json({ token });
    }

    const token = String((body && body.token) || '');
    if (token.length < 20 || token.length > 64) return Response.json({ error: 'Not found' }, { status: 404 });
    const links = await svc.OverlayLink.filter({ token }, '-created_date', 1).catch(() => []);
    const link = links && links[0];
    if (!link || link.token !== token) return Response.json({ error: 'Not found' }, { status: 404 });

    const game = await svc.Game.get(link.game_id).catch(() => null);
    if (!game) return Response.json({ error: 'Not found' }, { status: 404 });
    const [home, away] = await Promise.all([
      svc.Team.get(game.home_team_id).catch(() => null),
      svc.Team.get(game.away_team_id).catch(() => null),
    ]);

    return Response.json({
      status: game.status || 'scheduled',
      period: Number(game.clock_period) || 1,
      period_type: game.period_type || 'quarters',
      period_status: game.period_status || 'active',
      clock_running: !!game.clock_running,
      clock_seconds_left: secondsLeft(game),
      home: { name: home?.name || 'Home', logo_url: home?.logo_url || '', color: home?.color || '#F26B1F', score: Number(game.home_score) || 0 },
      away: { name: away?.name || 'Away', logo_url: away?.logo_url || '', color: away?.color || '#F26B1F', score: Number(game.away_score) || 0 },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: String((e as any)?.message || e) }, { status: 500 });
  }
});
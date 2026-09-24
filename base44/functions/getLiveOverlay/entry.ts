import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// LIVE_OVERLAY_V1 — data for the no-login phone-stream overlay page (/live/<token>).
// Mode 1: { token } — anyone, no login. Returns ONE game's scoreboard and nothing else.
// Mode 2: { action: 'link', gameId, reset } — logged-in app_admin, or a league_admin /
// video_admin of that game's league. Returns the game's overlay token (creates it if missing,
// replaces it when reset is true, which makes the old link stop working).
// LIVE_OVERLAY_V2 — adds team fouls, bonus flag, timeouts left, league logo, sponsor logos and ticker.
const LIVE_OVERLAY_V1 = true;
const LIVE_OVERLAY_V2 = true;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const MAX_SPONSORS = 8;

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

// Same rules as the OBS overlay (GameOverlay.jsx) and the TV scoreboard (scoreboardLogic.js).
function teamState(game: any) {
  const period = Number(game.clock_period) || 1;
  const periodType = game.period_type || 'quarters';
  const total = Number(game.period_count) || (periodType === 'halves' ? 2 : 4);
  const foulKey = period > total ? String(period) : (periodType === 'halves' ? (period === 1 ? 'h1' : 'h2') : String(period));
  const segment = period > total ? 'OVERTIME' : (periodType === 'halves' ? (period === 1 ? 'FIRST_HALF' : 'SECOND_HALF') : (period <= 2 ? 'FIRST_HALF' : 'SECOND_HALF'));
  let allowance: number;
  const configured = game.game_rules?.timeoutsPerSegment;
  if (Array.isArray(configured)) {
    const idx = period - 1;
    allowance = idx >= 0 && idx < configured.length ? Number(configured[idx]) || 0 : 1;
  } else if (configured != null) {
    allowance = Number(configured) || 0;
  } else if (segment === 'OVERTIME') allowance = 1;
  else if (segment === 'FIRST_HALF') allowance = 2;
  else if (periodType === 'halves') allowance = 2;
  else allowance = 3;
  const thresholdCfg = Number(game.game_rules?.teamFoulBonusThreshold);
  const threshold = thresholdCfg > 0 ? thresholdCfg : (periodType === 'halves' ? 7 : 5);
  const homeFouls = Number(game.home_team_fouls?.[foulKey]) || 0;
  const awayFouls = Number(game.away_team_fouls?.[foulKey]) || 0;
  return {
    total,
    home: { fouls: homeFouls, bonus: homeFouls >= threshold, timeouts_left: Math.max(0, allowance - (Number(game.home_timeouts?.[segment]) || 0)) },
    away: { fouls: awayFouls, bonus: awayFouls >= threshold, timeouts_left: Math.max(0, allowance - (Number(game.away_timeouts?.[segment]) || 0)) },
  };
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
    const [home, away, settingsList, league] = await Promise.all([
      svc.Team.get(game.home_team_id).catch(() => null),
      svc.Team.get(game.away_team_id).catch(() => null),
      svc.OverlaySettings.filter({ league_id: game.league_id }, '-updated_date', 50).catch(() => []),
      svc.League.get(game.league_id).catch(() => null),
    ]);

    const list = Array.isArray(settingsList) ? settingsList : [];
    const settings = list.find((s: any) => Array.isArray(s.sponsor_logos) && s.sponsor_logos.length > 0) || list[0] || null;
    const sponsors: string[] = [];
    if (settings) {
      if (settings.logo_enabled !== false && settings.logo_url) sponsors.push(settings.logo_url);
      for (const u of (Array.isArray(settings.sponsor_logos) ? settings.sponsor_logos : [])) {
        if (typeof u === 'string' && u && !sponsors.includes(u)) sponsors.push(u);
      }
    }
    let leagueLogo = '';
    if (!settings || settings.league_logo_enabled !== false) {
      leagueLogo = settings?.league_logo_url || '';
      if (!leagueLogo && league?.group_id) {
        const grp = await svc.LeagueGroup.get(league.group_id).catch(() => null);
        leagueLogo = grp?.logo_url || '';
      }
    }
    const ts = teamState(game);

    return Response.json({
      status: game.status || 'scheduled',
      period: Number(game.clock_period) || 1,
      period_type: game.period_type || 'quarters',
      period_count: ts.total,
      period_status: game.period_status || 'active',
      clock_running: !!game.clock_running,
      clock_seconds_left: secondsLeft(game),
      clock_enabled: settings ? settings.clock_enabled !== false : true,
      home: { name: home?.name || 'Home', logo_url: home?.logo_url || '', color: home?.color || '#F26B1F', score: Number(game.home_score) || 0, ...ts.home },
      away: { name: away?.name || 'Away', logo_url: away?.logo_url || '', color: away?.color || '#F26B1F', score: Number(game.away_score) || 0, ...ts.away },
      league_logo: leagueLogo,
      sponsors: sponsors.slice(0, MAX_SPONSORS),
      ticker: settings && settings.ticker_enabled !== false && settings.ticker_text ? String(settings.ticker_text) : '',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: String((e as any)?.message || e) }, { status: 500 });
  }
});
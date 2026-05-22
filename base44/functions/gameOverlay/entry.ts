import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const gameId = url.searchParams.get('gameId') || '';
  const logoUrl = url.searchParams.get('logo') || '';

  // Extract appId from URL path: /api/apps/{appId}/functions/gameOverlay
  const pathParts = url.pathname.split('/');
  const appsIndex = pathParts.indexOf('apps');
  const appId = appsIndex >= 0 ? pathParts[appsIndex + 1] || '' : '';
  const serverUrl = url.origin;

  const base44 = createClientFromRequest(req);

  // Fetch initial game data server-side (1 credit, once)
  let d = {
    homeTeamName: 'Home', awayTeamName: 'Away',
    homeScore: 0, awayScore: 0,
    period: 1, periodType: 'quarters', timeLeft: ''
  };

  try {
    const [game, allTeams] = await Promise.all([
      base44.asServiceRole.entities.Game.get(gameId),
      base44.asServiceRole.entities.Team.list('-created_date', 500),
    ]);
    if (game) {
      const homeTeam = allTeams.find(t => t.id === game.home_team_id);
      const awayTeam = allTeams.find(t => t.id === game.away_team_id);
      d = {
        homeTeamName: homeTeam?.name || 'Home',
        awayTeamName: awayTeam?.name || 'Away',
        homeScore: game.home_score ?? 0,
        awayScore: game.away_score ?? 0,
        period: game.clock_period || 1,
        periodType: game.period_type || 'quarters',
        timeLeft: game.clock_time_left || '',
      };
    }
    console.log('appId:', appId, 'serverUrl:', serverUrl,
      'game:', d.homeTeamName, d.homeScore, 'vs', d.awayTeamName, d.awayScore);
  } catch(e) {
    console.error('Error fetching game:', e.message);
  }

  const periodLabel = (d.periodType === 'halves' ? 'H' : 'Q') + d.period;

  const rawTime = String(d.timeLeft || '0');
  const initSeconds = rawTime.includes(':')
    ? rawTime
    : (() => {
        const s = parseInt(rawTime) || 0;
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m + ':' + String(sec).padStart(2, '0');
      })();

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  background: transparent;
  width: 1920px; height: 1080px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
#logo { position:fixed; top:32px; left:32px; }
#logo img { width:80px; height:80px; border-radius:50%; object-fit:cover; }
#top-right { position:fixed; top:32px; right:32px; display:flex; align-items:center; gap:10px; }
#live-badge {
  display:flex; align-items:center; gap:5px;
  background:rgba(239,68,68,0.15);
  border:1px solid rgba(239,68,68,0.25);
  border-radius:20px; padding:4px 12px;
  font-size:14px; font-weight:600;
  color:#ef4444; letter-spacing:1px; text-transform:uppercase;
}
#live-dot { width:9px; height:9px; background:#ef4444; border-radius:50%; animation:pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
#branding { font-size:13px; color:rgba(255,255,255,0.35); }
#branding span { color:#F26B1F; }
#scoreboard {
  position:fixed; bottom:32px; right:32px;
  background:rgba(0,0,0,0.82);
  border-radius:6px; overflow:hidden; min-width:280px;
}
.team-row { display:flex; align-items:center; padding:8px 16px; gap:12px; }
.team-row:first-child { border-bottom:1px solid rgba(255,255,255,0.07); }
.team-dot { width:22px; height:22px; border-radius:50%; background:#334155; flex-shrink:0; }
.team-name {
  font-size:16px; font-weight:600; color:rgba(255,255,255,0.85);
  letter-spacing:0.5px; text-transform:uppercase;
  width:100px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.team-score { font-size:26px; font-weight:600; color:#fff; font-family:monospace; width:36px; text-align:center; }
.col-divider { width:1px; height:20px; background:rgba(255,255,255,0.1); flex-shrink:0; }
.game-info { display:flex; flex-direction:column; align-items:center; width:56px; }
.game-time { font-size:15px; font-family:monospace; color:#fff; line-height:1; }
.game-period { font-size:11px; color:#F26B1F; font-weight:600; }
.period-sq { width:10px; height:10px; border-radius:1px; background:#F26B1F; flex-shrink:0; }
</style>
</head>
<body>

${logoUrl ? `
<div id="logo">
  <img src="${logoUrl}" onerror="this.style.display='none'"/>
</div>` : ''}

<div id="top-right">
  <div id="live-badge">
    <div id="live-dot"></div>LIVE
  </div>
  <div id="branding">
    Powered by <span>Courtside by AI</span>
  </div>
</div>

<div id="scoreboard">
  <div class="team-row">
    <div class="team-dot"></div>
    <div class="team-name" id="home-name">${d.homeTeamName.substring(0,10).toUpperCase()}</div>
    <div class="team-score" id="home-score">${d.homeScore}</div>
    <div class="col-divider"></div>
    <div class="game-info">
      <div class="game-time" id="game-time">${initSeconds || '—'}</div>
      <div class="game-period" id="game-period">${periodLabel}</div>
    </div>
    <div class="period-sq"></div>
  </div>
  <div class="team-row">
    <div class="team-dot"></div>
    <div class="team-name" id="away-name">${d.awayTeamName.substring(0,10).toUpperCase()}</div>
    <div class="team-score" id="away-score">${d.awayScore}</div>
  </div>
</div>

<script type="module">
  import { createClient } from 'https://esm.sh/@base44/sdk@0.8.30';

  const gameId = '${gameId}';
  const appId = '${appId}';
  const serverUrl = '${serverUrl}';

  let clockRunning = false;
  let clockSeconds = 0;
  let clockInterval = null;

  function parseTime(t) {
    if (!t) return 0;
    if (typeof t === 'number') return t;
    if (String(t).includes(':')) {
      const parts = String(t).split(':');
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return parseInt(t) || 0;
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ':' + String(sec).padStart(2, '0');
  }

  function startLocalClock() {
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(() => {
      if (clockRunning && clockSeconds > 0) {
        clockSeconds--;
        document.getElementById('game-time').textContent = formatTime(clockSeconds);
      }
    }, 1000);
  }

  // Initialize from server-side embedded data
  clockSeconds = parseTime('${rawTime}');
  clockRunning = false;
  startLocalClock();

  console.log('Overlay init — appId:', appId, 'serverUrl:', serverUrl);

  if (!appId || !serverUrl) {
    console.error('Missing appId or serverUrl');
  } else {
    try {
      const client = createClient({
        appId,
        serverUrl,
        requiresAuth: false,
      });

      client.entities.Game.subscribe((event) => {
        if (event.id !== gameId || !event.data) return;
        const g = event.data;

        // Update scores
        document.getElementById('home-score').textContent = g.home_score ?? 0;
        document.getElementById('away-score').textContent = g.away_score ?? 0;

        // Sync clock
        clockRunning = g.clock_running === true;
        if (g.clock_time_left) {
          clockSeconds = parseTime(g.clock_time_left);
          document.getElementById('game-time').textContent = g.clock_time_left;
        }

        // Update period
        const t = g.period_type === 'halves' ? 'H' : 'Q';
        document.getElementById('game-period').textContent = t + (g.clock_period || 1);
      });

      console.log('Real-time subscription active ✅');
    } catch(e) {
      console.error('Subscription failed:', e.message);
    }
  }
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*',
      'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
    }
  });
});
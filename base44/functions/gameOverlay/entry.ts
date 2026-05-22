Deno.serve(async (req) => {
  const url = new URL(req.url);
  const gameId = url.searchParams.get('gameId') || '';
  const logoUrl = url.searchParams.get('logo') || '';
  const baseUrl = url.origin;
  const dataUrl = `${baseUrl}/api/functions/getGameOverlayData?gameId=${gameId}`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: transparent;
    width: 1920px;
    height: 1080px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  #logo {
    position: fixed; top: 32px; left: 32px;
  }
  #logo img {
    width: 80px; height: 80px;
    border-radius: 50%; object-fit: cover;
  }
  #top-right {
    position: fixed; top: 32px; right: 32px;
    display: flex; align-items: center; gap: 10px;
  }
  #live-badge {
    display: flex; align-items: center; gap: 5px;
    background: rgba(239,68,68,0.15);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 20px; padding: 4px 12px;
    font-size: 14px; font-weight: 600;
    color: #ef4444; letter-spacing: 1px;
    text-transform: uppercase;
  }
  #live-dot {
    width: 9px; height: 9px; background: #ef4444;
    border-radius: 50%;
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,100%{opacity:1} 50%{opacity:0.2}
  }
  #branding {
    font-size: 13px; color: rgba(255,255,255,0.35);
  }
  #branding span { color: #F26B1F; }
  #scoreboard {
    position: fixed; bottom: 32px; right: 32px;
    background: rgba(0,0,0,0.82);
    border-radius: 6px; overflow: hidden;
    min-width: 280px;
  }
  .team-row {
    display: flex; align-items: center;
    padding: 8px 16px; gap: 12px;
  }
  .team-row:first-child {
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .team-dot {
    width: 22px; height: 22px;
    border-radius: 50%; background: #334155;
    flex-shrink: 0;
  }
  .team-name {
    font-size: 16px; font-weight: 600;
    color: rgba(255,255,255,0.85);
    letter-spacing: 0.5px; text-transform: uppercase;
    width: 100px; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  }
  .team-score {
    font-size: 26px; font-weight: 600;
    color: #fff; font-family: monospace;
    width: 36px; text-align: center;
  }
  .col-divider {
    width: 1px; height: 20px;
    background: rgba(255,255,255,0.1); flex-shrink: 0;
  }
  .game-info {
    display: flex; flex-direction: column;
    align-items: center; width: 56px;
  }
  .game-time {
    font-size: 15px; font-family: monospace;
    color: #fff; line-height: 1;
  }
  .game-period {
    font-size: 11px; color: #F26B1F; font-weight: 600;
  }
  .period-sq {
    width: 10px; height: 10px;
    border-radius: 1px; background: #F26B1F;
    flex-shrink: 0;
  }
</style>
</head>
<body>

${logoUrl ? `
<div id="logo">
  <img src="${logoUrl}" alt="" onerror="this.style.display='none'"/>
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
    <div class="team-name" id="home-name">Home</div>
    <div class="team-score" id="home-score">0</div>
    <div class="col-divider"></div>
    <div class="game-info">
      <div class="game-time" id="game-time">—</div>
      <div class="game-period" id="game-period">Q1</div>
    </div>
    <div class="period-sq"></div>
  </div>
  <div class="team-row">
    <div class="team-dot"></div>
    <div class="team-name" id="away-name">Away</div>
    <div class="team-score" id="away-score">0</div>
  </div>
</div>

<script type="module">
  import { createClient } from 'https://esm.sh/@base44/sdk@0.8.30';

  const gameId = '${gameId}';
  const dataUrl = '${dataUrl}';

  function updateUI(data) {
    if (!data || data.error) return;
    document.getElementById('home-name').textContent =
      (data.homeTeamName || 'Home').substring(0, 10).toUpperCase();
    document.getElementById('away-name').textContent =
      (data.awayTeamName || 'Away').substring(0, 10).toUpperCase();
    document.getElementById('home-score').textContent = data.homeScore ?? 0;
    document.getElementById('away-score').textContent = data.awayScore ?? 0;
    document.getElementById('game-time').textContent = data.timeLeft || '—';
    const t = data.periodType === 'halves' ? 'H' : 'Q';
    document.getElementById('game-period').textContent = t + (data.period || 1);
  }

  const res = await fetch(dataUrl);
  const initialData = await res.json();
  updateUI(initialData);

  if (initialData.appId) {
    const base44 = createClient({
      appId: initialData.appId,
      serverUrl: initialData.serverUrl,
      requiresAuth: false,
    });

    base44.entities.Game.subscribe((event) => {
      if (event.id === gameId && event.data) {
        const d = event.data;
        document.getElementById('home-score').textContent = d.home_score ?? 0;
        document.getElementById('away-score').textContent = d.away_score ?? 0;
        document.getElementById('game-time').textContent = d.clock_time_left || '—';
        const t = d.period_type === 'halves' ? 'H' : 'Q';
        document.getElementById('game-period').textContent = t + (d.clock_period || 1);
      }
    });
  }
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*',
    }
  });
});
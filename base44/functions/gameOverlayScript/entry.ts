Deno.serve(async (req) => {
  const url = new URL(req.url);
  const gameId = url.searchParams.get('gameId') || '';
  const appId = url.searchParams.get('appId') || '';
  const serverUrl = url.searchParams.get('serverUrl') || '';
  const rawTime = url.searchParams.get('rawTime') || '0';

  const js = `
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
      document.getElementById('home-score').textContent = g.home_score ?? 0;
      document.getElementById('away-score').textContent = g.away_score ?? 0;
      clockRunning = g.clock_running === true;
      if (g.clock_time_left !== undefined) {
        clockSeconds = parseTime(g.clock_time_left);
        document.getElementById('game-time').textContent = formatTime(clockSeconds);
      }
      const t = g.period_type === 'halves' ? 'H' : 'Q';
      document.getElementById('game-period').textContent = t + (g.clock_period || 1);
    });

    console.log('Real-time subscription active');
  } catch(e) {
    console.error('Subscription failed:', e.message);
  }
}
`;

  return new Response(js, {
    headers: {
      'Content-Type': 'application/javascript',
      'Access-Control-Allow-Origin': '*',
    }
  });
});
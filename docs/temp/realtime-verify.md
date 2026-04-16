$ grep -n "Math.random\|uid\|live-stats\|live-logs\|live-game" src/components/live/LiveStatTracker.jsx

208:    const id = Math.random().toString(36).slice(2, 8);
211:      .channel(`live-stats-${gameId}-${id}`)
222:      .channel(`live-logs-${gameId}-${id}`)
233:      .channel(`live-game-${gameId}-${id}`)

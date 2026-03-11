// Singleton for tracking rank movements across page sessions
// The key is `${leagueId}-${playerId}` to track per league/player combo

const STORAGE_KEY = 'playerRankMovement';

export function getRankMovement(leagueId, playerId, currentRank, currentCategory) {
  if (!leagueId || !playerId || currentRank === null) return { change: 0, direction: 'neutral' };

  const key = `${leagueId}-${playerId}`;
  const stored = localStorage.getItem(STORAGE_KEY);
  const movements = stored ? JSON.parse(stored) : {};

  const previous = movements[key];
  
  // If no previous record or category changed, initialize without movement
  if (!previous || previous.category !== currentCategory) {
    movements[key] = { rank: currentRank, category: currentCategory, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(movements));
    return { change: 0, direction: 'neutral' };
  }

  // Calculate rank change (positive = improved/moved up, negative = declined/moved down)
  const rankChange = previous.rank - currentRank;

  // Only show movement if a new game was completed (rank changed)
  if (rankChange === 0) {
    return { change: 0, direction: 'neutral' };
  }

  // Update stored rank for next comparison
  movements[key] = { rank: currentRank, category: currentCategory, timestamp: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(movements));

  if (rankChange > 0) {
    return { change: rankChange, direction: 'up' };
  } else {
    return { change: Math.abs(rankChange), direction: 'down' };
  }
}

export function clearRankMovement(leagueId, playerId) {
  const key = `${leagueId}-${playerId}`;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const movements = JSON.parse(stored);
    delete movements[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(movements));
  }
}
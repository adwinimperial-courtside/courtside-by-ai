/**
 * Calculate Player of the Game score based on stats
 * POG_SCORE = TOTAL_PTS + 1.2*OREB + 1.0*DREB + 1.5*AST + 2.5*STL + 2.0*BLK - 2.0*TO - 0.5*FOUL - 3.0*TECH - 4.0*UNSP
 */
export function calculatePOGScore(stats) {
  const totalPoints = (stats.points_2 || 0) * 2 + (stats.points_3 || 0) * 3 + (stats.free_throws || 0);
  
  const score = 
    totalPoints +
    1.2 * (stats.offensive_rebounds || 0) +
    1.0 * (stats.defensive_rebounds || 0) +
    1.5 * (stats.assists || 0) +
    2.5 * (stats.steals || 0) +
    2.0 * (stats.blocks || 0) -
    2.0 * (stats.turnovers || 0) -
    0.5 * (stats.fouls || 0) -
    3.0 * (stats.technical_fouls || 0) -
    4.0 * (stats.unsportsmanlike_fouls || 0);
  
  return score;
}

/**
 * Find the player with the highest POG score from an array of player stats
 * Returns the player_id of the POG, or null if no stats
 */
export function findPlayerOfGame(playerStats) {
  if (!playerStats || playerStats.length === 0) {
    return null;
  }
  
  let maxScore = -Infinity;
  let pogPlayerId = null;
  
  playerStats.forEach(stat => {
    const score = calculatePOGScore(stat);
    if (score > maxScore) {
      maxScore = score;
      pogPlayerId = stat.player_id;
    }
  });
  
  return pogPlayerId;
}
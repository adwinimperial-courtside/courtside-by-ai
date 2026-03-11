// Calculate a player's best meaningful rank across multiple stat categories

function calculateCategoryStats(stats) {
  if (!stats.length) return { ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0 };
  
  let pts = 0, reb = 0, ast = 0, stl = 0, blk = 0;
  stats.forEach(s => {
    pts += (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0);
    reb += (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0);
    ast += s.assists || 0;
    stl += s.steals || 0;
    blk += s.blocks || 0;
  });
  
  const gp = stats.length;
  return {
    ppg: gp > 0 ? pts / gp : 0,
    rpg: gp > 0 ? reb / gp : 0,
    apg: gp > 0 ? ast / gp : 0,
    spg: gp > 0 ? stl / gp : 0,
    bpg: gp > 0 ? blk / gp : 0
  };
}

export function calculatePlayerBestRank(playerStats, allPlayerStats) {
  if (!playerStats || !playerStats.length || !allPlayerStats || !allPlayerStats.length) {
    return null;
  }

  // Calculate player's per-game stats
  const playerCategoryStats = calculateCategoryStats(playerStats);

  // Group all stats by player and calculate their category stats
  const playerStatsMap = {};
  allPlayerStats.forEach(s => {
    if (!playerStatsMap[s.player_id]) {
      playerStatsMap[s.player_id] = [];
    }
    playerStatsMap[s.player_id].push(s);
  });

  // Calculate stats for all players
  const allPlayersCategoryStats = Object.entries(playerStatsMap).map(([playerId, stats]) => ({
    playerId,
    stats: calculateCategoryStats(stats)
  }));

  // Thresholds for considering a category valid
  const thresholds = {
    ppg: 8,
    rpg: 4,
    apg: 3,
    spg: 1,
    bpg: 0.8
  };

  // Priority order for tie-breaking
  const priorityOrder = ['apg', 'ppg', 'rpg', 'spg', 'bpg'];

  // Calculate ranks for each category
  const categories = ['ppg', 'rpg', 'apg', 'spg', 'bpg'];
  const categoryLabels = {
    ppg: 'Scoring',
    rpg: 'Rebound',
    apg: 'Assist',
    spg: 'Steals',
    bpg: 'Blocks'
  };

  const categoryResults = [];

  categories.forEach(category => {
    const playerValue = playerCategoryStats[category];

    // Check if player meets minimum threshold
    if (playerValue < thresholds[category]) {
      return; // Skip this category
    }

    // Sort all players by this category (descending)
    const sorted = allPlayersCategoryStats
      .sort((a, b) => b.stats[category] - a.stats[category]);

    // Find player's rank (1-indexed)
    const rank = sorted.findIndex(p => p.playerId === playerStats[0]?.player_id) + 1;
    
    // Calculate percentile (0-100, where 100 is best)
    const percentile = ((sorted.length - rank) / sorted.length) * 100;

    // Check if notable: top 10 or top 25%
    const isNotable = rank <= 10 || percentile >= 75;

    if (isNotable) {
      categoryResults.push({
        category,
        label: categoryLabels[category],
        rank,
        percentile,
        value: playerValue,
        priorityIndex: priorityOrder.indexOf(category)
      });
    }
  });

  if (categoryResults.length === 0) {
    return null;
  }

  // Select best rank: lowest rank number
  // Break ties: best percentile, then priority order
  const bestRank = categoryResults.reduce((best, current) => {
    if (current.rank < best.rank) return current;
    if (current.rank === best.rank) {
      if (current.percentile > best.percentile) return current;
      if (current.percentile === best.percentile) {
        if (current.priorityIndex < best.priorityIndex) return current;
      }
    }
    return best;
  });

  return {
    label: `${bestRank.label} Rank`,
    rank: bestRank.rank,
    percentile: bestRank.percentile,
    category: bestRank.category,
    value: bestRank.value
  };
}
// Milestone tiers and progress calculation
const MILESTONES = {
  season_points: {
    name: "Season Points Progress",
    tiers: [50, 100, 150, 200],
    unit: "pts",
  },
  season_assists: {
    name: "Season Assists Progress",
    tiers: [25, 50, 75, 100],
    unit: "assists",
  },
  season_rebounds: {
    name: "Season Rebounds Progress",
    tiers: [25, 50, 75, 100],
    unit: "rebounds",
  },
  double_doubles: {
    name: "Double-Double Progress",
    tiers: [1, 3, 5, 10],
    unit: "games",
  },
  player_of_game: {
    name: "Player of the Game Progress",
    tiers: [1, 3, 5],
    unit: "awards",
  },
};

function getPoints(stat) {
  return (stat.points_2 || 0) * 2 + (stat.points_3 || 0) * 3 + (stat.free_throws || 0);
}

function getRebounds(stat) {
  return (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0);
}

function getAssists(stat) {
  return stat.assists || 0;
}

function countDoubleDigitCategories(stat) {
  let count = 0;
  if (getPoints(stat) >= 10) count++;
  if (getRebounds(stat) >= 10) count++;
  if (getAssists(stat) >= 10) count++;
  return count;
}

export function getMilestoneProgress(myStats, games) {
  if (!myStats || !games) return null;

  const completedGames = games.filter(g => g.status === 'completed');
  const completedGameIds = new Set(completedGames.map(g => g.id));
  const playerGameStats = myStats.filter(s => completedGameIds.has(s.game_id));

  if (playerGameStats.length === 0) return null;

  // Calculate season totals
  const seasonPoints = playerGameStats.reduce((sum, s) => sum + getPoints(s), 0);
  const seasonAssists = playerGameStats.reduce((sum, s) => sum + getAssists(s), 0);
  const seasonRebounds = playerGameStats.reduce((sum, s) => sum + getRebounds(s), 0);

  // Count double-doubles and POG awards
  const doubleDoublesCount = playerGameStats.filter(s => countDoubleDigitCategories(s) >= 2).length;
  const pogAwardsCount = playerGameStats.filter(s => {
    const game = completedGames.find(g => g.id === s.game_id);
    return game && game.player_of_game === s.player_id;
  }).length;

  // Calculate progress for each milestone
  const milestoneProgress = [];

  // Season Points
  const pointsTier = MILESTONES.season_points.tiers.find(tier => seasonPoints < tier);
  if (pointsTier) {
    milestoneProgress.push({
      category: 'season_points',
      name: MILESTONES.season_points.name,
      unit: MILESTONES.season_points.unit,
      current: seasonPoints,
      target: pointsTier,
      progress: (seasonPoints / pointsTier) * 100,
    });
  }

  // Season Assists
  const assistsTier = MILESTONES.season_assists.tiers.find(tier => seasonAssists < tier);
  if (assistsTier) {
    milestoneProgress.push({
      category: 'season_assists',
      name: MILESTONES.season_assists.name,
      unit: MILESTONES.season_assists.unit,
      current: seasonAssists,
      target: assistsTier,
      progress: (seasonAssists / assistsTier) * 100,
    });
  }

  // Season Rebounds
  const reboundsTier = MILESTONES.season_rebounds.tiers.find(tier => seasonRebounds < tier);
  if (reboundsTier) {
    milestoneProgress.push({
      category: 'season_rebounds',
      name: MILESTONES.season_rebounds.name,
      unit: MILESTONES.season_rebounds.unit,
      current: seasonRebounds,
      target: reboundsTier,
      progress: (seasonRebounds / reboundsTier) * 100,
    });
  }

  // Double-Doubles
  const ddTier = MILESTONES.double_doubles.tiers.find(tier => doubleDoublesCount < tier);
  if (ddTier) {
    milestoneProgress.push({
      category: 'double_doubles',
      name: MILESTONES.double_doubles.name,
      unit: MILESTONES.double_doubles.unit,
      current: doubleDoublesCount,
      target: ddTier,
      progress: (doubleDoublesCount / ddTier) * 100,
    });
  }

  // Player of the Game
  const pogTier = MILESTONES.player_of_game.tiers.find(tier => pogAwardsCount < tier);
  if (pogTier) {
    milestoneProgress.push({
      category: 'player_of_game',
      name: MILESTONES.player_of_game.name,
      unit: MILESTONES.player_of_game.unit,
      current: pogAwardsCount,
      target: pogTier,
      progress: (pogAwardsCount / pogTier) * 100,
    });
  }

  // Return the milestone closest to completion
  if (milestoneProgress.length === 0) return null;

  return milestoneProgress.sort((a, b) => b.progress - a.progress)[0];
}
import { BADGE_DEFINITIONS } from "./badgeDefinitions";

function getPoints(stat) {
  return (stat.points_2 || 0) * 2 + (stat.points_3 || 0) * 3 + (stat.free_throws || 0);
}

function getRebounds(stat) {
  return (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0);
}

function getAssists(stat) {
  return stat.assists || 0;
}

function getSteals(stat) {
  return stat.steals || 0;
}

function getBlocks(stat) {
  return stat.blocks || 0;
}

function countDoubleDigitCategories(stat) {
  let count = 0;
  if (getPoints(stat) >= 10) count++;
  if (getRebounds(stat) >= 10) count++;
  if (getAssists(stat) >= 10) count++;
  return count;
}

export function calculatePlayerBadges(myStats, games) {
  const badgeCounts = {};

  // Initialize all badges to 0
  Object.keys(BADGE_DEFINITIONS).forEach(key => {
    badgeCounts[key] = 0;
  });

  if (!myStats || !games) return badgeCounts;

  // Get completed games in order
  const completedGames = games
    .filter(g => g.status === 'completed')
    .sort((a, b) => new Date(a.game_date) - new Date(b.game_date));

  const completedGameIds = new Set(completedGames.map(g => g.id));
  const playerGameStats = myStats.filter(s => completedGameIds.has(s.game_id));

  // === SCORING BADGES ===

  // Double Digits: points >= 10
  playerGameStats.forEach(stat => {
    if (getPoints(stat) >= 10) badgeCounts.double_digits++;
  });

  // 20 Club: points >= 20
  playerGameStats.forEach(stat => {
    if (getPoints(stat) >= 20) badgeCounts.twenty_club++;
  });

  // 30 Bomb: points >= 30
  playerGameStats.forEach(stat => {
    if (getPoints(stat) >= 30) badgeCounts.thirty_bomb++;
  });

  // Scoring Streak: 10+ points in 3 consecutive games
  for (let i = 0; i <= playerGameStats.length - 3; i++) {
    const streak = playerGameStats.slice(i, i + 3);
    if (streak.every(s => getPoints(s) >= 10)) {
      badgeCounts.scoring_streak++;
    }
  }

  // === PLAYMAKING BADGES ===

  // Facilitator: assists >= 5
  playerGameStats.forEach(stat => {
    if (getAssists(stat) >= 5) badgeCounts.facilitator++;
  });

  // Playmaker: assists >= 8
  playerGameStats.forEach(stat => {
    if (getAssists(stat) >= 8) badgeCounts.playmaker++;
  });

  // Floor General: assists >= 10
  playerGameStats.forEach(stat => {
    if (getAssists(stat) >= 10) badgeCounts.floor_general++;
  });

  // === REBOUNDING BADGES ===

  // Glass Cleaner: rebounds >= 8
  playerGameStats.forEach(stat => {
    if (getRebounds(stat) >= 8) badgeCounts.glass_cleaner++;
  });

  // Board Beast: rebounds >= 10
  playerGameStats.forEach(stat => {
    if (getRebounds(stat) >= 10) badgeCounts.board_beast++;
  });

  // Rebound Machine: rebounds >= 15
  playerGameStats.forEach(stat => {
    if (getRebounds(stat) >= 15) badgeCounts.rebound_machine++;
  });

  // === DEFENSIVE BADGES ===

  // Pickpocket: steals >= 2
  playerGameStats.forEach(stat => {
    if (getSteals(stat) >= 2) badgeCounts.pickpocket++;
  });

  // Lockdown Defender: steals >= 3
  playerGameStats.forEach(stat => {
    if (getSteals(stat) >= 3) badgeCounts.lockdown_defender++;
  });

  // Shot Blocker: blocks >= 2
  playerGameStats.forEach(stat => {
    if (getBlocks(stat) >= 2) badgeCounts.shot_blocker++;
  });

  // Defensive Wall: blocks >= 3
  playerGameStats.forEach(stat => {
    if (getBlocks(stat) >= 3) badgeCounts.defensive_wall++;
  });

  // === ELITE PERFORMANCE BADGES ===

  // Double-Double: 2 categories >= 10
  playerGameStats.forEach(stat => {
    if (countDoubleDigitCategories(stat) >= 2) badgeCounts.double_double++;
  });

  // Triple-Double: 3 categories >= 10
  playerGameStats.forEach(stat => {
    if (countDoubleDigitCategories(stat) >= 3) badgeCounts.triple_double++;
  });

  // Player of the Game: game marked as player_of_game
  playerGameStats.forEach(stat => {
    const game = completedGames.find(g => g.id === stat.game_id);
    if (game && game.player_of_game === stat.player_id) {
      badgeCounts.player_of_the_game++;
    }
  });

  // Clutch Performer: leading scorer in winning team
  playerGameStats.forEach(stat => {
    const game = completedGames.find(g => g.id === stat.game_id);
    if (!game) return;

    const isHome = game.home_team_id === stat.team_id;
    const isWin = isHome ? game.home_score > game.away_score : game.away_score > game.home_score;

    if (!isWin) return;

    // Find all stats from this game for this team
    const teamStats = playerGameStats.filter(
      s => s.game_id === stat.game_id && s.team_id === stat.team_id
    );

    const playerPoints = getPoints(stat);
    const isLeadingScorer = teamStats.every(s => getPoints(s) <= playerPoints);

    if (isLeadingScorer) badgeCounts.clutch_performer++;
  });

  // All-Around Game: 5+ points, 5+ rebounds, 5+ assists
  playerGameStats.forEach(stat => {
    if (getPoints(stat) >= 5 && getRebounds(stat) >= 5 && getAssists(stat) >= 5) {
      badgeCounts.all_around_game++;
    }
  });

  return badgeCounts;
}
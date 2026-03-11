// Badge definitions with all metadata
export const BADGE_DEFINITIONS = {
  // Scoring Badges
  double_digits: {
    badge_name: "Double Digits",
    badge_icon: "🎯",
    badge_description: "Score 10 or more points in a game.",
    badge_rule: "points ≥ 10 in a game",
  },
  twenty_club: {
    badge_name: "20 Club",
    badge_icon: "🔥",
    badge_description: "Score 20 or more points in a single game.",
    badge_rule: "points ≥ 20 in a game",
  },
  thirty_bomb: {
    badge_name: "30 Bomb",
    badge_icon: "💣",
    badge_description: "Score 30 or more points in a single game.",
    badge_rule: "points ≥ 30 in a game",
  },
  scoring_streak: {
    badge_name: "Scoring Streak",
    badge_icon: "🌪️",
    badge_description: "Score 10 or more points in three straight games.",
    badge_rule: "10+ points in 3 consecutive games",
  },

  // Playmaking Badges
  facilitator: {
    badge_name: "Facilitator",
    badge_icon: "🎪",
    badge_description: "Record 5 or more assists in a game.",
    badge_rule: "assists ≥ 5 in a game",
  },
  playmaker: {
    badge_name: "Playmaker",
    badge_icon: "🎯",
    badge_description: "Record 8 or more assists in a game.",
    badge_rule: "assists ≥ 8 in a game",
  },
  floor_general: {
    badge_name: "Floor General",
    badge_icon: "👑",
    badge_description: "Record 10 or more assists in a game.",
    badge_rule: "assists ≥ 10 in a game",
  },

  // Rebounding Badges
  glass_cleaner: {
    badge_name: "Glass Cleaner",
    badge_icon: "🧹",
    badge_description: "Grab 8 or more rebounds in a game.",
    badge_rule: "rebounds ≥ 8 in a game",
  },
  board_beast: {
    badge_name: "Board Beast",
    badge_icon: "🐉",
    badge_description: "Grab 10 or more rebounds in a game.",
    badge_rule: "rebounds ≥ 10 in a game",
  },
  rebound_machine: {
    badge_name: "Rebound Machine",
    badge_icon: "⚙️",
    badge_description: "Grab 15 or more rebounds in a game.",
    badge_rule: "rebounds ≥ 15 in a game",
  },

  // Defensive Badges
  pickpocket: {
    badge_name: "Pickpocket",
    badge_icon: "🎩",
    badge_description: "Record 2 steals in a game.",
    badge_rule: "steals ≥ 2 in a game",
  },
  lockdown_defender: {
    badge_name: "Lockdown Defender",
    badge_icon: "🛡️",
    badge_description: "Record 3 steals in a game.",
    badge_rule: "steals ≥ 3 in a game",
  },
  shot_blocker: {
    badge_name: "Shot Blocker",
    badge_icon: "🚫",
    badge_description: "Record 2 blocks in a game.",
    badge_rule: "blocks ≥ 2 in a game",
  },
  defensive_wall: {
    badge_name: "Defensive Wall",
    badge_icon: "🧱",
    badge_description: "Record 3 blocks in a game.",
    badge_rule: "blocks ≥ 3 in a game",
  },

  // Elite Performance Badges
  double_double: {
    badge_name: "Double-Double",
    badge_icon: "📦",
    badge_description: "Record double digits in two stat categories in a single game.",
    badge_rule: "two stat categories ≥ 10",
  },
  triple_double: {
    badge_name: "Triple-Double",
    badge_icon: "🎁",
    badge_description: "Record double digits in three stat categories in a single game.",
    badge_rule: "three stat categories ≥ 10",
  },
  player_of_the_game: {
    badge_name: "Player of the Game",
    badge_icon: "🏆",
    badge_description: "Awarded to the best overall performer in a game.",
    badge_rule: "player selected as Player of the Game",
  },
  clutch_performer: {
    badge_name: "Clutch Performer",
    badge_icon: "⚡",
    badge_description: "Lead your team in scoring in a winning game.",
    badge_rule: "team's leading scorer in a winning game",
  },
  all_around_game: {
    badge_name: "All-Around Game",
    badge_icon: "⭐",
    badge_description: "Contribute across scoring, rebounding, and playmaking in the same game.",
    badge_rule: "5+ points, 5+ rebounds, and 5+ assists in one game",
  },
};

export const BADGE_KEYS = Object.keys(BADGE_DEFINITIONS);
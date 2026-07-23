// HELP_CENTER_V1 — single source of truth for all in-app help text.
// Each topic: key (matches HelpButton pageKey), title, category, roles, summary, tips.
// roles: "all" or an array of user_type strings. A topic is visible to a user
// when roles === "all" or roles includes their user_type.

export const HELP_CATEGORIES = [
  { key: "main", label: "League pages" },
  { key: "player", label: "For players" },
  { key: "coach", label: "For coaches" },
  { key: "admin", label: "League admin" },
  { key: "video", label: "Video & overlay" },
  { key: "ops", label: "Operations" },
];

export const HELP_TOPICS = [
  {
    key: "leagues",
    title: "Leagues",
    category: "main",
    roles: ["player", "coach", "league_admin", "app_admin"],
    summary: "A league is the club or competition itself; each season lives inside it. League cards list their seasons — tap a season to open it.",
    tips: [
      "Create League starts a new league together with its first season.",
      "The Create season button on a league card (admins) adds the next season — optionally copying teams from a previous one.",
      "Past seasons sit under Archived seasons at the bottom of a league card — tap to expand and view their stats.",
      "The star sets your default season; if a league you expect is missing, ask your league admin to add you.",
    ],
  },
  {
    key: "teams",
    title: "Teams",
    category: "main",
    roles: ["player", "coach", "league_admin", "app_admin"],
    summary: "All teams in the league with their rosters.",
    tips: [
      "Tap a team to see its full roster and details.",
      "Jersey numbers and player photos are managed by the team's coach or the league admin.",
    ],
  },
  {
    key: "schedule",
    title: "Schedule",
    category: "main",
    roles: "all",
    summary: "Upcoming and completed games for the league.",
    tips: [
      "Tap a completed game to open its box score with full player stats.",
      "Live games are marked while they are being tracked in real time.",
    ],
  },
  {
    key: "standings",
    title: "Standings",
    category: "main",
    roles: "all",
    summary: "Win–loss records and rankings for every team.",
    tips: [
      "If your league uses brackets or divisions, switch tabs to see each group's table.",
      "Forfeited (default) games count for the record but not for stat averages.",
    ],
  },
  {
    key: "statistics",
    title: "Statistics",
    category: "main",
    roles: "all",
    summary:
      "Season statistics for every player and team — points, rebounds, assists and more.",
    tips: [
      "Tap a player row to open their player card.",
      "Use the filters to pick a season, team or stat category.",
      "Averages exclude forfeited games so they reflect real play.",
    ],
  },
  {
    key: "awardleaders",
    title: "Award Leaders",
    category: "main",
    roles: "all",
    summary: "The live race for the league's season awards, category by category.",
    tips: [
      "Leaders update automatically as new games are recorded.",
      "Minimum games played may apply — set by your league's award settings.",
    ],
  },
  {
    key: "liveboxscore",
    title: "Live Box Score",
    category: "main",
    roles: "all",
    summary:
      "The full box score of a game — score by period, team totals, fouls, timeouts and every player's line.",
    tips: [
      "During a live game this page updates as the scorer records plays.",
      "Tap a player's name to open their player card.",
    ],
  },
  {
    key: "playercard",
    title: "Player Card",
    category: "main",
    roles: "all",
    summary:
      "A player's profile: season averages, recent games and career highlights.",
    tips: [
      "This is a read-only view — players edit their own photo from Player Profile.",
      "Numbers here follow the same rules as Statistics (forfeits excluded).",
    ],
  },
  {
    key: "playerprofile",
    title: "Player Profile",
    category: "player",
    roles: ["player", "coach"],
    summary:
      "Your own home page: your next game, your season stats and your photo.",
    tips: [
      "Use Upload or Edit Crop to set your profile photo — drag and zoom to frame it.",
      "Your stats appear after your first recorded game.",
    ],
  },
  {
    key: "coachroster",
    title: "My Roster",
    category: "coach",
    roles: ["coach", "league_admin", "ops_admin", "app_admin"],
    summary:
      "Build and manage your team's roster while the roster window is open.",
    tips: [
      "League admins who also coach a team see My Roster in their menu too.",
      "Add players, set jersey numbers, then review everything carefully.",
      "Mark roster done locks the roster permanently — only your league admin can change it after that.",
      "If the window shows as closed, the roster deadline has passed — contact your league admin.",
    ],
  },
  {
    key: "coachinsights",
    title: "Coach Insights",
    category: "coach",
    roles: ["coach", "league_admin", "ops_admin", "app_admin"],
    summary:
      "What drives your wins: win vs loss comparisons, opponent scouting and player impact rankings.",
    tips: [
      "The Key Insight card shows the stat most strongly tied to your wins.",
      "Opponent Snapshot previews your next opponent's averages and top players.",
      "AI Tactical Briefing is limited to 10 briefings per month.",
    ],
  },
  {
    key: "whiteboard",
    title: "Whiteboard",
    category: "coach",
    roles: ["player", "coach", "league_admin", "app_admin"],
    summary: "A tactics board with draggable 5v5 markers on a half or full court.",
    tips: [
      "Purple markers are offense, red are defense — drag them anywhere.",
      "Use Undo to step back or Reset to start over.",
    ],
  },
  {
    key: "userrequests",
    title: "User Requests",
    category: "admin",
    roles: ["league_admin", "ops_admin", "app_admin"],
    summary:
      "Approve or reject people asking to join your league as a player, coach or viewer.",
    tips: [
      "Each league you manage gets its own approve/reject decision per request.",
      "Approved users receive a welcome email automatically.",
    ],
  },
  {
    key: "leagueusers",
    title: "League Users",
    category: "admin",
    roles: ["league_admin", "app_admin"],
    summary: "Everyone in your league and their roles, teams and access.",
    tips: [
      "Use this page to fix a user's role or team assignment.",
      "Coaches and players show an orange badge with their team.",
    ],
  },
  {
    key: "gamelog",
    title: "Game Log",
    category: "admin",
    roles: ["league_admin", "app_admin"],
    summary: "A history of recorded games for auditing and corrections.",
    tips: [
      "Use this to find a game that needs a score or stat correction.",
    ],
  },
  {
    key: "admintools",
    title: "Admin Tools",
    category: "admin",
    roles: ["league_admin", "app_admin"],
    summary: "Utilities for running your league day to day.",
    tips: [
      "Changes here affect live league data — double-check before saving.",
    ],
  },
  {
    key: "leaguegroups",
    title: "League Groups",
    category: "admin",
    roles: ["app_admin"],
    summary:
      "Group multiple seasons under one league name (for example Fin-Noy) and mark which season is current. Archived seasons stay fully browsable and are never deleted.",
    tips: [
      "A group can run several current seasons at the same time — use Archive when a season finishes and Make current to reactivate one.",
      "Removing a season from a group never deletes the league or its stats.",
      "Archived seasons are hidden from new signups and league applications — only current seasons appear in the pickers.",
      "Use the Create season button on a league card (Leagues page) to create the next season — optionally copying teams from a previous season, with or without rosters.",
    ],
  },
  {
    key: "registration",
    title: "Registration",
    category: "admin",
    roles: ["league_admin", "app_admin"],
    summary:
      "Sign-up links and codes for getting players and coaches into your league.",
    tips: [
      "Share the right link for the right role — coach links and codes are one-time use.",
      "Use Copy to grab a link and send it via WhatsApp, Messenger or email.",
    ],
  },
  {
    key: "awardsettings",
    title: "Award Settings",
    category: "admin",
    roles: ["league_admin", "app_admin"],
    summary:
      "Configure how season awards are calculated: categories, minimum games and eligibility.",
    tips: [
      "Changes apply immediately to Award Leaders.",
    ],
  },
  {
    key: "storybuilder",
    title: "Story Builder",
    category: "admin",
    roles: ["league_admin", "app_admin"],
    summary:
      "Create shareable recap stories and posts from your league's games and stats.",
    tips: [
      "Great for posting weekly recaps to your league's social media.",
    ],
  },
  {
    key: "gameoverlay",
    title: "Game Overlay",
    category: "video",
    roles: ["video_admin", "league_admin", "app_admin"],
    summary:
      "A live scoreboard overlay you can add on top of your game video stream.",
    tips: [
      "The overlay follows the live game as the scorer records plays.",
    ],
  },
  {
    key: "feedback",
    title: "Feedback",
    category: "main",
    roles: "all",
    summary: "Send ideas, bug reports or questions straight to the Courtside team.",
    tips: [
      "Include the page name and what you expected to happen — it helps us fix things faster.",
    ],
  },
];

export function getTopicsForRole(userType) {
  const role = userType || "viewer";
  return HELP_TOPICS.filter(
    (t) => t.roles === "all" || t.roles.includes(role)
  );
}

export function getHelpTopic(key) {
  return HELP_TOPICS.find((t) => t.key === key) || null;
}
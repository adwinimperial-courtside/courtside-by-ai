import React, { useMemo } from "react";

function getPts(s) { return (s.points_2||0)*2 + (s.points_3||0)*3 + (s.free_throws||0); }
function getReb(s) { return (s.offensive_rebounds||0) + (s.defensive_rebounds||0); }
function getAst(s) { return s.assists || 0; }
function getStl(s) { return s.steals || 0; }
function getBlk(s) { return s.blocks || 0; }

function isDoubleDouble(s) {
  return [getPts(s)>=10, getReb(s)>=10, getAst(s)>=10, getStl(s)>=10, getBlk(s)>=10].filter(Boolean).length >= 2;
}
function isTripleDouble(s) {
  return [getPts(s)>=10, getReb(s)>=10, getAst(s)>=10, getStl(s)>=10, getBlk(s)>=10].filter(Boolean).length >= 3;
}

export default function PlayerAchievements({ myStats, games, teamId, playerRecord }) {
  const achievements = useMemo(() => {
    if (!myStats.length) return [];

    const completedGames = games
      .filter(g => g.status === 'completed')
      .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));

    // Games the player appeared in, sorted newest first
    const playerGames = completedGames
      .map(g => ({ game: g, stat: myStats.find(s => s.game_id === g.id) }))
      .filter(x => !!x.stat);

    if (!playerGames.length) return [];

    const allStats = playerGames.map(x => x.stat);
    const last3 = playerGames.slice(0, 3);
    const gp = playerGames.length;

    // ── Season totals ──
    const totalPts = allStats.reduce((s, x) => s + getPts(x), 0);
    const totalReb = allStats.reduce((s, x) => s + getReb(x), 0);
    const totalAst = allStats.reduce((s, x) => s + getAst(x), 0);

    // ── BUCKET 1: Recent / official / big-game ──
    const bucket1 = [];

    // Player of the Game (official, from game.player_of_game field)
    const playerId = playerRecord?.id;
    const playerName = playerRecord?.name;
    if (playerId || playerName) {
      const pogGames = completedGames.filter(g =>
        g.player_of_game && (
          g.player_of_game === playerId ||
          (playerName && g.player_of_game.toLowerCase() === playerName.toLowerCase())
        )
      );
      if (pogGames.length > 0) {
        const lastCompletedPlayerGame = playerGames[0]?.game;
        const isLastGame = lastCompletedPlayerGame && pogGames[0]?.id === lastCompletedPlayerGame.id;
        bucket1.push({
          priority: 1,
          emoji: "🏆",
          label: isLastGame ? "Player of the Game (Last Match)" : `Player of the Game x${pogGames.length}`,
          bg: "bg-yellow-50",
          text: "text-yellow-700",
          border: "border-yellow-200",
        });
      }
    }

    // Triple Double (season count)
    const tripleDoubleCount = allStats.filter(isTripleDouble).length;
    if (tripleDoubleCount > 0) {
      bucket1.push({
        priority: 2,
        emoji: "💎",
        label: `Triple-Double x${tripleDoubleCount}`,
        bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200",
      });
    }

    // Double Double (season count)
    const doubleDoubleCount = allStats.filter(isDoubleDouble).length;
    if (doubleDoubleCount > 0) {
      bucket1.push({
        priority: 3,
        emoji: "📦",
        label: `Double-Double x${doubleDoubleCount}`,
        bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200",
      });
    }

    // 30 Point Explosion
    const thirtyPlusCount = allStats.filter(s => getPts(s) >= 30).length;
    if (thirtyPlusCount > 0) {
      bucket1.push({
        priority: 4,
        emoji: "💥",
        label: `30+ Point Game x${thirtyPlusCount}`,
        bg: "bg-red-50", text: "text-red-700", border: "border-red-200",
      });
    }

    // 20 Point Game
    const twentyPlusCount = allStats.filter(s => getPts(s) >= 20).length;
    if (twentyPlusCount > 0) {
      bucket1.push({
        priority: 5,
        emoji: "🔥",
        label: `20+ Point Games x${twentyPlusCount}`,
        bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200",
      });
    }

    // All Around Game
    const allAroundCount = allStats.filter(s => getPts(s)>=10 && getReb(s)>=5 && getAst(s)>=5).length;
    if (allAroundCount > 0) {
      bucket1.push({
        priority: 6,
        emoji: "⭐",
        label: `All-Around Game x${allAroundCount}`,
        bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200",
      });
    }

    // Defensive Wall (steals + blocks >= 5 in a game)
    const defensiveWallCount = allStats.filter(s => getStl(s) + getBlk(s) >= 5).length;
    if (defensiveWallCount > 0) {
      bucket1.push({
        priority: 7,
        emoji: "🛡️",
        label: `Defensive Wall x${defensiveWallCount}`,
        bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200",
      });
    }

    // Lockdown Game (steals >=3 or blocks >=3)
    const lockdownCount = allStats.filter(s => getStl(s) >= 3 || getBlk(s) >= 3).length;
    if (lockdownCount > 0 && defensiveWallCount === 0) {
      bucket1.push({
        priority: 7,
        emoji: "🔒",
        label: `Lockdown Game x${lockdownCount}`,
        bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200",
      });
    }

    bucket1.sort((a, b) => a.priority - b.priority);
    const best1 = bucket1[0] || null;

    // ── BUCKET 2: Streak achievements ──
    const bucket2 = [];

    if (last3.length === 3) {
      if (last3.every(x => getPts(x.stat) >= 10)) {
        bucket2.push({ emoji: "✅", label: "Scoring Streak — 10+ pts in 3 straight" });
      }
      if (last3.every(x => getAst(x.stat) >= 5)) {
        bucket2.push({ emoji: "🎯", label: "Playmaking Streak — 5+ ast in 3 straight" });
      }
      if (last3.every(x => getReb(x.stat) >= 8)) {
        bucket2.push({ emoji: "📈", label: "Rebounding Streak — 8+ reb in 3 straight" });
      }
      // Win streak
      const teamWon3 = last3.every(({ game }) => {
        if (!teamId) return false;
        const isHome = game.home_team_id === teamId;
        const mine = isHome ? game.home_score : game.away_score;
        const opp  = isHome ? game.away_score : game.home_score;
        return mine > opp;
      });
      if (teamWon3) {
        bucket2.push({ emoji: "🔥", label: "Winning Streak — 3 wins in a row" });
      }
    }

    const best2 = bucket2.map(b => ({ ...b, bg: "bg-green-50", text: "text-green-700", border: "border-green-200" }))[0] || null;

    // ── BUCKET 3: Season milestones ──
    const bucket3 = [];

    if (totalPts >= 200) bucket3.push({ emoji: "🌟", label: `200 Season Points` });
    else if (totalPts >= 100) bucket3.push({ emoji: "💯", label: `100 Season Points` });

    if (totalReb >= 50) bucket3.push({ emoji: "💪", label: `50 Season Rebounds` });
    if (totalAst >= 50) bucket3.push({ emoji: "🤝", label: `50 Season Assists` });
    if (gp >= 10) bucket3.push({ emoji: "🏅", label: `Iron Man — ${gp} games played` });

    const best3 = bucket3.map(b => ({ ...b, bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" }))[0] || null;

    return [best1, best2, best3].filter(Boolean).slice(0, 3);
  }, [myStats, games, teamId, playerRecord]);

  if (!achievements.length) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-amber-400 px-6 py-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Achievements</p>
      <div className="flex flex-wrap gap-3">
        {achievements.map((a, i) => (
          <div key={i} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 border ${a.bg} ${a.border} shadow-sm hover:shadow-md transition-shadow`}>
            <span className="text-lg leading-none">{a.emoji}</span>
            <span className={`text-sm font-semibold ${a.text}`}>{a.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
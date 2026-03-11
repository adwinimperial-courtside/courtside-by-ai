import React, { useMemo } from "react";

function getPts(s) { return (s.points_2||0)*2 + (s.points_3||0)*3 + (s.free_throws||0); }
function getReb(s) { return (s.offensive_rebounds||0) + (s.defensive_rebounds||0); }
function getAst(s) { return s.assists || 0; }
function getStl(s) { return s.steals || 0; }
function getBlk(s) { return s.blocks || 0; }

function avg(items, fn) {
  if (!items.length) return 0;
  return items.reduce((sum, x) => sum + fn(x.stat), 0) / items.length;
}

function computeTrend(myStats, games, teamId) {
  // Build sorted list of completed games player appeared in
  const completedGames = games
    .filter(g => g.status === 'completed')
    .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));

  const playerGames = completedGames
    .map(g => ({ game: g, stat: myStats.find(s => s.game_id === g.id) }))
    .filter(x => !!x.stat);

  if (playerGames.length < 2) return null;

  const last3 = playerGames.slice(0, 3);
  const all = playerGames;

  const sPPG = avg(all, getPts);
  const sRPG = avg(all, getReb);
  const sAPG = avg(all, getAst);
  const sSPG = avg(all, getStl);
  const sBPG = avg(all, getBlk);

  const l3PPG = avg(last3, getPts);
  const l3RPG = avg(last3, getReb);
  const l3APG = avg(last3, getAst);
  const l3SPG = avg(last3, getStl);
  const l3BPG = avg(last3, getBlk);

  const candidates = [];

  // ── Priority 1: Achievement trends ──

  // Double-double in 2 of last 3
  const isDD = x => [getPts(x.stat)>=10, getReb(x.stat)>=10, getAst(x.stat)>=10].filter(Boolean).length >= 2;
  const ddCount = last3.filter(isDD).length;
  if (ddCount >= 2) {
    candidates.push({ priority: 1, strength: 10, emoji: "📦", label: "Double-Double Run", description: `${ddCount} double-doubles in last 3 games` });
  }

  // 20+ points in last 2 straight
  const last2 = last3.slice(0, 2);
  if (last2.length === 2 && last2.every(x => getPts(x.stat) >= 20)) {
    candidates.push({ priority: 1, strength: 9, emoji: "🔥", label: "Scoring Streak", description: "20+ points in 2 straight games" });
  }

  // Season-high in last game
  if (all.length >= 2 && last3.length > 0) {
    const lastStat = last3[0].stat;
    const rest = all.slice(1);
    const maxPts = Math.max(...rest.map(x => getPts(x.stat)));
    const maxReb = Math.max(...rest.map(x => getReb(x.stat)));
    const maxAst = Math.max(...rest.map(x => getAst(x.stat)));
    const lPts = getPts(lastStat);
    const lReb = getReb(lastStat);
    const lAst = getAst(lastStat);
    if (lPts > maxPts && lPts >= 15) {
      candidates.push({ priority: 1, strength: 8, emoji: "🏆", label: "Season-High Points", description: `${lPts} pts — new season best` });
    } else if (lReb > maxReb && lReb >= 7) {
      candidates.push({ priority: 1, strength: 7, emoji: "🏆", label: "Season-High Rebounds", description: `${lReb} reb — new season best` });
    } else if (lAst > maxAst && lAst >= 5) {
      candidates.push({ priority: 1, strength: 6, emoji: "🏆", label: "Season-High Assists", description: `${lAst} ast — new season best` });
    }
  }

  // ── Priority 2: Improvement trends ──

  if (last3.length >= 2) {
    const ptsDiff = l3PPG - sPPG;
    if (ptsDiff >= 3 || (sPPG > 0 && l3PPG >= sPPG * 1.2)) {
      candidates.push({ priority: 2, strength: ptsDiff, emoji: "🔥", label: "Scoring Uptrend", description: `+${ptsDiff.toFixed(1)} PPG over last ${last3.length} games` });
    }

    const rebDiff = l3RPG - sRPG;
    if (rebDiff >= 2 || (sRPG > 0 && l3RPG >= sRPG * 1.25)) {
      candidates.push({ priority: 2, strength: rebDiff, emoji: "🧱", label: "Rebounding Surge", description: `${l3RPG.toFixed(1)} RPG in last ${last3.length} games` });
    }

    const astDiff = l3APG - sAPG;
    if (astDiff >= 1.5 || (sAPG > 0 && l3APG >= sAPG * 1.25)) {
      candidates.push({ priority: 2, strength: astDiff, emoji: "🎯", label: "Playmaking Trend", description: `${l3APG.toFixed(1)} APG in last ${last3.length} games` });
    }

    const stlDiff = l3SPG - sSPG;
    const stealsStreak = last3.every(x => getStl(x.stat) >= 1);
    if (stlDiff >= 0.8 || (last3.length === 3 && stealsStreak)) {
      candidates.push({ priority: 2, strength: stlDiff, emoji: "🛡️", label: "Defensive Activity", description: stealsStreak ? "steals in 3 straight games" : `+${stlDiff.toFixed(1)} SPG in last 3 games` });
    }

    const blkDiff = l3BPG - sBPG;
    const bigBlockGames = last3.filter(x => getBlk(x.stat) >= 2).length;
    if (blkDiff >= 0.8 || bigBlockGames >= 2) {
      candidates.push({ priority: 2, strength: blkDiff, emoji: "🚫", label: "Rim Protection", description: bigBlockGames >= 2 ? `2+ blocks in ${bigBlockGames} of last 3 games` : `+${blkDiff.toFixed(1)} BPG in last 3 games` });
    }
  }

  // ── Priority 3: Consistency streaks ──

  if (last3.length === 3) {
    if (last3.every(x => getPts(x.stat) >= 10)) {
      candidates.push({ priority: 3, strength: 3, emoji: "✅", label: "Consistency Trend", description: "10+ points in 3 straight games" });
    }
    if (last3.every(x => getReb(x.stat) >= 5)) {
      candidates.push({ priority: 3, strength: 2, emoji: "📈", label: "Rebounding Consistency", description: "5+ rebounds in 3 straight games" });
    }
    if (last3.every(x => getAst(x.stat) >= 4)) {
      candidates.push({ priority: 3, strength: 1, emoji: "📈", label: "Assist Consistency", description: "4+ assists in 3 straight games" });
    }
  }

  // ── Priority 4: Team win streak ──

  if (teamId && last3.length >= 3) {
    const teamWonAll = last3.every(({ game }) => {
      const isHome = game.home_team_id === teamId;
      const myScore = isHome ? game.home_score : game.away_score;
      const oppScore = isHome ? game.away_score : game.home_score;
      return myScore > oppScore;
    });
    if (teamWonAll) {
      candidates.push({ priority: 4, strength: 1, emoji: "🔥", label: "Winning Momentum", description: "team has won 3 straight with you active" });
    }
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : b.strength - a.strength);
  return candidates[0];
}

export default function PlayerTrendCard({ myStats, games, teamId }) {
  const trend = useMemo(() => computeTrend(myStats, games, teamId), [myStats, games, teamId]);

  if (!trend) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Current Trend</p>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{trend.emoji}</span>
        <div>
          <p className="text-sm font-bold text-slate-900">{trend.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{trend.description}</p>
        </div>
      </div>
    </div>
  );
}
import React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { isGameEligible } from "./statEngine";

// AWARD_MOVEMENT_V1 — rank and score movement since the league's last game day.
export const AWARD_MOVEMENT_VERSION = "AWARD_MOVEMENT_V1";

export function awardDayKey(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value).slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Returns the league's latest game day plus the game list WITHOUT that day.
// Returns null when the league has fewer than two game days (nothing to compare).
export function buildAwardBaseline({ league, teams, games }) {
  if (!league || !teams || !games) return null;
  const leagueTeamIds = new Set(teams.filter((t) => t.league_id === league.id).map((t) => t.id));
  const days = new Set();
  games.forEach((g) => {
    const inLeague = leagueTeamIds.has(g.home_team_id) || leagueTeamIds.has(g.away_team_id);
    if (inLeague && g.game_date && isGameEligible(g, "awards")) days.add(awardDayKey(g.game_date));
  });
  const sorted = [...days].sort();
  if (sorted.length < 2) return null;
  const lastDay = sorted[sorted.length - 1];
  return { lastDay, games: games.filter((g) => awardDayKey(g.game_date) !== lastDay) };
}

// Compares the current race with the baseline race (full list, not just top N).
export function buildAwardMovement(current, previous, scoreKey) {
  if (!current || !previous) return null;
  const prevByPlayer = new Map(previous.map((c, i) => [c.playerId, { rank: i + 1, score: c[scoreKey] }]));
  const out = {};
  current.forEach((c, i) => {
    const p = prevByPlayer.get(c.playerId);
    out[c.playerId] = p
      ? { isNew: false, rankDelta: p.rank - (i + 1), scoreDelta: c[scoreKey] - p.score }
      : { isNew: true, rankDelta: 0, scoreDelta: 0 };
  });
  return out;
}

export function formatAwardDay(dayKey) {
  if (!dayKey) return "";
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return dayKey;
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function RankMove({ move }) {
  if (!move) return null;
  if (move.isNew) {
    return (
      <span data-marker="AWARD_MOVEMENT_V1" className="text-[10px] font-semibold uppercase tracking-wide bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
        New
      </span>
    );
  }
  if (move.rankDelta > 0) {
    return (
      <span data-marker="AWARD_MOVEMENT_V1" className="inline-flex items-center text-xs font-semibold text-green-600">
        <ArrowUp className="w-3 h-3" />
        {move.rankDelta}
      </span>
    );
  }
  if (move.rankDelta < 0) {
    return (
      <span data-marker="AWARD_MOVEMENT_V1" className="inline-flex items-center text-xs font-semibold text-red-600">
        <ArrowDown className="w-3 h-3" />
        {Math.abs(move.rankDelta)}
      </span>
    );
  }
  return <span data-marker="AWARD_MOVEMENT_V1" className="text-xs text-slate-400">–</span>;
}

export function ScoreMove({ move, inline = false }) {
  if (!move || move.isNew) return null;
  const shown = Math.abs(move.scoreDelta).toFixed(2);
  const base = `${inline ? "" : "block "}text-xs font-semibold`;
  if (shown === "0.00") return <span data-marker="AWARD_MOVEMENT_V1" className={`${base} text-slate-400`}>±0.00</span>;
  if (move.scoreDelta > 0) return <span data-marker="AWARD_MOVEMENT_V1" className={`${base} text-green-600`}>+{shown}</span>;
  return <span data-marker="AWARD_MOVEMENT_V1" className={`${base} text-red-600`}>−{shown}</span>;
}
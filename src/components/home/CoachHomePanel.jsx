import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, isToday, isTomorrow } from "date-fns";
import { ChevronRight, ClipboardList, Target, BarChart3, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildPlayerAggregates,
  buildGameFormatMap,
  calcPoints,
} from "@/components/stats/statEngine";
import { useLeagueStatsData } from "@/components/stats/useLeagueStatsData";

// COACH_HOME_SLATE_V1 — "Midnight Slate" dark redesign of the coach home.
// Renders only for user_type === 'coach' (gated by Landing.jsx). All data
// logic is carried over from COACH_HOME_V1 unchanged: record + standing use
// the SAME algorithm as the Standings page (default-game aware, win% with
// head-to-head / points-diff tiebreaks); per-player averages come from the
// shared stat engine with per-game points-format detection. New in this
// version: opponent scouting on the next-game card (their last 3 results,
// scoring average, record), a last-result card that deep-links to the box
// score (query param appended OUTSIDE createPageUrl so gameId keeps its
// camelCase and is readable by LiveBoxScore), and a current win/loss streak.

const BG = "#111820";
const DEEP = "#0D141B";
const CARD = "#19232D";
const RAISED = "#202C37";
const BORDER = "#34424E";
const STEEL = "#5B7FA3";
const BTN_BLUE = "#315D85";
const IVORY = "#F1F0EC";
const MUTED = "#AAB4BD";
const SAGE = "#6FA184";
const COPPER = "#B7895B";
const BRICK = "#B76560";

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Win/loss for a team in one completed game (default-aware), or null if neither.
function gameResultFor(game, teamId) {
  if (game.is_default_result) {
    if (game.default_winner_team_id === teamId) return "W";
    if (game.default_loser_team_id === teamId) return "L";
    return null;
  }
  const isHome = game.home_team_id === teamId;
  const ts = isHome ? (game.home_score || 0) : (game.away_score || 0);
  const os = isHome ? (game.away_score || 0) : (game.home_score || 0);
  return ts > os ? "W" : "L";
}

// Faithful port of TeamStandings ranking so "Nth in league" matches that page.
function computeStandings(teams, games) {
  const completedForTeam = (id) => games.filter((g) => g.status === "completed" && (g.home_team_id === id || g.away_team_id === id));

  const base = (teams || []).map((team) => {
    let wins = 0, losses = 0, pf = 0, pa = 0;
    completedForTeam(team.id).forEach((g) => {
      const r = gameResultFor(g, team.id);
      if (r === "W") wins++; else if (r === "L") losses++;
      if (!g.is_default_result) {
        if (g.home_team_id === team.id) { pf += g.home_score || 0; pa += g.away_score || 0; }
        else { pf += g.away_score || 0; pa += g.home_score || 0; }
      }
    });
    const total = wins + losses;
    const winPct = total > 0 ? parseFloat((wins / total * 100).toFixed(1)) : 0;
    return { ...team, wins, losses, winPct, pointsDiff: pf - pa };
  });

  const miniStats = (teamId, subGames) => {
    let wins = 0, losses = 0, pf = 0, pa = 0;
    subGames.forEach((g) => {
      if (g.home_team_id !== teamId && g.away_team_id !== teamId) return;
      const r = gameResultFor(g, teamId);
      if (r === "W") wins++; else if (r === "L") losses++;
      if (!g.is_default_result) {
        const isHome = g.home_team_id === teamId;
        pf += isHome ? (g.home_score || 0) : (g.away_score || 0);
        pa += isHome ? (g.away_score || 0) : (g.home_score || 0);
      }
    });
    const total = wins + losses;
    return { winPct: total > 0 ? wins / total : 0, diff: pf - pa };
  };

  const sortTied = (group) => {
    if (group.length <= 1) return group;
    if (group.length === 2) {
      const [a, b] = group;
      const h2h = games.filter((g) => g.status === "completed" &&
        ((g.home_team_id === a.id && g.away_team_id === b.id) || (g.home_team_id === b.id && g.away_team_id === a.id)));
      const sa = miniStats(a.id, h2h), sb = miniStats(b.id, h2h);
      if (sb.winPct !== sa.winPct) return sb.winPct > sa.winPct ? [b, a] : [a, b];
      return b.pointsDiff >= a.pointsDiff ? [b, a] : [a, b];
    }
    return [...group].sort((a, b) => b.pointsDiff - a.pointsDiff);
  };

  const sorted = [];
  const seen = new Set();
  const byWinPct = [...base].sort((a, b) => b.winPct - a.winPct);
  byWinPct.forEach((team) => {
    if (seen.has(team.id)) return;
    const group = byWinPct.filter((t) => t.winPct === team.winPct);
    group.forEach((t) => seen.add(t.id));
    sortTied(group).forEach((t) => sorted.push(t));
  });
  return sorted;
}

function Shell({ children }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: BG }}>
      <div className="max-w-md md:max-w-4xl mx-auto px-4 pt-5 pb-2">{children}</div>
    </div>
  );
}

function Eyebrow({ children, color }) {
  return (
    <div className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: color || MUTED }}>
      {children}
    </div>
  );
}

function SlateCard({ children, onClick, className = "" }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`rounded-xl p-3.5 ${onClick ? "w-full text-left" : ""} ${className}`}
      style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
    >
      {children}
    </Tag>
  );
}

function StatsBar() {
  const items = [
    { n: "900+", l: "Games" },
    { n: "30+", l: "Leagues" },
    { n: "250+", l: "Users" },
    { n: "200+", l: "Teams" },
  ];
  return (
    <div className="mt-3 mb-4">
      <div className="rounded-xl px-2 pt-3 pb-2.5 flex text-center" style={{ backgroundColor: DEEP }}>
        {items.map((s, i) => (
          <div key={i} className="flex-1" style={i > 0 ? { borderLeft: `1px solid ${BORDER}` } : undefined}>
            <div className="text-[17px] font-bold leading-none" style={{ color: STEEL }}>{s.n}</div>
            <div className="text-[10px] mt-1" style={{ color: MUTED }}>{s.l}</div>
          </div>
        ))}
      </div>
      <p className="text-center text-[10px] tracking-[0.06em] mt-2.5" style={{ color: MUTED }}>
        POWERED BY COURTSIDE BY AI · NUMBERS DON'T LIE
      </p>
    </div>
  );
}

function WatchRow({ initials, name, sub, pillText, hot, isLast }) {
  return (
    <div className="flex items-center gap-2.5 py-2" style={!isLast ? { borderBottom: `1px solid ${BORDER}` } : undefined}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] flex-shrink-0" style={{ backgroundColor: RAISED, color: MUTED }}>
        {initials}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-medium truncate" style={{ color: IVORY }}>{name}</div>
        <div className="text-[11px] truncate" style={{ color: MUTED }}>{sub}</div>
      </div>
      <span
        className="ml-auto flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
        style={hot
          ? { backgroundColor: "rgba(91,127,163,0.16)", color: STEEL }
          : { backgroundColor: "rgba(111,161,132,0.14)", color: SAGE }}
      >
        {pillText}
      </span>
    </div>
  );
}

export default function CoachHomePanel({ currentUser }) {
  const navigate = useNavigate();
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [overrideTeamId, setOverrideTeamId] = useState(null);
  const go = (page) => navigate(createPageUrl(page));

  const { data: allLeagues = [], isLoading: leaguesLoading } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
    enabled: !!currentUser,
  });

  const userLeagues = useMemo(() => {
    if (!allLeagues.length || !currentUser?.assigned_league_ids?.length) return [];
    return allLeagues.filter((l) => currentUser.assigned_league_ids.includes(l.id));
  }, [allLeagues, currentUser]);

  useEffect(() => {
    if (userLeagues.length > 0 && !selectedLeagueId) {
      setSelectedLeagueId(currentUser?.default_league_id && userLeagues.some((l) => l.id === currentUser.default_league_id)
        ? currentUser.default_league_id
        : userLeagues[0].id);
    }
  }, [userLeagues, selectedLeagueId, currentUser]);

  useEffect(() => {
    let saved = null;
    try { if (currentUser?.id && selectedLeagueId) saved = localStorage.getItem(`coachTeam:${currentUser.id}:${selectedLeagueId}`); } catch (_e) {}
    setOverrideTeamId(saved || null);
  }, [selectedLeagueId, currentUser?.id]);

  const { teams, players, games, stats, isLoading } = useLeagueStatsData(selectedLeagueId);

  const selectedLeague = useMemo(() => allLeagues.find((l) => l.id === selectedLeagueId) || null, [allLeagues, selectedLeagueId]);

  const linkedTeamId = useMemo(() => {
    const pairs = currentUser?.league_team_pairs || [];
    const p = pairs.find((pp) => pp && pp.league_id === selectedLeagueId);
    return p?.team_id || null;
  }, [currentUser, selectedLeagueId]);

  const teamId = overrideTeamId || linkedTeamId;
  const currentTeam = useMemo(() => teams.find((t) => t.id === teamId) || null, [teams, teamId]);

  const formatMap = useMemo(() => buildGameFormatMap(games, stats), [games, stats]);
  const aggregates = useMemo(() => buildPlayerAggregates({ players, teams, games, stats }), [players, teams, games, stats]);
  const ppgById = useMemo(() => {
    const m = new Map();
    aggregates.forEach((a) => m.set(a.id, a.ppg));
    return m;
  }, [aggregates]);

  const teamCompleted = useMemo(() => {
    if (!teamId) return [];
    return games
      .filter((g) => g.status === "completed" && (g.home_team_id === teamId || g.away_team_id === teamId))
      .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));
  }, [games, teamId]);

  const record = useMemo(() => {
    let wins = 0, losses = 0, pf = 0, pa = 0, played = 0;
    teamCompleted.forEach((g) => {
      const r = gameResultFor(g, teamId);
      if (r === "W") wins++; else if (r === "L") losses++;
      if (!g.is_default_result) {
        const isHome = g.home_team_id === teamId;
        pf += isHome ? (g.home_score || 0) : (g.away_score || 0);
        pa += isHome ? (g.away_score || 0) : (g.home_score || 0);
        played++;
      }
    });
    return {
      wins, losses,
      ppg: played ? pf / played : 0,
      oppPpg: played ? pa / played : 0,
      played,
    };
  }, [teamCompleted, teamId]);

  const standing = useMemo(() => {
    if (!teamId || !teams.length) return null;
    const sorted = computeStandings(teams, games);
    const idx = sorted.findIndex((t) => t.id === teamId);
    if (idx < 0) return null;
    if ((sorted[idx].wins + sorted[idx].losses) === 0) return null;
    return { rank: idx + 1, total: sorted.length };
  }, [teams, games, teamId]);

  // COACH_HOME_SLATE_V1: current W/L streak, e.g. "W3" or "L2".
  const streak = useMemo(() => {
    if (!teamCompleted.length || !teamId) return null;
    const first = gameResultFor(teamCompleted[0], teamId);
    if (!first) return null;
    let n = 0;
    for (const g of teamCompleted) {
      if (gameResultFor(g, teamId) === first) n++;
      else break;
    }
    return `${first}${n}`;
  }, [teamCompleted, teamId]);

  const nextGame = useMemo(() => {
    if (!teamId || !games.length) return null;
    const now = new Date();
    return games
      .filter((g) => (g.home_team_id === teamId || g.away_team_id === teamId) && g.status === "scheduled" && new Date(g.game_date) >= now)
      .sort((a, b) => new Date(a.game_date) - new Date(b.game_date))[0] || null;
  }, [games, teamId]);

  // COACH_HOME_SLATE_V1: opponent scouting for the next game — their last 3
  // results (oldest -> newest), scoring average (default games excluded), and
  // overall record. Computed from the league-wide game list already fetched.
  const oppScout = useMemo(() => {
    if (!nextGame || !teamId) return null;
    const oppId = nextGame.home_team_id === teamId ? nextGame.away_team_id : nextGame.home_team_id;
    if (!oppId) return null;
    const oppCompleted = games
      .filter((g) => g.status === "completed" && (g.home_team_id === oppId || g.away_team_id === oppId))
      .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));
    let wins = 0, losses = 0, pf = 0, played = 0;
    oppCompleted.forEach((g) => {
      const r = gameResultFor(g, oppId);
      if (r === "W") wins++; else if (r === "L") losses++;
      if (!g.is_default_result) {
        pf += g.home_team_id === oppId ? (g.home_score || 0) : (g.away_score || 0);
        played++;
      }
    });
    const last3 = oppCompleted.slice(0, 3).map((g) => gameResultFor(g, oppId)).filter(Boolean).reverse();
    return { last3, ppg: played ? pf / played : 0, wins, losses, hasGames: wins + losses > 0 };
  }, [nextGame, teamId, games]);

  const watch = useMemo(() => {
    if (!teamId) return { hot: null, improved: null };
    const teamPlayers = players.filter((p) => p.team_id === teamId);

    let hot = null;
    const lastPlayed = teamCompleted.find((g) => !g.is_default_result);
    if (lastPlayed) {
      let best = null;
      teamPlayers.forEach((p) => {
        const line = stats.find((s) => s.game_id === lastPlayed.id && s.player_id === p.id && s.team_id === teamId);
        if (!line) return;
        const pts = calcPoints(line, lastPlayed, formatMap[lastPlayed.id]);
        if (!best || pts > best.pts) best = { player: p, pts };
      });
      if (best && best.pts > 0) {
        const avg = ppgById.get(best.player.id) || 0;
        hot = { player: best.player, pts: best.pts, delta: Math.round(best.pts - avg) };
      }
    }

    let improved = null;
    const playedGames = teamCompleted.filter((g) => !g.is_default_result);
    const playedAsc = [...playedGames].sort((a, b) => new Date(a.game_date) - new Date(b.game_date));
    teamPlayers.forEach((p) => {
      const lines = playedAsc
        .map((g) => {
          const line = stats.find((s) => s.game_id === g.id && s.player_id === p.id && s.team_id === teamId);
          return line ? calcPoints(line, g, formatMap[g.id]) : null;
        })
        .filter((v) => v !== null);
      if (lines.length < 3) return;
      const last3 = lines.slice(-3);
      const last3Avg = last3.reduce((s, v) => s + v, 0) / last3.length;
      const season = ppgById.get(p.id) || 0;
      const jump = last3Avg - season;
      if (hot && p.id === hot.player.id) return;
      if (jump > 0 && (!improved || jump > improved.jump)) {
        improved = { player: p, jump: Math.round(jump * 10) / 10 };
      }
    });

    return { hot, improved };
  }, [players, teamId, teamCompleted, stats, formatMap, ppgById]);

  const firstName = currentUser?.full_name?.split(" ")[0] || null;
  const initial = currentUser?.full_name?.[0]?.toUpperCase() || "C";
  const initialsOf = (name) => (name || "").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  const loading = leaguesLoading || !selectedLeagueId || isLoading;
  const noLeague = !leaguesLoading && allLeagues.length > 0 && userLeagues.length === 0;
  const needsTeam = !loading && !noLeague && !teamId;

  const heroChip = standing ? `${ordinal(standing.rank)} of ${standing.total}` : "Coach";

  const resultLetterColor = (r) => (r === "W" ? SAGE : BRICK);

  // ---- Cards ----

  const NextGameCard = (
    <SlateCard className="mb-2.5">
      {nextGame ? (() => {
        const isHome = nextGame.home_team_id === teamId;
        const oppId = isHome ? nextGame.away_team_id : nextGame.home_team_id;
        const opp = teams.find((t) => t.id === oppId);
        const d = new Date(nextGame.game_date);
        const dayDiff = Math.round((new Date(d.toDateString()) - new Date(new Date().toDateString())) / 86400000);
        const when = isToday(d) ? "TODAY" : isTomorrow(d) ? "TOMORROW" : `IN ${dayDiff} DAYS`;
        return (
          <>
            <Eyebrow color={COPPER}>Next game · {format(d, "EEE HH:mm")} · {when}</Eyebrow>
            <div className="text-[16px] font-semibold" style={{ color: IVORY }}>
              vs {opp?.name || "TBD"} <span className="text-[11px] font-normal" style={{ color: MUTED }}>· {isHome ? "home" : "away"}</span>
            </div>
            {oppScout?.hasGames && (
              <div className="flex gap-4 mt-2.5">
                <div>
                  <div className="text-[9.5px] tracking-[0.08em] uppercase" style={{ color: MUTED }}>Last 3 games</div>
                  <div className="text-[13px] font-semibold mt-0.5">
                    {oppScout.last3.map((r, i) => (
                      <span key={i} style={{ color: resultLetterColor(r) }}>{r}{i < oppScout.last3.length - 1 ? " " : ""}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[9.5px] tracking-[0.08em] uppercase" style={{ color: MUTED }}>Scoring</div>
                  <div className="text-[13px] font-semibold mt-0.5" style={{ color: IVORY }}>{oppScout.ppg.toFixed(1)} ppg</div>
                </div>
                <div>
                  <div className="text-[9.5px] tracking-[0.08em] uppercase" style={{ color: MUTED }}>Record</div>
                  <div className="text-[13px] font-semibold mt-0.5" style={{ color: IVORY }}>{oppScout.wins}–{oppScout.losses}</div>
                </div>
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => go("CoachInsights")}
                className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold py-2 rounded-lg"
                style={{ backgroundColor: BTN_BLUE, color: IVORY }}
              >
                <Target className="w-4 h-4" /> Open insights
              </button>
              <button
                onClick={() => go("Statistics")}
                className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold py-2 rounded-lg"
                style={{ border: `1px solid ${BORDER}`, color: MUTED, backgroundColor: "transparent" }}
              >
                <BarChart3 className="w-4 h-4" /> View stats
              </button>
            </div>
          </>
        );
      })() : (
        <>
          <Eyebrow color={COPPER}>Next game</Eyebrow>
          <p className="text-sm" style={{ color: MUTED }}>No upcoming games scheduled.</p>
        </>
      )}
    </SlateCard>
  );

  const lastGame = teamCompleted[0] || null;
  const LastResultCard = (() => {
    if (!lastGame) {
      return (
        <SlateCard className="h-full">
          <Eyebrow>Last result</Eyebrow>
          <p className="text-sm" style={{ color: MUTED }}>No games played yet.</p>
        </SlateCard>
      );
    }
    const r = gameResultFor(lastGame, teamId);
    const isHome = lastGame.home_team_id === teamId;
    const oppId = isHome ? lastGame.away_team_id : lastGame.home_team_id;
    const opp = teams.find((t) => t.id === oppId);
    const ts = isHome ? (lastGame.home_score || 0) : (lastGame.away_score || 0);
    const os = isHome ? (lastGame.away_score || 0) : (lastGame.home_score || 0);
    const tappable = !lastGame.is_default_result;
    // Query param is appended OUTSIDE createPageUrl on purpose: createPageUrl
    // lowercases whole URL strings, which would break LiveBoxScore's
    // case-sensitive 'gameId' param read.
    const openBox = () => navigate(`${createPageUrl("LiveBoxScore")}?gameId=${lastGame.id}`);
    return (
      <SlateCard className="h-full" onClick={tappable ? openBox : undefined}>
        <Eyebrow>Last result</Eyebrow>
        <div className="text-[15px] font-semibold" style={{ color: resultLetterColor(r) }}>
          {r} {lastGame.is_default_result ? "(forfeit)" : `${ts}–${os}`}
        </div>
        <div className="text-[11px] mt-0.5 truncate" style={{ color: MUTED }}>vs {opp?.name || "Unknown"}</div>
        {tappable && <div className="text-[10px] mt-1.5" style={{ color: STEEL }}>Tap for box score</div>}
      </SlateCard>
    );
  })();

  const RecordCard = (
    <SlateCard className="h-full">
      <Eyebrow>Record</Eyebrow>
      <div className="text-[15px] font-semibold" style={{ color: IVORY }}>
        {record.wins}–{record.losses}
        {streak && <span className="text-[11px] font-semibold ml-1.5" style={{ color: COPPER }}>· {streak}</span>}
      </div>
      <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>
        {record.played > 0 ? `${record.ppg.toFixed(1)} for · ${record.oppPpg.toFixed(1)} against` : "No scored games yet"}
      </div>
    </SlateCard>
  );

  const WatchCard = (
    <SlateCard className="h-full">
      <Eyebrow>Players to watch</Eyebrow>
      {watch.hot || watch.improved ? (
        <div>
          {watch.hot && (
            <WatchRow
              initials={initialsOf(watch.hot.player.name)}
              name={watch.hot.player.name}
              sub={`${watch.hot.pts} pts last game`}
              pillText={`${watch.hot.delta >= 0 ? "+" : ""}${watch.hot.delta} vs avg`}
              hot
              isLast={!watch.improved}
            />
          )}
          {watch.improved && (
            <WatchRow
              initials={initialsOf(watch.improved.player.name)}
              name={watch.improved.player.name}
              sub="Most improved · last 3 games"
              pillText={`+${watch.improved.jump} ppg`}
              isLast
            />
          )}
        </div>
      ) : (
        <p className="text-sm" style={{ color: MUTED }}>Once your team plays a few games, your standout performers show up here.</p>
      )}
    </SlateCard>
  );

  const quickActions = [
    { icon: ClipboardList, t: "Roster", p: "CoachRoster" },
    { icon: Target, t: "Insights", p: "CoachInsights" },
    { icon: BarChart3, t: "Stats", p: "Statistics" },
    { icon: Calendar, t: "Schedule", p: "Schedule" },
  ];

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0" style={{ backgroundColor: BTN_BLUE, color: IVORY }}>
            {initial}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] leading-none truncate" style={{ color: MUTED }}>
              Coach{currentTeam ? ` · ${currentTeam.name}` : ""}
            </div>
            <div className="text-[16px] font-semibold leading-tight truncate mt-0.5" style={{ color: IVORY }}>
              {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
            </div>
          </div>
        </div>
        <div
          className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full flex-shrink-0"
          style={standing
            ? { backgroundColor: "rgba(183,137,91,0.14)", color: COPPER, border: "1px solid rgba(183,137,91,0.45)" }
            : { backgroundColor: RAISED, color: MUTED, border: `1px solid ${BORDER}` }}
        >
          {heroChip}
        </div>
      </div>

      {/* League picker */}
      <div className="mb-3">
        {userLeagues.length > 1 ? (
          <Select value={selectedLeagueId || ""} onValueChange={setSelectedLeagueId}>
            <SelectTrigger
              className="w-full md:w-auto md:min-w-[18rem] text-sm font-semibold rounded-xl h-auto py-2"
              style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, color: IVORY }}
            >
              <SelectValue placeholder="Choose a league" />
            </SelectTrigger>
            <SelectContent>
              {userLeagues.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}{l.season ? ` — ${l.season}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, color: IVORY }}>
            {selectedLeague?.name || "Your league"}
          </div>
        )}
      </div>

      {noLeague ? (
        <SlateCard className="text-center">
          <p className="text-sm py-3" style={{ color: MUTED }}>
            You're not assigned to a league yet. Once a league organizer adds you, your team's dashboard will show up here.
          </p>
        </SlateCard>
      ) : loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl p-3.5" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
              <div className="h-3 w-20 rounded mb-3" style={{ backgroundColor: RAISED }} />
              <div className="h-7 w-full rounded" style={{ backgroundColor: RAISED }} />
            </div>
          ))}
        </div>
      ) : needsTeam ? (
        <SlateCard>
          <Eyebrow>Pick your team</Eyebrow>
          <p className="text-sm mb-3" style={{ color: MUTED }}>We couldn't find a team linked to your coach account in this league. Choose your team to see its dashboard.</p>
          <Select value={overrideTeamId || ""} onValueChange={(v) => { setOverrideTeamId(v); try { if (currentUser?.id && selectedLeagueId) localStorage.setItem(`coachTeam:${currentUser.id}:${selectedLeagueId}`, v); } catch (_e) {} }}>
            <SelectTrigger className="w-full" style={{ backgroundColor: RAISED, border: `1px solid ${BORDER}`, color: IVORY }}>
              <SelectValue placeholder="Choose your team" />
            </SelectTrigger>
            <SelectContent>
              {[...teams].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SlateCard>
      ) : (
        <>
          <div className="md:grid md:grid-cols-2 md:gap-2.5 md:items-start mb-2.5">
            <div>
              {NextGameCard}
              <div className="flex gap-2.5">
                <div className="flex-1">{LastResultCard}</div>
                <div className="flex-1">{RecordCard}</div>
              </div>
            </div>
            <div className="mt-2.5 md:mt-0 md:h-full">
              {WatchCard}
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mb-1">
            {quickActions.map((q) => (
              <button
                key={q.p}
                onClick={() => go(q.p)}
                className="flex-1 rounded-xl py-2.5 text-center transition-colors"
                style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
              >
                <q.icon className="w-[18px] h-[18px] mx-auto" style={{ color: STEEL }} />
                <div className="text-[10px] font-semibold mt-1" style={{ color: MUTED }}>{q.t}</div>
              </button>
            ))}
          </div>
        </>
      )}

      <StatsBar />
    </Shell>
  );
}
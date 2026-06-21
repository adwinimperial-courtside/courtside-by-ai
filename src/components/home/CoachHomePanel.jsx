import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, isToday, isTomorrow } from "date-fns";
import { ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildPlayerAggregates,
  buildGameFormatMap,
  calcPoints,
} from "@/components/stats/statEngine";
import { useLeagueStatsData } from "@/components/stats/useLeagueStatsData";

// COACH_HOME_V1 — Responsive "cockpit" home for coaches: single column on
// phones, two columns on iPad/laptop (>=md). Renders only for user_type ===
// 'coach' (gated by Landing.jsx). Record + league standing are computed with
// the SAME algorithm as the Standings page (default-game aware, win% with
// head-to-head / points-diff tiebreaks). Team scoring comes from game scores;
// per-player season averages come from the shared stat engine. The coach's team
// is read from their league_team_pairs; if none is linked, a team picker is shown.

const NAVY = "#0B1F3A";
const ORANGE = "#F26B1F";

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
    <div className="min-h-screen" style={{ backgroundColor: "#f1f5f9" }}>
      <div className="max-w-md md:max-w-4xl mx-auto px-4 pt-5 pb-2">{children}</div>
    </div>
  );
}

function Eyebrow({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <span className="text-[10px] font-extrabold tracking-[0.12em] uppercase text-slate-400">{children}</span>
      {right}
    </div>
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
    <div className="mt-1 -mx-4 px-4 pt-4 pb-6 bg-slate-50 border-t border-slate-200">
      <div className="flex text-center max-w-md md:max-w-2xl mx-auto">
        {items.map((s, i) => (
          <div key={i} className={`flex-1 ${i > 0 ? "border-l border-slate-200" : ""}`}>
            <div className="text-[22px] font-black leading-none" style={{ color: ORANGE }}>{s.n}</div>
            <div className="text-[10.5px] text-slate-500 mt-1">{s.l}</div>
          </div>
        ))}
      </div>
      <p className="text-center text-[10px] text-slate-400 tracking-[0.04em] mt-3">
        POWERED BY COURTSIDE BY AI · NUMBERS DON'T LIE
      </p>
    </div>
  );
}

function WatchRow({ initials, name, sub, pillText, hot }) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-b last:border-b-0 border-slate-100">
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-extrabold text-[13px] flex-shrink-0" style={{ backgroundColor: NAVY }}>
        {initials}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-slate-900 truncate">{name}</div>
        <div className="text-[11px] text-slate-500 truncate">{sub}</div>
      </div>
      <span
        className="ml-auto flex-shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full"
        style={hot ? { backgroundColor: "#FEF0E7", color: ORANGE } : { backgroundColor: "#DCFCE7", color: "#16A34A" }}
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

  // Reset any manual team override when the league changes.
  useEffect(() => { setOverrideTeamId(null); }, [selectedLeagueId]);

  const { teams, players, games, stats, isLoading } = useLeagueStatsData(selectedLeagueId);

  const selectedLeague = useMemo(() => allLeagues.find((l) => l.id === selectedLeagueId) || null, [allLeagues, selectedLeagueId]);

  // The coach's team for this league comes from their league_team_pairs.
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

  // Completed games involving this team (default games included for W/L).
  const teamCompleted = useMemo(() => {
    if (!teamId) return [];
    return games
      .filter((g) => g.status === "completed" && (g.home_team_id === teamId || g.away_team_id === teamId))
      .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));
  }, [games, teamId]);

  // Record + scoring (scoring excludes default games, matching Standings).
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
      diff: played ? (pf - pa) / played : 0,
      played,
    };
  }, [teamCompleted, teamId]);

  const standing = useMemo(() => {
    if (!teamId || !teams.length) return null;
    const sorted = computeStandings(teams, games);
    const idx = sorted.findIndex((t) => t.id === teamId);
    if (idx < 0) return null;
    if ((sorted[idx].wins + sorted[idx].losses) === 0) return null; // no decided games yet -> no real standing
    return { rank: idx + 1, total: sorted.length };
  }, [teams, games, teamId]);

  // Last 5 results (oldest -> newest) for the form strip.
  const form = useMemo(
    () => teamCompleted.slice(0, 5).map((g) => gameResultFor(g, teamId)).filter(Boolean).reverse(),
    [teamCompleted, teamId]
  );

  // Next scheduled game.
  const nextGame = useMemo(() => {
    if (!teamId || !games.length) return null;
    const now = new Date();
    return games
      .filter((g) => (g.home_team_id === teamId || g.away_team_id === teamId) && g.status === "scheduled" && new Date(g.game_date) >= now)
      .sort((a, b) => new Date(a.game_date) - new Date(b.game_date))[0] || null;
  }, [games, teamId]);

  // Players to watch: top scorer in the team's last game (hot) + most improved
  // (last-3-game scoring average vs season average).
  const watch = useMemo(() => {
    if (!teamId) return { hot: null, improved: null };
    const teamPlayers = players.filter((p) => p.team_id === teamId);

    // Hot — top scorer in the most recent played game.
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

    // Most improved — biggest jump in last-3 scoring vs season average (>=3 games).
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
      if (hot && p.id === hot.player.id) return; // don't repeat the hot player
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

  const heroChip = standing ? `${ordinal(standing.rank)} in league` : "Coach";

  // ---- Cards ----

  const KpiCard = (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
      <div className="flex text-center">
        {[{ v: record.ppg, l: "Team PPG" }, { v: record.oppPpg, l: "Opp PPG" }, { v: record.diff, l: "Diff", signed: true }].map((k, i) => (
          <div key={i} className={`flex-1 ${i > 0 ? "border-l border-slate-100" : ""}`}>
            <div className="text-[24px] font-black leading-none tracking-tight" style={{ color: record.played ? NAVY : "#94a3b8" }}>
              {record.played ? `${k.signed && k.v >= 0 ? "+" : ""}${k.v.toFixed(1)}` : "—"}
            </div>
            <div className="text-[11px] text-slate-500 mt-1.5 font-semibold">{k.l}</div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-slate-500 text-center mt-2.5 pt-2.5 border-t border-slate-100">
        {currentTeam?.name || "Your team"}{record.played ? ` · ${record.played} game${record.played !== 1 ? "s" : ""}` : ""}
      </div>
    </div>
  );

  const RecordCard = (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <Eyebrow>Record</Eyebrow>
      <div className="flex items-center gap-4">
        <div className="text-[38px] font-black leading-none tracking-tight" style={{ color: NAVY }}>{record.wins}–{record.losses}</div>
        <div className="flex-1">
          {standing && (
            <span className="inline-block text-[11px] font-extrabold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: "#FFF7ED", border: "1px solid #FED7AA", color: "#9a3412" }}>
              {ordinal(standing.rank)} of {standing.total} teams
            </span>
          )}
          {form.length > 0 && (
            <>
              <div className="text-[10px] font-extrabold tracking-[0.06em] uppercase text-slate-400 mt-2.5 mb-1.5">Last {form.length}</div>
              <div className="flex gap-1.5">
                {form.map((r, i) => (
                  <span key={i} className="w-[18px] h-[18px] rounded-[5px] text-[10px] font-extrabold text-white flex items-center justify-center" style={{ backgroundColor: r === "W" ? "#16A34A" : "#DC2626" }}>{r}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const WatchCard = (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 h-full">
      <Eyebrow>Players to watch</Eyebrow>
      {watch.hot || watch.improved ? (
        <div>
          {watch.hot && (
            <WatchRow
              initials={initialsOf(watch.hot.player.name)}
              name={watch.hot.player.name}
              sub={`${watch.hot.pts} pts last game`}
              pillText={`🔥 ${watch.hot.delta >= 0 ? "+" : ""}${watch.hot.delta} vs avg`}
              hot
            />
          )}
          {watch.improved && (
            <WatchRow
              initials={initialsOf(watch.improved.player.name)}
              name={watch.improved.player.name}
              sub="Most improved · last 3 games"
              pillText={`▲ +${watch.improved.jump} PPG`}
            />
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Once your team plays a few games, your standout performers show up here.</p>
      )}
    </div>
  );

  const NextGameCard = (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      {nextGame ? (() => {
        const isHome = nextGame.home_team_id === teamId;
        const oppId = isHome ? nextGame.away_team_id : nextGame.home_team_id;
        const opp = teams.find((t) => t.id === oppId);
        const d = new Date(nextGame.game_date);
        const dateLabel = isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEE, MMM d");
        return (
          <button className="w-full text-left" onClick={() => go("Schedule")}>
            <Eyebrow>Next game</Eyebrow>
            <div className="text-[15px] font-extrabold text-slate-900">{dateLabel} · {format(d, "HH:mm")}</div>
            <div className="text-[13px] text-slate-600 mt-0.5">{currentTeam?.name || "Your team"} vs {opp?.name || "TBD"}</div>
            <div className="text-[11.5px] text-slate-400 mt-0.5">{isHome ? "🏠 Home" : "🚌 Away"}</div>
            <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#FFF7ED", border: "1px solid #FED7AA", color: ORANGE }} onClick={(e) => { e.stopPropagation(); go("CoachInsights"); }}>
              📈 Open Coach Insights
            </div>
          </button>
        );
      })() : (
        <>
          <Eyebrow>Next game</Eyebrow>
          <p className="text-sm text-slate-500">No upcoming games scheduled.</p>
        </>
      )}
    </div>
  );

  return (
    <Shell>
      {/* Hero */}
      <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: NAVY }}>
        <div className="flex items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-white text-lg flex-shrink-0" style={{ backgroundColor: ORANGE }}>
              {initial}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-slate-400 font-medium leading-none">Coach</div>
              <div className="text-[17px] font-bold text-white leading-tight truncate mt-0.5">
                {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
              </div>
            </div>
          </div>
          <div
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-full flex-shrink-0"
            style={standing
              ? { backgroundColor: "rgba(242,107,31,0.16)", color: ORANGE, border: "1px solid rgba(242,107,31,0.4)" }
              : { backgroundColor: "rgba(255,255,255,0.08)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.16)" }}
          >
            {heroChip}
          </div>
        </div>

        {userLeagues.length > 1 ? (
          <Select value={selectedLeagueId || ""} onValueChange={setSelectedLeagueId}>
            <SelectTrigger className="w-full md:w-auto md:min-w-[18rem] bg-white/10 border-white/15 text-white text-sm font-semibold rounded-xl h-auto py-2">
              <span className="mr-1">🏀</span>
              <SelectValue placeholder="Choose a league" />
            </SelectTrigger>
            <SelectContent>
              {userLeagues.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}{l.season ? ` — ${l.season}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="inline-flex items-center gap-2 bg-white/[0.07] border border-white/15 text-white text-sm font-semibold px-3 py-2 rounded-xl">
            <span>🏀</span> {selectedLeague?.name || "Your league"}
          </div>
        )}
      </div>

      {noLeague ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-500">
          You're not assigned to a league yet. Once a league organizer adds you, your team's dashboard will show up here.
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="h-3 w-20 bg-slate-100 rounded mb-3" />
              <div className="h-7 w-full bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : needsTeam ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <Eyebrow>Pick your team</Eyebrow>
          <p className="text-sm text-slate-500 mb-3">We couldn't find a team linked to your coach account in this league. Choose your team to see its dashboard.</p>
          <Select value={overrideTeamId || ""} onValueChange={setOverrideTeamId}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Choose your team" /></SelectTrigger>
            <SelectContent>
              {[...teams].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <>
          {/* Team KPIs (full width) */}
          {KpiCard}

          {/* Responsive band: phones stack; >=md is two columns
              (left: record + next game, right: players to watch). */}
          <div className="md:grid md:grid-cols-2 md:gap-3 md:items-start mb-3">
            <div className="space-y-3 mb-3 md:mb-0">
              {RecordCard}
              {NextGameCard}
            </div>
            <div className="md:h-full">
              {WatchCard}
            </div>
          </div>

          {/* Quick links (full width) */}
          <div className="flex gap-2 mb-3 max-w-md md:max-w-2xl md:mx-auto">
            {[{ i: "🎯", t: "Coach Insights", p: "CoachInsights" }, { i: "📊", t: "Statistics", p: "Statistics" }, { i: "📅", t: "Schedule", p: "Schedule" }].map((q) => (
              <button key={q.p} onClick={() => go(q.p)} className="flex-1 bg-white border border-slate-200 rounded-xl py-3 text-center hover:border-orange-300 transition-colors">
                <div className="text-[17px]">{q.i}</div>
                <div className="text-[11px] font-bold text-slate-600 mt-1">{q.t}</div>
              </button>
            ))}
          </div>
        </>
      )}

      <StatsBar />
    </Shell>
  );
}
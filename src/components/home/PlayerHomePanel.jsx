import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, isToday, isTomorrow } from "date-fns";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  buildPlayerAggregates,
  buildGameFormatMap,
  calcPoints,
  LEADER_MIN_GP_PCT,
} from "@/components/stats/statEngine";
import { useLeagueStatsData } from "@/components/stats/useLeagueStatsData";
import { calculatePlayerBadges } from "@/components/player/badgeCalculator";
import { BADGE_DEFINITIONS } from "@/components/player/badgeDefinitions";

// PLAYER_HOME_V2 — Responsive "cockpit" home for players: single column on
// phones, two columns (games | badges) on iPad/laptop (>=md). Renders only for
// user_type === 'player' (gated by Landing.jsx). All numbers come from the
// shared stats hook + the existing stat engine and badge calculator, so KPIs,
// last game, rank and badges match the Player Dashboard / Statistics pages
// exactly. No new stat math is invented here.

const NAVY = "#0B1F3A";
const ORANGE = "#F26B1F";

// Real badge groups for the "How do I earn badges?" explainer (subset of the
// 19 BADGE_DEFINITIONS; the full set + progress lives on the future Badges page).
const BADGE_GUIDE = [
  { icon: "🎯", group: "Scoring", items: "Double Digits (10+ pts) · 20 Club · 30 Bomb" },
  { icon: "🎪", group: "Playmaking", items: "Facilitator (5+ ast) · Playmaker · Floor General" },
  { icon: "🧹", group: "Rebounding", items: "Glass Cleaner (8+ reb) · Board Beast · Rebound Machine" },
  { icon: "🛡️", group: "Defense", items: "Pickpocket (2+ stl) · Lockdown Defender · Shot Blocker" },
  { icon: "⭐", group: "Big games", items: "Double-Double · Triple-Double · Player of the Game" },
];

function didParticipate(stat) {
  const hasStats =
    (stat.points_2 || 0) + (stat.points_3 || 0) + (stat.free_throws || 0) +
    (stat.assists || 0) + (stat.steals || 0) + (stat.blocks || 0) +
    (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0) +
    (stat.fouls || 0) + (stat.technical_fouls || 0) + (stat.unsportsmanlike_fouls || 0) > 0;
  if (stat.did_play) return true;
  if ((stat.minutes_played || 0) > 0) return true;
  if (hasStats) return true;
  return false;
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

function Delta({ value }) {
  if (value === 0 || Number.isNaN(value)) {
    return <span className="inline-block mt-1.5 text-[11px] font-bold text-slate-400">even</span>;
  }
  const up = value > 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 mt-1.5 text-[11px] font-extrabold px-1.5 py-0.5 rounded-full"
      style={up ? { color: "#16A34A", backgroundColor: "#DCFCE7" } : { color: "#DC2626", backgroundColor: "#FEE2E2" }}
    >
      {up ? "▲" : "▼"} {up ? "+" : ""}{value}
    </span>
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

export default function PlayerHomePanel({ currentUser }) {
  const navigate = useNavigate();
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const go = (page) => navigate(createPageUrl(page));

  const { data: identities = [] } = useQuery({
    queryKey: ["myLeagueIdentities", currentUser?.id],
    queryFn: () => base44.entities.UserLeagueIdentity.filter({ user_id: currentUser.id }),
    enabled: !!currentUser?.id,
  });

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
    if (userLeagues.length > 0 && !selectedLeagueId) setSelectedLeagueId(userLeagues[0].id);
  }, [userLeagues, selectedLeagueId]);

  const currentIdentity = useMemo(
    () => identities.find((i) => i.league_id === selectedLeagueId) || null,
    [identities, selectedLeagueId]
  );
  const teamId = currentIdentity?.team_id;
  const matchedPlayerId = currentIdentity?.matched_player_id;

  const { teams, players, games, stats, isLoading } = useLeagueStatsData(selectedLeagueId);

  const selectedLeague = useMemo(() => allLeagues.find((l) => l.id === selectedLeagueId) || null, [allLeagues, selectedLeagueId]);
  const currentTeam = useMemo(() => teams.find((t) => t.id === teamId) || null, [teams, teamId]);
  const teamPlayers = useMemo(() => (teamId ? players.filter((p) => p.team_id === teamId) : []), [players, teamId]);

  const playerRecord = useMemo(() => {
    if (matchedPlayerId) return teamPlayers.find((p) => p.id === matchedPlayerId) || null;
    if (!currentUser?.display_name || !teamPlayers.length) return null;
    const dn = currentUser.display_name.trim().toLowerCase();
    return teamPlayers.find((p) => p.name?.trim().toLowerCase() === dn) || null;
  }, [teamPlayers, matchedPlayerId, currentUser]);
  const myId = playerRecord?.id;

  const formatMap = useMemo(() => buildGameFormatMap(games, stats), [games, stats]);

  const completedGameIds = useMemo(
    () => new Set(games.filter((g) =>
      g.status === "completed" && !g.is_default_result && g.result_type !== "default" &&
      !g.exclude_from_player_stats && !g.exclude_from_awards
    ).map((g) => g.id)),
    [games]
  );

  const myStats = useMemo(
    () => (myId ? stats.filter((s) => s.player_id === myId && completedGameIds.has(s.game_id) && didParticipate(s)) : []),
    [stats, myId, completedGameIds]
  );

  // Season KPIs + scoring rank from the shared engine (identical to Statistics page).
  const aggregates = useMemo(() => buildPlayerAggregates({ players, teams, games, stats }), [players, teams, games, stats]);
  const myAgg = useMemo(() => aggregates.find((a) => a.id === myId) || null, [aggregates, myId]);
  const gp = myAgg?.gamesPlayed || 0;
  const ppg = myAgg?.ppg || 0;
  const rpg = myAgg?.rpg || 0;
  const apg = myAgg?.apg || 0;

  const scoringRank = useMemo(() => {
    if (!myId) return null;
    const eligible = aggregates.filter((a) => a.teamGames > 0 && a.gamesPlayed / a.teamGames >= LEADER_MIN_GP_PCT);
    const idx = [...eligible].sort((a, b) => b.ppg - a.ppg).findIndex((a) => a.id === myId);
    return idx >= 0 ? idx + 1 : null;
  }, [aggregates, myId]);

  // Last game (most recent completed game the player featured in).
  const lastGame = useMemo(() => {
    if (!teamId || !games.length) return null;
    const teamCompleted = games
      .filter((g) => (g.home_team_id === teamId || g.away_team_id === teamId) && g.status === "completed")
      .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));
    for (const g of teamCompleted) {
      if (myStats.find((s) => s.game_id === g.id)) return g;
    }
    return null;
  }, [games, teamId, myStats]);

  const lastLine = useMemo(() => (lastGame ? myStats.find((s) => s.game_id === lastGame.id) || null : null), [lastGame, myStats]);

  // Next scheduled game.
  const nextGame = useMemo(() => {
    if (!teamId || !games.length) return null;
    const now = new Date();
    return games
      .filter((g) => (g.home_team_id === teamId || g.away_team_id === teamId) && g.status === "scheduled" && new Date(g.game_date) >= now)
      .sort((a, b) => new Date(a.game_date) - new Date(b.game_date))[0] || null;
  }, [games, teamId]);

  // Earned badges (count > 0) — same calculator as the Player Dashboard.
  const earnedBadges = useMemo(() => {
    const counts = calculatePlayerBadges(myStats, games, formatMap, stats);
    return Object.entries(counts)
      .filter(([, c]) => c > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([key, count]) => ({ key, count, ...BADGE_DEFINITIONS[key] }));
  }, [myStats, games, formatMap, stats]);

  const firstName = currentUser?.full_name?.split(" ")[0] || null;
  const initial = currentUser?.full_name?.[0]?.toUpperCase() || "U";
  const loading = leaguesLoading || !selectedLeagueId || isLoading;
  const noLeague = !leaguesLoading && allLeagues.length > 0 && userLeagues.length === 0;

  const heroChip = gp > 0 ? (scoringRank ? `#${scoringRank} in scoring` : "Your stats are live") : "New player";

  // ---- Card render helpers (used in the responsive grid below) ----

  const KpiCard = (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
      <div className="flex text-center">
        {[{ v: ppg, l: "PPG" }, { v: rpg, l: "RPG" }, { v: apg, l: "APG" }].map((k, i) => (
          <div key={i} className={`flex-1 ${i > 0 ? "border-l border-slate-100" : ""}`}>
            <div className="text-[26px] font-black leading-none tracking-tight" style={{ color: gp > 0 ? NAVY : "#94a3b8" }}>
              {gp > 0 ? k.v.toFixed(1) : "—"}
            </div>
            <div className="text-[11px] text-slate-500 mt-1.5 font-semibold">{k.l}</div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-slate-500 text-center mt-2.5 pt-2.5 border-t border-slate-100">
        {gp > 0 ? (
          <><span className="inline-block bg-slate-100 text-slate-600 font-bold text-[11px] px-2 py-0.5 rounded-full">{gp} games played</span>{currentTeam?.name ? ` · ${currentTeam.name}` : ""}</>
        ) : (
          "Your stats appear after your first game."
        )}
      </div>
    </div>
  );

  const LastGameCard = (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      {lastGame ? (() => {
        const isHome = lastGame.home_team_id === teamId;
        const oppId = isHome ? lastGame.away_team_id : lastGame.home_team_id;
        const opp = teams.find((t) => t.id === oppId);
        const myScore = isHome ? lastGame.home_score : lastGame.away_score;
        const oppScore = isHome ? lastGame.away_score : lastGame.home_score;
        const won = myScore > oppScore;
        const pts = lastLine ? calcPoints(lastLine, lastGame, formatMap[lastGame.id]) : 0;
        const reb = lastLine ? (lastLine.offensive_rebounds || 0) + (lastLine.defensive_rebounds || 0) : 0;
        const ast = lastLine ? lastLine.assists || 0 : 0;
        return (
          <button className="w-full text-left" onClick={() => go("Schedule")}>
            <Eyebrow right={<span className="text-[11px] font-extrabold" style={{ color: won ? "#16A34A" : "#DC2626" }}>{won ? "W" : "L"} {myScore}–{oppScore}</span>}>
              Last game
            </Eyebrow>
            <div className="flex gap-2">
              {[{ v: pts, k: "PTS", d: Math.round(pts - ppg) }, { v: reb, k: "REB", d: Math.round(reb - rpg) }, { v: ast, k: "AST", d: Math.round(ast - apg) }].map((s, i) => (
                <div key={i} className="flex-1 bg-slate-50 border border-slate-100 rounded-xl py-2.5 text-center">
                  <div className="text-[19px] font-extrabold text-slate-900 leading-none">{s.v}</div>
                  <div className="text-[10px] text-slate-500 font-bold tracking-wide mt-1">{s.k}</div>
                  <Delta value={s.d} />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 text-center mt-2.5">vs {opp?.name || "opponent"} · compared to your season average</p>
          </button>
        );
      })() : (
        <>
          <Eyebrow>Last game</Eyebrow>
          <p className="text-sm text-slate-500 text-center py-1">No games yet — your first stat line will show up here once you've played.</p>
        </>
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

  const BadgesCard = (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 h-full">
      <Eyebrow right={<button className="text-[11px] font-bold flex items-center gap-0.5" style={{ color: ORANGE }} onClick={() => go("PlayerProfile")}>See all <ChevronRight className="w-3 h-3" /></button>}>
        Your badges
      </Eyebrow>
      {earnedBadges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {earnedBadges.slice(0, 6).map((b) => (
            <span key={b.key} className="inline-flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1.5 rounded-full" style={{ backgroundColor: "#FFF7ED", border: "1px solid #FED7AA", color: "#9a3412" }}>
              {b.badge_icon} {b.badge_name}{b.count > 1 ? <span style={{ color: ORANGE }}>×{b.count}</span> : null}
            </span>
          ))}
          {earnedBadges.length > 6 && (
            <span className="inline-flex items-center text-[12px] font-bold px-2.5 py-1.5 rounded-full bg-slate-100 text-slate-500">+{earnedBadges.length - 6} more</span>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No badges yet. Show up, put up numbers, and they'll start landing here. 🏀</p>
      )}

      <details className="mt-3 border-t border-slate-100 pt-2.5 group">
        <summary className="list-none cursor-pointer flex items-center gap-1.5 text-[12px] font-bold" style={{ color: ORANGE }}>
          How do I earn badges?
          <ChevronDown className="w-3.5 h-3.5 ml-auto text-slate-400 group-open:rotate-180 transition-transform" />
        </summary>
        <div className="mt-2.5 space-y-2.5">
          {BADGE_GUIDE.map((g) => (
            <div key={g.group} className="flex gap-2.5">
              <span className="text-[16px] leading-tight flex-shrink-0">{g.icon}</span>
              <div>
                <div className="text-[12.5px] font-bold text-slate-800">{g.group}</div>
                <div className="text-[11.5px] text-slate-500 leading-snug">{g.items}</div>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-slate-400 italic">Earn them game by game — the more you play, the more you stack up.</p>
        </div>
      </details>
    </div>
  );

  return (
    <Shell>
      {/* Hero (full width on every screen) */}
      <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: NAVY }}>
        <div className="flex items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-white text-lg flex-shrink-0" style={{ backgroundColor: ORANGE }}>
              {initial}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-slate-400 font-medium leading-none">Player</div>
              <div className="text-[17px] font-bold text-white leading-tight truncate mt-0.5">
                {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
              </div>
            </div>
          </div>
          <div
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-full flex-shrink-0"
            style={gp > 0
              ? { backgroundColor: "rgba(242,107,31,0.16)", color: ORANGE, border: "1px solid rgba(242,107,31,0.4)" }
              : { backgroundColor: "rgba(255,255,255,0.08)", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.16)" }}
          >
            {heroChip}
          </div>
        </div>

        {/* League: switcher when >1, plain label otherwise */}
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
          You're not in a league yet. Once a league organizer adds you, your stats will show up here.
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
      ) : (
        <>
          {/* KPIs (full width) */}
          {KpiCard}

          {/* Responsive band: phones stack everything; >=md is two columns
              (left: last + next game, right: badges). */}
          <div className="md:grid md:grid-cols-2 md:gap-3 md:items-start mb-3">
            <div className="space-y-3 mb-3 md:mb-0">
              {LastGameCard}
              {NextGameCard}
            </div>
            <div className="md:h-full">
              {BadgesCard}
            </div>
          </div>

          {/* Quick links (full width) */}
          <div className="flex gap-2 mb-3 max-w-md md:max-w-2xl md:mx-auto">
            {[{ i: "👤", t: "My profile", p: "PlayerProfile" }, { i: "📊", t: "Statistics", p: "Statistics" }, { i: "📅", t: "Schedule", p: "Schedule" }].map((q) => (
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
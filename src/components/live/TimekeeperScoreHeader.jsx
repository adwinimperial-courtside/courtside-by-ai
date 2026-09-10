import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { base44 } from "@/api/base44Client";

export const TIMEKEEPER_HEADER_MARKER = "TIMEKEEPER_HEADER_V1";

const TIMEKEEPER_FIELDS = [
  "clock_period",
  "clock_time_left",
  "clock_running",
  "clock_started_at",
  "period_status",
  "home_timeouts",
  "away_timeouts",
];

const DEFAULT_GAME_RULES = {
  teamFoulBonusThreshold: 5,
  countPersonalFoulsAsTeamFoul: true,
  countOffensiveFoulsAsTeamFoul: true,
  countPlayerTechnicalAsTeamFoul: true,
  countUnsportsmanlikeAsTeamFoul: true,
  countPlayerDisqualifyingAsTeamFoul: true,
  countBenchTechnicalAsTeamFoul: false,
  countCoachTechnicalAsTeamFoul: false,
};

const POSSESSION_PENDING_MS = 15000;
const RETRY_DELAYS_MS = [250, 500, 1000, 2000];

function getPeriodLabel(period, periodType) {
  const totalRegulation = periodType === "halves" ? 2 : 4;
  if (period <= totalRegulation) {
    return periodType === "halves" ? `H${period}` : `Q${period}`;
  }
  return `OT${period - totalRegulation}`;
}

function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function getFoulResetPeriodKey(period, periodType, totalPeriods) {
  if (period > totalPeriods) return String(period);
  if (periodType === "halves") return period === 1 ? "h1" : "h2";
  return String(period);
}

function pickTimekeeperFields(source) {
  const out = {};
  if (!source) return out;
  TIMEKEEPER_FIELDS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) out[key] = source[key];
  });
  return out;
}

function sameTimekeeperFields(a, b) {
  return TIMEKEEPER_FIELDS.every(
    (key) => JSON.stringify(a?.[key] ?? null) === JSON.stringify(b?.[key] ?? null)
  );
}

function isOlderThan(incoming, current) {
  return !!(
    incoming?.updated_date &&
    current?.updated_date &&
    String(incoming.updated_date) < String(current.updated_date)
  );
}

function isRateLimitError(error) {
  if (!error) return false;
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("too many requests") ||
    error?.status === 429 ||
    error?.response?.status === 429
  );
}

async function withRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimitError(err) || attempt >= RETRY_DELAYS_MS.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}

export default function TimekeeperScoreHeader({ game, homeTeam, awayTeam, onEndGame, playerStats = [] }) {
  const queryClient = useQueryClient();
  const gameIdRef = useRef(game?.id);
  gameIdRef.current = game?.id;

  const calcScore = (teamId) => playerStats.reduce((acc, s) =>
    s.team_id === teamId ? acc + (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0) : acc, 0);
  const derivedHomeScore = playerStats.length > 0 ? calcScore(game.home_team_id) : (game.home_score || 0);
  const derivedAwayScore = playerStats.length > 0 ? calcScore(game.away_team_id) : (game.away_score || 0);

  const [clockState, setClockState] = useState(() => ({
    ...pickTimekeeperFields(game),
    updated_date: game?.updated_date || null,
  }));
  const clockStateRef = useRef(clockState);
  const sourceRef = useRef("initial");

  const pushToGameCache = useCallback((source) => {
    const patch = pickTimekeeperFields(source);
    if (Object.keys(patch).length === 0) return;
    queryClient.setQueriesData({ queryKey: ["game"] }, (prev) => {
      if (!prev || Array.isArray(prev) || prev.id !== gameIdRef.current) return prev;
      const next = { ...prev, ...patch };
      return sameTimekeeperFields(prev, next) ? prev : next;
    });
  }, [queryClient]);

  const acceptClockState = useCallback((incoming, source) => {
    if (!incoming) return false;
    const current = clockStateRef.current;
    if (current && isOlderThan(incoming, current)) return false;
    const next = {
      ...current,
      ...pickTimekeeperFields(incoming),
      updated_date: incoming.updated_date || null,
    };
    sourceRef.current = source;
    clockStateRef.current = next;
    setClockState(next);
    return true;
  }, []);

  useEffect(() => {
    const current = clockStateRef.current;
    if (current && isOlderThan(game, current)) {
      if (!sameTimekeeperFields(game, current)) pushToGameCache(current);
      return;
    }
    acceptClockState(game, "prop");
  }, [
    game.updated_date,
    game.clock_period,
    game.clock_time_left,
    game.clock_running,
    game.clock_started_at,
    game.period_status,
    game.home_timeouts,
    game.away_timeouts,
  ]);

  useEffect(() => {
    if (!game?.id) return undefined;
    const unsubscribe = base44.entities.Game.subscribe((event) => {
      if (!event || event.id !== gameIdRef.current || !event.data) return;
      if (event.type === "delete") return;
      if (acceptClockState(event.data, "live")) pushToGameCache(event.data);
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [game?.id, acceptClockState, pushToGameCache]);

  const [possession, setPossession] = useState(() => game.possession || null);
  const [showPossessionPicker, setShowPossessionPicker] = useState(false);
  const pendingPossessionRef = useRef(null);

  useEffect(() => {
    const incoming = game.possession || null;
    const pending = pendingPossessionRef.current;
    if (pending) {
      if (incoming === pending.value) {
        pendingPossessionRef.current = null;
      } else if (Date.now() - pending.at < POSSESSION_PENDING_MS) {
        return;
      } else {
        pendingPossessionRef.current = null;
      }
    }
    setPossession(incoming);
  }, [game.possession]);

  const savePossession = async (next) => {
    const previous = possession;
    setPossession(next);
    setShowPossessionPicker(false);
    pendingPossessionRef.current = { value: next, at: Date.now() };
    try {
      await withRetry(() => base44.entities.Game.update(gameIdRef.current, { possession: next }));
    } catch (err) {
      console.warn("TIMEKEEPER_HEADER_V1 possession save failed", err);
      if (pendingPossessionRef.current?.value === next) {
        pendingPossessionRef.current = null;
        setPossession(previous);
      }
    }
  };

  const handleSetPossession = (team) => savePossession(team);

  const handleSwitchPossession = () => {
    if (!possession) {
      setShowPossessionPicker(true);
      return;
    }
    savePossession(possession === "home" ? "away" : "home");
  };

  const gameRules = { ...DEFAULT_GAME_RULES, ...(game.game_rules || {}) };
  const isTimed = game?.game_mode === "timed" || (!game?.game_mode && game?.period_minutes);
  const periodType = game?.period_type || "quarters";
  if (!game.game_rules?.teamFoulBonusThreshold) {
    gameRules.teamFoulBonusThreshold = periodType === "halves" ? 7 : 5;
  }
  const totalPeriods = game?.period_count || (periodType === "halves" ? 2 : 4);

  const period = clockState.clock_period ?? 1;
  const running = clockState.clock_running ?? false;
  const isOvertime = period > totalPeriods;
  const periodLabel = getPeriodLabel(period, periodType);

  const anchorRef = useRef({ startedAt: null, localStart: 0 });
  if (running && clockState.clock_started_at) {
    if (anchorRef.current.startedAt !== clockState.clock_started_at) {
      let elapsedMs = Date.now() - new Date(clockState.clock_started_at).getTime();
      if (!Number.isFinite(elapsedMs)) elapsedMs = 0;
      if (sourceRef.current === "live" && (elapsedMs < -500 || elapsedMs > 5000)) elapsedMs = 250;
      anchorRef.current = {
        startedAt: clockState.clock_started_at,
        localStart: performance.now() - Math.max(0, elapsedMs),
      };
    }
  } else if (anchorRef.current.startedAt !== null) {
    anchorRef.current = { startedAt: null, localStart: 0 };
  }

  const computeDisplayTime = () => {
    const stored = clockState.clock_time_left ?? ((game.period_minutes || 10) * 60);
    if (!running || !anchorRef.current.startedAt) return Math.max(0, stored);
    return Math.max(0, stored - (performance.now() - anchorRef.current.localStart) / 1000);
  };

  const [displayTime, setDisplayTime] = useState(() => computeDisplayTime());

  useEffect(() => {
    setDisplayTime(computeDisplayTime());
    if (!running) return undefined;
    const tick = setInterval(() => setDisplayTime(computeDisplayTime()), 500);
    return () => clearInterval(tick);
  }, [running, clockState.clock_started_at, clockState.clock_time_left, clockState.clock_period]);

  const timeExpired = displayTime <= 0;
  const isInFinalReview = timeExpired && !running && (period === totalPeriods || isOvertime);
  const scoresTied = derivedHomeScore === derivedAwayScore;

  const foulResetKey = getFoulResetPeriodKey(period, periodType, totalPeriods);
  const homeFoulsNow = (game.home_team_fouls || {})[foulResetKey] || 0;
  const awayFoulsNow = (game.away_team_fouls || {})[foulResetKey] || 0;
  const threshold = gameRules.teamFoulBonusThreshold;
  const homeInBonus = homeFoulsNow >= threshold;
  const awayInBonus = awayFoulsNow >= threshold;
  const homeNearBonus = homeFoulsNow === threshold - 1;
  const awayNearBonus = awayFoulsNow === threshold - 1;

  const getSegment = (p) => {
    if (p > totalPeriods) return "OVERTIME";
    if (periodType === "halves") return p === 1 ? "FIRST_HALF" : "SECOND_HALF";
    return p <= 2 ? "FIRST_HALF" : "SECOND_HALF";
  };

  const getSegmentAllowance = (segment) => {
    const configured = game.game_rules?.timeoutsPerSegment;
    if (Array.isArray(configured)) {
      const idx = period - 1;
      if (idx >= 0 && idx < configured.length) return configured[idx];
      return 1;
    }
    if (configured != null) return configured;
    if (segment === "OVERTIME") return 1;
    if (segment === "FIRST_HALF") return 2;
    if (periodType === "halves") return 2;
    return 3;
  };

  const segmentKey = getSegment(period);
  const segmentAllowance = getSegmentAllowance(segmentKey);
  const homeUsed = (clockState.home_timeouts || {})[segmentKey] || 0;
  const awayUsed = (clockState.away_timeouts || {})[segmentKey] || 0;
  const homeRemaining = Math.max(0, segmentAllowance - homeUsed);
  const awayRemaining = Math.max(0, segmentAllowance - awayUsed);

  const clockColor = running ? "text-green-300" : timeExpired ? "text-red-300" : "text-white";

  return (
    <>
      <Card data-marker="TIMEKEEPER_HEADER_V1" className="min-[900px]:hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 border-0 shadow-xl">
        <div className="grid grid-cols-3 divide-x divide-white/20">

          <div className="py-3 px-4 flex items-center gap-3">
            <div
              className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-lg"
              style={{ backgroundColor: homeTeam?.color || "#f97316" }}
            >
              {homeTeam?.name?.[0]}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-sm truncate drop-shadow">{homeTeam?.name}</h3>
              <p className="text-3xl font-bold text-white leading-tight">{derivedHomeScore}</p>
            </div>
          </div>

          <div className="py-3 px-2 flex items-center justify-center">
            {isTimed ? (
              <div className="flex flex-col items-center gap-1 w-full">
                <span className="px-1.5 py-px rounded bg-amber-200 text-amber-900 text-[9px] font-black tracking-widest uppercase leading-tight">
                  TIMEKEEPER
                </span>
                <div className="flex items-center justify-center gap-1.5 w-full">
                  <span className="text-white font-bold text-[11px] leading-none flex-shrink-0">{periodLabel}</span>
                  <span className="text-white/30 text-[10px]">|</span>
                  <span className={`font-mono font-bold text-sm leading-none flex-shrink-0 ${clockColor}`}>
                    {formatTime(displayTime)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <p className="text-white/60 text-xs">LIVE</p>
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full mx-auto animate-pulse" />
              </div>
            )}
          </div>

          <div className="py-3 px-4 flex items-center justify-end gap-3">
            <div className="text-right min-w-0">
              <h3 className="font-bold text-white text-sm truncate drop-shadow">{awayTeam?.name}</h3>
              <p className="text-3xl font-bold text-white leading-tight">{derivedAwayScore}</p>
            </div>
            <div
              className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-lg"
              style={{ backgroundColor: awayTeam?.color || "#f97316" }}
            >
              {awayTeam?.name?.[0]}
            </div>
          </div>

        </div>
      </Card>

      <Card data-marker="TIMEKEEPER_HEADER_V1" className="hidden min-[900px]:block bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 border-0 shadow-xl">
        <div className="flex items-stretch divide-x divide-white/20">

          <div className="flex-1 flex flex-col justify-center px-7 py-3">
            <div className="flex items-center gap-4 mb-2">
              <div
                className="w-14 h-14 flex-shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
                style={{ backgroundColor: homeTeam?.color || "#f97316" }}
              >
                {homeTeam?.name?.[0]}
              </div>
              <div className="min-w-0">
                <p className="text-white/80 font-semibold text-sm truncate">{homeTeam?.name}</p>
                <p className="text-5xl font-black text-white leading-none tabular-nums">{derivedHomeScore}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5" style={{ minHeight: "36px" }}>
              {Array.from({ length: segmentAllowance }).map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full border-2 ${i < homeRemaining ? "bg-white border-white" : "border-white/40"}`} />
              ))}
              <span className="text-white/70 text-[11px] ml-1.5">timeouts left</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-white/70 text-xs font-bold uppercase tracking-wide">FOULS: <span className="text-white">{homeFoulsNow}</span></span>
              {homeInBonus && (
                <span className="px-2 py-0.5 rounded-md bg-yellow-400 text-yellow-900 text-[10px] font-black uppercase tracking-wide">BONUS</span>
              )}
              {!homeInBonus && homeNearBonus && (
                <span className="px-2 py-0.5 rounded-md bg-orange-500 text-white text-[10px] font-black uppercase tracking-wide">⚠ WARNING</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center px-10 py-3 flex-shrink-0" style={{ minWidth: "430px" }}>
            {isTimed ? (
              <>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-200" />
                  <span className="text-xs font-black tracking-widest uppercase text-amber-200">Clock run by timekeeper</span>
                </div>

                <div className="flex items-baseline gap-3 mb-3">
                  <span className={`font-mono font-black text-4xl leading-none tabular-nums ${clockColor}`}>
                    {formatTime(displayTime)}
                  </span>
                  <span className="text-white font-bold text-xl">{periodLabel}</span>
                </div>

                <div className="flex flex-col items-center gap-1 mb-3">
                  {showPossessionPicker ? (
                    <div className="flex items-center gap-2">
                      <span className="text-white/70 text-xs font-bold uppercase tracking-wide mr-1">SET:</span>
                      <button
                        onClick={() => handleSetPossession("home")}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/40 text-white transition-all"
                      >
                        ← {homeTeam?.name || "HOME"}
                      </button>
                      <button
                        onClick={() => handleSetPossession("away")}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/40 text-white transition-all"
                      >
                        {awayTeam?.name || "AWAY"} →
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm tracking-wide">
                        {!possession
                          ? "SET POSSESSION"
                          : possession === "home"
                          ? `← ${homeTeam?.name || "HOME"}`
                          : `${awayTeam?.name || "AWAY"} →`}
                      </span>
                      <button
                        onClick={handleSwitchPossession}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/20 hover:bg-white/35 text-white/80 hover:text-white transition-all uppercase tracking-wide"
                      >
                        {possession ? "SWITCH" : "SET"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center" style={{ minHeight: "56px" }}>
                  {isInFinalReview && !scoresTied && (
                    <button
                      onClick={onEndGame}
                      className="flex items-center justify-center gap-2 px-5 rounded-xl font-bold text-sm bg-yellow-500 hover:bg-yellow-400 text-white transition-all shadow-lg"
                      style={{ minWidth: "140px", minHeight: "56px" }}
                    >
                      <Trophy className="w-4 h-4" />
                      END GAME
                    </button>
                  )}
                  {isInFinalReview && scoresTied && (
                    <div className="px-3 py-2.5 rounded-xl bg-black/20 text-white text-[13px] font-bold text-center whitespace-nowrap">
                      Tied. Overtime: waiting for the timekeeper
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-white/70 text-xs font-bold tracking-widest uppercase">LIVE</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center items-end px-7 py-3">
            <div className="flex items-center gap-4 mb-2">
              <div className="text-right min-w-0">
                <p className="text-white/80 font-semibold text-sm truncate">{awayTeam?.name}</p>
                <p className="text-5xl font-black text-white leading-none tabular-nums">{derivedAwayScore}</p>
              </div>
              <div
                className="w-14 h-14 flex-shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
                style={{ backgroundColor: awayTeam?.color || "#f97316" }}
              >
                {awayTeam?.name?.[0]}
              </div>
            </div>
            <div className="flex items-center gap-1.5" style={{ minHeight: "36px" }}>
              <span className="text-white/70 text-[11px] mr-1.5">timeouts left</span>
              {Array.from({ length: segmentAllowance }).map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full border-2 ${i < awayRemaining ? "bg-white border-white" : "border-white/40"}`} />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              {awayInBonus && (
                <span className="px-2 py-0.5 rounded-md bg-yellow-400 text-yellow-900 text-[10px] font-black uppercase tracking-wide">BONUS</span>
              )}
              {!awayInBonus && awayNearBonus && (
                <span className="px-2 py-0.5 rounded-md bg-orange-500 text-white text-[10px] font-black uppercase tracking-wide">⚠ WARNING</span>
              )}
              <span className="text-white/70 text-xs font-bold uppercase tracking-wide">FOULS: <span className="text-white">{awayFoulsNow}</span></span>
            </div>
          </div>

        </div>
      </Card>
    </>
  );
}
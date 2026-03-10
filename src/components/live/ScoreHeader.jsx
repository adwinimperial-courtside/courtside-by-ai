import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Play, Pause } from "lucide-react";
import { base44 } from "@/api/base44Client";

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

/**
 * Compute the current time left in seconds from the persisted clock state.
 * If clock_running = true, subtract elapsed time since clock_started_at.
 */
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

function computeTimeLeft(game) {
  const stored = game.clock_time_left ?? ((game.period_minutes || 10) * 60);
  if (!game.clock_running || !game.clock_started_at) return Math.max(0, stored);
  const elapsed = (Date.now() - new Date(game.clock_started_at).getTime()) / 1000;
  return Math.max(0, stored - elapsed);
}

// Foul-reset period key: for quarters each period is its own key; for halves each half is its own key.
// Overtime periods always get their own key (period number as string).
function getFoulResetPeriodKey(period, periodType, totalPeriods) {
  if (period > totalPeriods) return String(period); // each OT is fresh
  if (periodType === 'halves') return period === 1 ? 'h1' : 'h2';
  return String(period); // Q1, Q2, Q3, Q4 each unique
}

export default function ScoreHeader({ game, homeTeam, awayTeam, onGameUpdate }) {
  const [possession, setPossession] = useState(() => game.possession || null);
  const [showPossessionPicker, setShowPossessionPicker] = useState(false);

  useEffect(() => {
    setPossession(game.possession || null);
  }, [game.possession]);

  const handleSetPossession = async (team) => {
    setPossession(team);
    setShowPossessionPicker(false);
    await base44.entities.Game.update(game.id, { possession: team });
    if (onGameUpdate) onGameUpdate({ ...game, possession: team });
  };

  const handleSwitchPossession = async () => {
    if (!possession) {
      setShowPossessionPicker(true);
      return;
    }
    const next = possession === 'home' ? 'away' : 'home';
    setPossession(next);
    await base44.entities.Game.update(game.id, { possession: next });
    if (onGameUpdate) onGameUpdate({ ...game, possession: next });
  };
  // ── Team Fouls state ─────────────────────────────────────────────
  const gameRules = { ...DEFAULT_GAME_RULES, ...(game.game_rules || {}) };
  const [homeTeamFouls, setHomeTeamFouls] = useState(() => game.home_team_fouls || {});
  const [awayTeamFouls, setAwayTeamFouls] = useState(() => game.away_team_fouls || {});

  useEffect(() => {
    if (game.home_team_fouls) setHomeTeamFouls(game.home_team_fouls);
    if (game.away_team_fouls) setAwayTeamFouls(game.away_team_fouls);
  }, [game.home_team_fouls, game.away_team_fouls]);

  const isTimed = game?.game_mode === "timed" || (!game?.game_mode && game?.period_minutes);
  const periodType = game?.period_type || "quarters";
  const totalPeriods = game?.period_count || (periodType === "halves" ? 2 : 4);
  const periodMinutes = game?.period_minutes || 10;
  const overtimeMinutes = game?.overtime_minutes || 5;

  // Local display state — derived from game, updated every second if running
  const [displayTime, setDisplayTime] = useState(() => computeTimeLeft(game));
  const [homeTimeoutsUsed, setHomeTimeoutsUsed] = useState(() => game.home_timeouts || {});
  const [awayTimeoutsUsed, setAwayTimeoutsUsed] = useState(() => game.away_timeouts || {});
  const tickRef = useRef(null);

  const period = game?.clock_period ?? 1;
  const running = game?.clock_running ?? false;
  const isOvertime = period > totalPeriods;
  const periodLabel = getPeriodLabel(period, periodType);

  // Derived foul values for the current foul-reset period
  const foulResetKey = getFoulResetPeriodKey(period, periodType, totalPeriods);
  const homeFoulsNow = homeTeamFouls[foulResetKey] || 0;
  const awayFoulsNow = awayTeamFouls[foulResetKey] || 0;
  const threshold = gameRules.teamFoulBonusThreshold;
  const homeInBonus = homeFoulsNow >= threshold;
  const awayInBonus = awayFoulsNow >= threshold;
  const homeNearBonus = homeFoulsNow === threshold - 1;
  const awayNearBonus = awayFoulsNow === threshold - 1;

  // Recompute display time whenever game clock state changes
  useEffect(() => {
    setDisplayTime(computeTimeLeft(game));
  }, [game.clock_running, game.clock_started_at, game.clock_time_left, game.clock_period]);

  // Tick every second while running to update display; auto-stop when time expires
  useEffect(() => {
    clearInterval(tickRef.current);
    autoStopFiredRef.current = false;
    if (running) {
      tickRef.current = setInterval(async () => {
        const t = computeTimeLeft(game);
        setDisplayTime(t);
        if (t <= 0 && !autoStopFiredRef.current && !isSaving.current) {
          autoStopFiredRef.current = true;
          clearInterval(tickRef.current);
          isSaving.current = true;
          try {
            const updates = {
              clock_running: false,
              clock_time_left: 0,
              clock_started_at: null,
              period_status: 'completed',
            };
            await base44.entities.Game.update(game.id, updates);
            if (onGameUpdate) onGameUpdate({ ...game, ...updates });
          } finally {
            isSaving.current = false;
          }
        }
      }, 500);
    }
    return () => clearInterval(tickRef.current);
  }, [running, game.clock_started_at, game.clock_time_left]);

  const isSaving = useRef(false);
  const autoStopFiredRef = useRef(false);

  const handlePlayPause = async () => {
    if (!isTimed || isSaving.current) return;
    const currentTimeLeft = computeTimeLeft(game);

    // If time is 0 and not running, advance to next period instead
    if (currentTimeLeft <= 0 && !running) {
      isSaving.current = true;
      try {
        const nextPeriod = period + 1;
        const nextIsOT = nextPeriod > totalPeriods;
        const nextMins = nextIsOT ? overtimeMinutes : periodMinutes;
        const newHomeFouls = { ...homeTeamFouls };
        const newAwayFouls = { ...awayTeamFouls };
        const nextKey = getFoulResetPeriodKey(nextPeriod, periodType, totalPeriods);
        if (!newHomeFouls[nextKey]) newHomeFouls[nextKey] = 0;
        if (!newAwayFouls[nextKey]) newAwayFouls[nextKey] = 0;
        const updates = {
          clock_period: nextPeriod,
          clock_time_left: nextMins * 60,
          clock_running: false,
          clock_started_at: null,
          period_status: 'active',
          home_team_fouls: newHomeFouls,
          away_team_fouls: newAwayFouls,
        };
        await base44.entities.Game.update(game.id, updates);
        setHomeTeamFouls(newHomeFouls);
        setAwayTeamFouls(newAwayFouls);
        if (onGameUpdate) onGameUpdate({ ...game, ...updates });
      } finally {
        isSaving.current = false;
      }
      return;
    }

    isSaving.current = true;
    try {
      let updates;
      if (running) {
        // Pause: save current time left, clear started_at
        updates = {
          clock_running: false,
          clock_time_left: Math.max(0, Math.round(currentTimeLeft)),
          clock_started_at: null,
        };
      } else {
        // Start: record timestamp so all devices can compute elapsed time
        updates = {
          clock_running: true,
          clock_time_left: Math.round(currentTimeLeft),
          clock_started_at: new Date().toISOString(),
        };
      }
      await base44.entities.Game.update(game.id, updates);
      if (onGameUpdate) onGameUpdate({ ...game, ...updates });
    } finally {
      isSaving.current = false;
    }
  };

  const handleNextPeriod = async () => {
    if (isSaving.current) return;
    isSaving.current = true;
    const nextPeriod = period + 1;
    const nextIsOT = nextPeriod > totalPeriods;
    const nextMins = nextIsOT ? overtimeMinutes : periodMinutes;
    // New period = new foul-reset period, keep history but new key starts at 0
    const newHomeFouls = { ...homeTeamFouls };
    const newAwayFouls = { ...awayTeamFouls };
    const nextKey = getFoulResetPeriodKey(nextPeriod, periodType, totalPeriods);
    if (!newHomeFouls[nextKey]) newHomeFouls[nextKey] = 0;
    if (!newAwayFouls[nextKey]) newAwayFouls[nextKey] = 0;
    try {
      const updates = {
        clock_period: nextPeriod,
        clock_time_left: nextMins * 60,
        clock_running: false,
        clock_started_at: null,
        home_team_fouls: newHomeFouls,
        away_team_fouls: newAwayFouls,
      };
      await base44.entities.Game.update(game.id, updates);
      setHomeTeamFouls(newHomeFouls);
      setAwayTeamFouls(newAwayFouls);
      if (onGameUpdate) onGameUpdate({ ...game, ...updates });
    } finally {
      isSaving.current = false;
    }
  };

  const handlePrevPeriod = async () => {
    if (period <= 1 || isSaving.current) return;
    isSaving.current = true;
    const prevPeriod = period - 1;
    const prevIsOT = prevPeriod > totalPeriods;
    const prevMins = prevIsOT ? overtimeMinutes : periodMinutes;
    try {
      const updates = {
        clock_period: prevPeriod,
        clock_time_left: prevMins * 60,
        clock_running: false,
        clock_started_at: null,
      };
      await base44.entities.Game.update(game.id, updates);
      if (onGameUpdate) onGameUpdate({ ...game, ...updates });
    } finally {
      isSaving.current = false;
    }
  };

  const timeExpired = displayTime <= 0;

  // ── Segment logic ────────────────────────────────────────────────
  // Segments: FIRST_HALF | SECOND_HALF | OVERTIME
  const getSegment = (p) => {
    if (p > totalPeriods) return 'OVERTIME';
    if (periodType === 'halves') {
      return p === 1 ? 'FIRST_HALF' : 'SECOND_HALF';
    }
    // quarters: Q1+Q2 = FIRST_HALF, Q3+Q4 = SECOND_HALF
    return p <= 2 ? 'FIRST_HALF' : 'SECOND_HALF';
  };

  // Default allowances per segment and format
  const getSegmentAllowance = (segment) => {
    if (segment === 'OVERTIME') return 1;
    if (segment === 'FIRST_HALF') return 2;
    // SECOND_HALF
    if (periodType === 'halves') return 2;
    return 3; // quarters SECOND_HALF
  };

  const currentSegment = getSegment(period);
  const segmentKey = currentSegment; // used as key in persisted map
  const segmentAllowance = getSegmentAllowance(currentSegment);

  // ── Sync from persisted game record ──────────────────────────────
  useEffect(() => {
    if (game.home_timeouts) setHomeTimeoutsUsed(game.home_timeouts);
    if (game.away_timeouts) setAwayTimeoutsUsed(game.away_timeouts);
  }, [game.home_timeouts, game.away_timeouts]);

  const homeUsed = homeTimeoutsUsed[segmentKey] || 0;
  const awayUsed = awayTimeoutsUsed[segmentKey] || 0;
  const homeRemaining = Math.max(0, segmentAllowance - homeUsed);
  const awayRemaining = Math.max(0, segmentAllowance - awayUsed);

  // ── Timeout action ────────────────────────────────────────────────
  const handleTimeout = async (teamId, usedCount, timeoutsKey, setUsed, teamName) => {
    if (usedCount >= segmentAllowance || isSaving.current) return;
    isSaving.current = true;
    try {
      const currentTimeLeft = computeTimeLeft(game);
      const newSegMap = { ...(game[timeoutsKey] || {}), [segmentKey]: usedCount + 1 };
      const updates = { [timeoutsKey]: newSegMap };
      // Reuse existing stop-clock logic
      if (running) {
        updates.clock_running = false;
        updates.clock_time_left = Math.max(0, Math.round(currentTimeLeft));
        updates.clock_started_at = null;
      }
      await base44.entities.Game.update(game.id, updates);
      setUsed(newSegMap);
      if (onGameUpdate) onGameUpdate({ ...game, ...updates });
      await base44.entities.GameLog.create({
        game_id: game.id,
        player_id: '',
        team_id: teamId,
        stat_type: 'timeout',
        stat_label: `Timeout – ${teamName}`,
        stat_points: 0,
        stat_color: 'bg-amber-500',
        old_home_score: game.home_score || 0,
        old_away_score: game.away_score || 0,
      });
    } finally {
      isSaving.current = false;
    }
  };

  const handleHomeTimeout = () => handleTimeout(
    game.home_team_id, homeUsed, 'home_timeouts',
    (val) => setHomeTimeoutsUsed(val), homeTeam?.name || 'Home'
  );
  const handleAwayTimeout = () => handleTimeout(
    game.away_team_id, awayUsed, 'away_timeouts',
    (val) => setAwayTimeoutsUsed(val), awayTeam?.name || 'Away'
  );

  return (
    <>
      {/* ── MOBILE layout (< 900px) ── */}
      <Card className="min-[900px]:hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 border-0 shadow-xl">
        <div className="grid grid-cols-3 divide-x divide-white/20">

          {/* Home Team */}
          <div className="py-3 px-4 flex items-center gap-3">
            <div
              className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-lg"
              style={{ backgroundColor: homeTeam?.color || '#f97316' }}
            >
              {homeTeam?.name?.[0]}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-sm truncate drop-shadow">{homeTeam?.name}</h3>
              <p className="text-3xl font-bold text-white leading-tight">{game.home_score || 0}</p>
            </div>
          </div>

          {/* Center: Period + LIVE + Timer */}
          <div className="py-3 px-2 flex items-center justify-center">
            {isTimed ? (
              <div className="flex flex-col items-center gap-0.5 w-full">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 bg-red-500 rounded-full flex-shrink-0 ${running ? 'animate-pulse' : ''}`} />
                  <span className="text-white/70 text-[10px] font-bold tracking-widest uppercase">LIVE</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 w-full">
                  <button onClick={handlePrevPeriod} disabled={period <= 1} className="text-white/40 hover:text-white/80 text-xs px-0.5 disabled:opacity-0 transition-colors">‹</button>
                  <button onClick={handleNextPeriod} className="text-white font-bold text-[11px] leading-none hover:text-white/80 transition-colors flex-shrink-0" title="Next period">{periodLabel}</button>
                  <span className="text-white/30 text-[10px]">|</span>
                  <span className={`font-mono font-bold text-sm leading-none flex-shrink-0 ${running ? 'text-green-300' : timeExpired ? 'text-red-300' : 'text-white'}`}>
                    {formatTime(displayTime)}
                  </span>
                  <button onClick={handlePlayPause} className="flex-shrink-0 p-1.5 text-white/70 hover:text-white disabled:opacity-30 transition-colors cursor-pointer hover:bg-white/10 rounded-lg" title={running ? "Pause" : timeExpired ? "Advance to next period" : "Start"}>
                    {running ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <p className="text-white/60 text-xs">LIVE</p>
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full mx-auto animate-pulse" />
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="py-3 px-4 flex items-center justify-end gap-3">
            <div className="text-right min-w-0">
              <h3 className="font-bold text-white text-sm truncate drop-shadow">{awayTeam?.name}</h3>
              <p className="text-3xl font-bold text-white leading-tight">{game.away_score || 0}</p>
            </div>
            <div
              className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-lg"
              style={{ backgroundColor: awayTeam?.color || '#f97316' }}
            >
              {awayTeam?.name?.[0]}
            </div>
          </div>

        </div>
      </Card>

      {/* ── LARGE SCREEN layout (≥ 900px) ── */}
      <Card className="hidden min-[900px]:block bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 border-0 shadow-xl">
        <div className="flex items-stretch divide-x divide-white/20">

          {/* LEFT: Home team */}
          <div className="flex-1 flex flex-col justify-center px-7 py-3">
            <div className="flex items-center gap-4 mb-2">
              <div
                className="w-14 h-14 flex-shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
                style={{ backgroundColor: homeTeam?.color || '#f97316' }}
              >
                {homeTeam?.name?.[0]}
              </div>
              <div className="min-w-0">
                <p className="text-white/80 font-semibold text-sm truncate">{homeTeam?.name}</p>
                <p className="text-5xl font-black text-white leading-none tabular-nums">{game.home_score || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: segmentAllowance }).map((_, i) => (
                  <div key={i} className={`w-3 h-3 rounded-full border-2 ${i < homeRemaining ? 'bg-white border-white' : 'border-white/40'}`} />
                ))}
              </div>
              <button
                onClick={handleHomeTimeout}
                disabled={homeRemaining <= 0}
                className="px-3 rounded-lg font-bold text-xs bg-white/20 hover:bg-white/30 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                style={{ minHeight: '36px', minWidth: '100px' }}
              >
                TIMEOUT
              </button>
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

          {/* CENTER: game state + clock + controls */}
          <div className="flex flex-col items-center justify-center px-10 py-3 flex-shrink-0">
            {isTimed ? (
              <>
                {/* Game state label */}
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${running ? 'bg-red-400 animate-pulse' : 'bg-white/30'}`} />
                  <span className={`text-xs font-bold tracking-widest uppercase ${running ? 'text-red-300' : 'text-white/50'}`}>
                    {running ? 'LIVE' : 'DEAD BALL'}
                  </span>
                </div>

                {/* Clock + period */}
                <div className="flex items-baseline gap-3 mb-3">
                  <span className={`font-mono font-black text-4xl leading-none tabular-nums ${running ? 'text-green-300' : timeExpired ? 'text-red-300' : 'text-white'}`}>
                    {formatTime(displayTime)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button onClick={handlePrevPeriod} disabled={period <= 1} className="text-white/40 hover:text-white/80 disabled:opacity-0 transition-colors px-0.5 text-base">‹</button>
                    <button onClick={handleNextPeriod} className="text-white font-bold text-xl hover:text-white/80 transition-colors" title="Next period">{periodLabel}</button>
                  </div>
                </div>

                {/* Possession indicator */}
                <div className="flex flex-col items-center gap-1 mb-3">
                  {showPossessionPicker ? (
                    <div className="flex items-center gap-2">
                      <span className="text-white/70 text-xs font-bold uppercase tracking-wide mr-1">SET:</span>
                      <button
                        onClick={() => handleSetPossession('home')}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/40 text-white transition-all"
                      >
                        ← {homeTeam?.name || 'HOME'}
                      </button>
                      <button
                        onClick={() => handleSetPossession('away')}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/40 text-white transition-all"
                      >
                        {awayTeam?.name || 'AWAY'} →
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm tracking-wide">
                        {!possession
                          ? 'SET POSSESSION'
                          : possession === 'home'
                          ? `← ${homeTeam?.name || 'HOME'}`
                          : `${awayTeam?.name || 'AWAY'} →`}
                      </span>
                      <button
                        onClick={handleSwitchPossession}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/20 hover:bg-white/35 text-white/80 hover:text-white transition-all uppercase tracking-wide"
                      >
                        {possession ? 'SWITCH' : 'SET'}
                      </button>
                    </div>
                  )}
                </div>

                {/* START / STOP buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={handlePlayPause}
                    disabled={running}
                    className="flex items-center justify-center gap-2 px-5 rounded-xl font-bold text-sm bg-green-500 hover:bg-green-400 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg"
                    style={{ minWidth: '140px', minHeight: '56px' }}
                  >
                    <Play className="w-4 h-4" />
                    START CLOCK
                  </button>
                  <button
                    onClick={handlePlayPause}
                    disabled={!running || timeExpired}
                    className="flex items-center justify-center gap-2 px-5 rounded-xl font-bold text-sm bg-red-500 hover:bg-red-400 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg"
                    style={{ minWidth: '140px', minHeight: '56px' }}
                  >
                    <Pause className="w-4 h-4" />
                    STOP CLOCK
                  </button>
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

          {/* RIGHT: Away team */}
          <div className="flex-1 flex flex-col justify-center items-end px-7 py-3">
            <div className="flex items-center gap-4 mb-2">
              <div className="text-right min-w-0">
                <p className="text-white/80 font-semibold text-sm truncate">{awayTeam?.name}</p>
                <p className="text-5xl font-black text-white leading-none tabular-nums">{game.away_score || 0}</p>
              </div>
              <div
                className="w-14 h-14 flex-shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
                style={{ backgroundColor: awayTeam?.color || '#f97316' }}
              >
                {awayTeam?.name?.[0]}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleAwayTimeout}
                disabled={awayRemaining <= 0}
                className="px-3 rounded-lg font-bold text-xs bg-white/20 hover:bg-white/30 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                style={{ minHeight: '36px', minWidth: '100px' }}
              >
                TIMEOUT
              </button>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: segmentAllowance }).map((_, i) => (
                  <div key={i} className={`w-3 h-3 rounded-full border-2 ${i < awayRemaining ? 'bg-white border-white' : 'border-white/40'}`} />
                ))}
              </div>
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
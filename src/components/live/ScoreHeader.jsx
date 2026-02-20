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
function computeTimeLeft(game) {
  const stored = game.clock_time_left ?? ((game.period_minutes || 10) * 60);
  if (!game.clock_running || !game.clock_started_at) return Math.max(0, stored);
  const elapsed = (Date.now() - new Date(game.clock_started_at).getTime()) / 1000;
  return Math.max(0, stored - elapsed);
}

export default function ScoreHeader({ game, homeTeam, awayTeam, onGameUpdate }) {
  const isTimed = game?.game_mode === "timed" || (!game?.game_mode && game?.period_minutes);
  const periodType = game?.period_type || "quarters";
  const totalPeriods = game?.period_count || (periodType === "halves" ? 2 : 4);
  const periodMinutes = game?.period_minutes || 10;
  const overtimeMinutes = game?.overtime_minutes || 5;

  // Local display state — derived from game, updated every second if running
  const [displayTime, setDisplayTime] = useState(() => computeTimeLeft(game));
  const tickRef = useRef(null);

  const period = game?.clock_period ?? 1;
  const running = game?.clock_running ?? false;
  const isOvertime = period > totalPeriods;
  const periodLabel = getPeriodLabel(period, periodType);

  // Recompute display time whenever game clock state changes
  useEffect(() => {
    setDisplayTime(computeTimeLeft(game));
  }, [game.clock_running, game.clock_started_at, game.clock_time_left, game.clock_period]);

  // Tick every second while running to update display
  useEffect(() => {
    clearInterval(tickRef.current);
    if (running) {
      tickRef.current = setInterval(() => {
        setDisplayTime(computeTimeLeft(game));
      }, 500); // 500ms for snappier display
    }
    return () => clearInterval(tickRef.current);
  }, [running, game.clock_started_at, game.clock_time_left]);

  const isSaving = useRef(false);

  const handlePlayPause = async () => {
    if (!isTimed || isSaving.current) return;
    const currentTimeLeft = computeTimeLeft(game);
    if (currentTimeLeft <= 0 && !running) return;

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
    try {
      const updates = {
        clock_period: nextPeriod,
        clock_time_left: nextMins * 60,
        clock_running: false,
        clock_started_at: null,
      };
      await base44.entities.Game.update(game.id, updates);
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

  return (
    <Card className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 border-0 shadow-xl">
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
              {/* LIVE dot */}
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 bg-red-500 rounded-full flex-shrink-0 ${running ? 'animate-pulse' : ''}`} />
                <span className="text-white/70 text-[10px] font-bold tracking-widest uppercase">LIVE</span>
              </div>
              {/* Period + Timer + Play/Pause row */}
              <div className="flex items-center justify-center gap-1.5 w-full">
                {/* Prev period */}
                <button
                  onClick={handlePrevPeriod}
                  disabled={period <= 1}
                  className="text-white/40 hover:text-white/80 text-xs px-0.5 disabled:opacity-0 transition-colors"
                >‹</button>
                {/* Period label */}
                <button
                  onClick={handleNextPeriod}
                  className="text-white font-bold text-[11px] leading-none hover:text-white/80 transition-colors flex-shrink-0"
                  title="Next period"
                >
                  {periodLabel}
                </button>
                <span className="text-white/30 text-[10px]">|</span>
                {/* Timer display */}
                <span className={`font-mono font-bold text-sm leading-none flex-shrink-0 ${running ? 'text-green-300' : timeExpired ? 'text-red-300' : 'text-white'}`}>
                  {formatTime(displayTime)}
                </span>
                {/* Play/Pause button */}
                <button
                  onClick={handlePlayPause}
                  disabled={timeExpired && !running}
                  className="flex-shrink-0 text-white/70 hover:text-white disabled:opacity-30 transition-colors"
                  title={running ? "Pause" : "Start"}
                >
                  {running
                    ? <Pause className="w-3.5 h-3.5" />
                    : <Play className="w-3.5 h-3.5" />
                  }
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
  );
}
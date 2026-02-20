import React, { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Play, Pause } from "lucide-react";

function getPeriodLabel(period, periodType) {
  const totalRegulation = periodType === "halves" ? 2 : 4;
  if (period <= totalRegulation) {
    return periodType === "halves" ? `H${period}` : `Q${period}`;
  }
  return `OT${period - totalRegulation}`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ScoreHeader({ game, homeTeam, awayTeam }) {
  const isTimed = game?.game_mode === "timed" || (!game?.game_mode && game?.period_minutes);
  const periodType = game?.period_type || "quarters";
  const totalPeriods = game?.period_count || (periodType === "halves" ? 2 : 4);
  const periodMinutes = game?.period_minutes || 10;
  const overtimeMinutes = game?.overtime_minutes || 5;

  const [period, setPeriod] = useState(1);
  const [timeLeft, setTimeLeft] = useState(periodMinutes * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  const isOvertime = period > totalPeriods;
  const currentPeriodMinutes = isOvertime ? overtimeMinutes : periodMinutes;

  // Reset timer when period changes
  useEffect(() => {
    setTimeLeft(currentPeriodMinutes * 60);
    setRunning(false);
  }, [period, currentPeriodMinutes]);

  useEffect(() => {
    if (!running) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const periodLabel = getPeriodLabel(period, periodType);

  const handleTimerClick = () => {
    if (timeLeft === 0) return;
    setRunning(r => !r);
  };

  const handleNextPeriod = () => {
    setPeriod(p => p + 1);
  };

  const handlePrevPeriod = () => {
    if (period > 1) setPeriod(p => p - 1);
  };

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
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
                <span className="text-white/70 text-[10px] font-bold tracking-widest uppercase">LIVE</span>
              </div>
              {/* Period + Timer row */}
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
                {/* Timer */}
                <span className={`font-mono font-bold text-sm leading-none flex-shrink-0 ${running ? 'text-green-300' : timeLeft === 0 ? 'text-red-300' : 'text-white'}`}>
                  {formatTime(timeLeft)}
                </span>
                {/* Play/Pause button */}
                <button
                  onClick={handleTimerClick}
                  disabled={timeLeft === 0}
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
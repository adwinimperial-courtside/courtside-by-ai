import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function ClockDisplay({ game }) {
  const [displayTime, setDisplayTime] = useState(0);

  useEffect(() => {
    if (!game || game.game_mode !== 'timed' || !game.clock_running) {
      setDisplayTime(game?.clock_time_left || 0);
      return;
    }

    const startTime = new Date(game.clock_started_at).getTime();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const timeLeft = Math.max(0, (game.clock_time_left || 0) - elapsed);
      setDisplayTime(timeLeft);
    }, 100);

    return () => clearInterval(interval);
  }, [game?.clock_running, game?.clock_started_at, game?.clock_time_left, game?.game_mode]);

  const getPeriodLabel = () => {
    if (!game.clock_period) return 'Q1';
    const period = game.clock_period;
    const totalPeriods = game.period_count || (game.period_type === 'halves' ? 2 : 4);
    if (period > totalPeriods) return `OT${period - totalPeriods}`;
    if (game.period_type === 'halves') return period === 1 ? '1H' : '2H';
    return `Q${period}`;
  };

  const formatClockTime = () => {
    if (displayTime === undefined || displayTime === null) return '--:--';
    const mins = Math.floor(displayTime / 60);
    const secs = Math.floor(displayTime % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="text-center">
        <p className="text-sm text-slate-500 font-semibold">{getPeriodLabel()}</p>
        <p className="text-xl font-bold text-slate-900">{formatClockTime()}</p>
      </div>
      {game.status === 'in_progress' && (
        <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
      )}
    </div>
  );
}
import React from "react";
import { Card } from "@/components/ui/card";

export default function ScoreHeader({ game, homeTeam, awayTeam }) {
  return (
    <Card className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 border-0 shadow-xl">
      <div className="grid grid-cols-3 divide-x divide-white/20">
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

        <div className="py-3 px-4 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/60 text-xs mb-1">LIVE</p>
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full mx-auto animate-pulse" />
          </div>
        </div>

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
import React from "react";
import { Card } from "@/components/ui/card";

export default function ScoreHeader({ game, homeTeam, awayTeam }) {
  return (
    <Card className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 border-orange-500/30 backdrop-blur">
      <div className="grid grid-cols-3 divide-x divide-white/10">
        <div className="p-6 text-center">
          <div 
            className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg"
            style={{ backgroundColor: homeTeam?.color || '#f97316' }}
          >
            {homeTeam?.name?.[0]}
          </div>
          <h3 className="font-bold text-white text-lg mb-1">{homeTeam?.name}</h3>
          <p className="text-5xl font-bold text-white">{game.home_score || 0}</p>
        </div>

        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/60 text-sm mb-1">LIVE</p>
            <div className="w-3 h-3 bg-red-500 rounded-full mx-auto animate-pulse" />
          </div>
        </div>

        <div className="p-6 text-center">
          <div 
            className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg"
            style={{ backgroundColor: awayTeam?.color || '#f97316' }}
          >
            {awayTeam?.name?.[0]}
          </div>
          <h3 className="font-bold text-white text-lg mb-1">{awayTeam?.name}</h3>
          <p className="text-5xl font-bold text-white">{game.away_score || 0}</p>
        </div>
      </div>
    </Card>
  );
}
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, User } from "lucide-react";
import { buildPlayerAggregates } from "../statEngine";

// MOBILE_PLAYERSTATS_ENGINE_V1 — all calculations come from statEngine (single source of truth)
export default function MobilePlayerStats({ players, teams, stats, games = [] }) {
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  const playerAggregates = React.useMemo(() => {
    return buildPlayerAggregates({ players, teams, games, stats })
      .filter(p => p.gamesPlayed > 0)
      .map(p => ({
        ...p,
        gp: p.gamesPlayed,
        ppg: p.ppg.toFixed(1),
        twopm: p.twopm.toFixed(1),
        threepm: p.threepm.toFixed(1),
        ftm: p.ftm.toFixed(1),
        rpg: p.rpg.toFixed(1),
        apg: p.apg.toFixed(1),
        orebpg: p.orebpg.toFixed(1),
        drebpg: p.drebpg.toFixed(1),
        spg: p.spg.toFixed(1),
        bpg: p.bpg.toFixed(1),
        tpg: p.tpg.toFixed(1),
      }))
      .sort((a, b) => parseFloat(b.ppg) - parseFloat(a.ppg));
  }, [players, teams, games, stats]);

  if (playerAggregates.length === 0) {
    return <p className="text-slate-500 text-center py-8">No player stats yet</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <User className="w-4 h-4 text-purple-600" />
        <h2 className="text-base font-semibold text-slate-900">Player Statistics (Per Game)</h2>
      </div>
      {playerAggregates.map(player => {
        const isExpanded = expandedPlayer === player.id;
        return (
          <Card key={player.id} className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: player.team?.color || '#f97316' }}
                >
                  {player.jersey_number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-sm truncate">{player.name}</p>
                  <p className="text-xs text-slate-500">{player.team?.name} • {player.gp} GP</p>
                </div>
              </div>

              <div className="mb-2">
                <span className="text-2xl font-extrabold text-purple-600">{player.ppg}</span>
                <span className="text-sm text-slate-500 ml-1">PPG</span>
              </div>

              <div className="flex gap-3 text-xs text-slate-500 mb-2">
                <span>2PM <span className="font-semibold text-slate-700">{player.twopm}</span></span>
                <span>•</span>
                <span>3PM <span className="font-semibold text-slate-700">{player.threepm}</span></span>
                <span>•</span>
                <span>FTM <span className="font-semibold text-slate-700">{player.ftm}</span></span>
              </div>

              <div className="flex gap-3 text-xs text-slate-500 mb-3">
                <span>RPG <span className="font-semibold text-slate-700">{player.rpg}</span></span>
                <span>•</span>
                <span>APG <span className="font-semibold text-slate-700">{player.apg}</span></span>
              </div>

              <button
                onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
                className="text-xs text-purple-600 font-semibold flex items-center gap-1"
              >
                {isExpanded ? <><ChevronUp className="w-3 h-3" /> Hide Advanced</> : <><ChevronDown className="w-3 h-3" /> Show Advanced</>}
              </button>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>OREB <span className="font-semibold text-slate-700">{player.orebpg}</span></span>
                  <span>•</span>
                  <span>DREB <span className="font-semibold text-slate-700">{player.drebpg}</span></span>
                  <span>•</span>
                  <span>STL <span className="font-semibold text-slate-700">{player.spg}</span></span>
                  <span>•</span>
                  <span>BLK <span className="font-semibold text-slate-700">{player.bpg}</span></span>
                  <span>•</span>
                  <span>TO <span className="font-semibold text-slate-700">{player.tpg}</span></span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
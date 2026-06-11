import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Award } from "lucide-react";
import { buildLeaderBoards } from "./statEngine";

// LEADERS_ENGINE_V1 — all calculations come from statEngine (single source of truth)
export default function LeagueLeaders({ players, teams, stats, games = [] }) {
  const boards = React.useMemo(
    () => buildLeaderBoards({ players, teams, games, stats, topN: 5 }),
    [players, teams, games, stats]
  );

  const categories = [
    { key: 'points', valueKey: 'ppg', label: 'PPG Leaders', icon: '🏀' },
    { key: 'threes', valueKey: 'threepm', label: '3PM Leaders', icon: '🎯' },
    { key: 'rebounds', valueKey: 'rpg', label: 'RPG Leaders', icon: '💪' },
    { key: 'assists', valueKey: 'apg', label: 'APG Leaders', icon: '🤝' },
    { key: 'steals', valueKey: 'spg', label: 'SPG Leaders', icon: '👐' },
    { key: 'blocks', valueKey: 'bpg', label: 'BPG Leaders', icon: '🚫' },
  ];

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {categories.map(category => {
        const leaders = boards[category.key];

        return (
          <Card key={category.key} className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-2xl">{category.icon}</span>
                {category.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaders.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {leaders.map((player, index) => (
                    <div key={player.id} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-400 text-yellow-900' :
                        index === 1 ? 'bg-slate-300 text-slate-700' :
                        index === 2 ? 'bg-orange-300 text-orange-900' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: player.team?.color || '#f97316' }}
                      >
                        {player.jersey_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{player.name}</p>
                        <p className="text-xs text-slate-500">{player.team?.name}</p>
                      </div>
                      <p className="font-bold text-purple-600">{player[category.valueKey].toFixed(1)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
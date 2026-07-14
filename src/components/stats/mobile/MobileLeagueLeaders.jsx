import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { buildLeaderBoards } from "../statEngine";
import PlayerAvatar from "@/components/shared/PlayerAvatar";

// MOBILE_LEADERS_ENGINE_V1 — all calculations come from statEngine (single source of truth)
export default function MobileLeagueLeaders({ players, teams, stats, games = [] }) {
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
    <div className="space-y-4">
      {categories.map(category => {
        const leaders = boards[category.key];

        return (
          <Card key={category.key} className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{category.icon}</span>
                <h3 className="font-bold text-slate-900 text-sm">{category.label}</h3>
              </div>
              {leaders.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-2">No data yet</p>
              ) : (
                <div className="space-y-2">
                  {leaders.map((player, index) => (
                    <div key={player.id} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        index === 0 ? 'bg-yellow-400 text-yellow-900' :
                        index === 1 ? 'bg-slate-300 text-slate-700' :
                        index === 2 ? 'bg-orange-300 text-orange-900' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {index + 1}
                      </div>
                      {/* PLAYER_AVATAR_V1 */}
                      <PlayerAvatar player={player} size={28} teamColor={player.team?.color || '#f97316'} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{player.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{player.team?.name}</p>
                      </div>
                      <p className="font-bold text-purple-600 text-sm">{player[category.valueKey].toFixed(1)}</p>
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
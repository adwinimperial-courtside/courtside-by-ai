import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Award } from "lucide-react";

export default function LeagueLeaders({ players, teams, stats }) {
  const playerAggregates = players.map(player => {
    const playerStats = stats.filter(s => s.player_id === player.id);
    const team = teams.find(t => t.id === player.team_id);
    
    const totals = playerStats.reduce((acc, stat) => ({
      points: acc.points + ((stat.points_2 || 0) * 2) + ((stat.points_3 || 0) * 3),
      threes: acc.threes + (stat.points_3 || 0),
      rebounds: acc.rebounds + (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0),
      assists: acc.assists + (stat.assists || 0),
      steals: acc.steals + (stat.steals || 0),
      blocks: acc.blocks + (stat.blocks || 0),
    }), { points: 0, threes: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 });

    return { ...player, team, ...totals };
  }).filter(p => stats.some(s => s.player_id === p.id));

  const categories = [
    { key: 'points', label: 'Points Leaders', icon: '🏀' },
    { key: 'threes', label: '3-Point Leaders', icon: '🎯' },
    { key: 'rebounds', label: 'Rebound Leaders', icon: '💪' },
    { key: 'assists', label: 'Assist Leaders', icon: '🤝' },
    { key: 'steals', label: 'Steal Leaders', icon: '👐' },
    { key: 'blocks', label: 'Block Leaders', icon: '🚫' },
  ];

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {categories.map(category => {
        const leaders = [...playerAggregates]
          .sort((a, b) => b[category.key] - a[category.key])
          .slice(0, 5);

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
                      <p className="font-bold text-purple-600">{player[category.key]}</p>
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
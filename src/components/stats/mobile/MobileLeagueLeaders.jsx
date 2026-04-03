import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function MobileLeagueLeaders({ players, teams, stats, games = [] }) {
  const calcPoints = (stat) => {
    const game = games.find(g => g.id === stat.game_id);
    const isDigital = game && game.entry_type === 'digital' && !game.edited;
    return (isDigital ? (stat.points_2 || 0) * 2 : (stat.points_2 || 0)) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0);
  };

  const didPlayerParticipate = (stat) => {
    const hasStats = (stat.points_2 || 0) + (stat.points_3 || 0) + (stat.free_throws || 0) +
                     (stat.assists || 0) + (stat.steals || 0) + (stat.blocks || 0) +
                     (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0) +
                     (stat.fouls || 0) + (stat.technical_fouls || 0) + (stat.unsportsmanlike_fouls || 0) > 0;
    if (stat.did_play) return true;
    if ((stat.minutes_played || 0) > 0) return true;
    if (hasStats) return true;
    return false;
  };

  const playerAggregates = players.map(player => {
    const playerStats = stats.filter(s => s.player_id === player.id).filter(didPlayerParticipate);
    const team = teams.find(t => t.id === player.team_id);
    const gamesPlayed = playerStats.length;

    const totals = playerStats.reduce((acc, stat) => ({
      points: acc.points + calcPoints(stat),
      threes: acc.threes + (stat.points_3 || 0),
      rebounds: acc.rebounds + (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0),
      assists: acc.assists + (stat.assists || 0),
      steals: acc.steals + (stat.steals || 0),
      blocks: acc.blocks + (stat.blocks || 0),
    }), { points: 0, threes: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 });

    return {
      ...player,
      team,
      points: gamesPlayed > 0 ? totals.points / gamesPlayed : 0,
      threes: gamesPlayed > 0 ? totals.threes / gamesPlayed : 0,
      rebounds: gamesPlayed > 0 ? totals.rebounds / gamesPlayed : 0,
      assists: gamesPlayed > 0 ? totals.assists / gamesPlayed : 0,
      steals: gamesPlayed > 0 ? totals.steals / gamesPlayed : 0,
      blocks: gamesPlayed > 0 ? totals.blocks / gamesPlayed : 0,
    };
  }).filter(p => stats.some(s => s.player_id === p.id));

  const categories = [
    { key: 'points', label: 'PPG Leaders', icon: '🏀' },
    { key: 'threes', label: '3PM Leaders', icon: '🎯' },
    { key: 'rebounds', label: 'RPG Leaders', icon: '💪' },
    { key: 'assists', label: 'APG Leaders', icon: '🤝' },
    { key: 'steals', label: 'SPG Leaders', icon: '👐' },
    { key: 'blocks', label: 'BPG Leaders', icon: '🚫' },
  ];

  return (
    <div className="space-y-4">
      {categories.map(category => {
        const leaders = [...playerAggregates]
          .sort((a, b) => b[category.key] - a[category.key])
          .slice(0, 5);

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
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: player.team?.color || '#f97316' }}
                      >
                        {player.jersey_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{player.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{player.team?.name}</p>
                      </div>
                      <p className="font-bold text-purple-600 text-sm">{player[category.key].toFixed(1)}</p>
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
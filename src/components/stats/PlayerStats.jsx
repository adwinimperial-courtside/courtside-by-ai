import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User } from "lucide-react";

export default function PlayerStats({ players, teams, stats }) {
  const playerAggregates = players.map(player => {
    const playerStats = stats.filter(s => s.player_id === player.id);
    const team = teams.find(t => t.id === player.team_id);
    
    const totals = playerStats.reduce((acc, stat) => ({
      points: acc.points + ((stat.points_2 || 0) * 2) + ((stat.points_3 || 0) * 3),
      rebounds: acc.rebounds + (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0),
      assists: acc.assists + (stat.assists || 0),
      steals: acc.steals + (stat.steals || 0),
      blocks: acc.blocks + (stat.blocks || 0),
      turnovers: acc.turnovers + (stat.turnovers || 0),
      fouls: acc.fouls + (stat.fouls || 0),
      games: acc.games + 1
    }), { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0, games: 0 });

    return {
      ...player,
      team,
      ...totals,
      ppg: totals.games > 0 ? (totals.points / totals.games).toFixed(1) : '0.0',
      rpg: totals.games > 0 ? (totals.rebounds / totals.games).toFixed(1) : '0.0',
      apg: totals.games > 0 ? (totals.assists / totals.games).toFixed(1) : '0.0'
    };
  }).filter(p => p.games > 0).sort((a, b) => b.points - a.points);

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5 text-purple-600" />
          Player Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {playerAggregates.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No player stats yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-center">GP</TableHead>
                  <TableHead className="text-center">PTS</TableHead>
                  <TableHead className="text-center">REB</TableHead>
                  <TableHead className="text-center">AST</TableHead>
                  <TableHead className="text-center">STL</TableHead>
                  <TableHead className="text-center">BLK</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playerAggregates.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: player.team?.color || '#f97316' }}
                        >
                          {player.jersey_number}
                        </div>
                        <span className="font-medium">{player.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{player.team?.name}</TableCell>
                    <TableCell className="text-center">{player.games}</TableCell>
                    <TableCell className="text-center font-semibold">{player.points}</TableCell>
                    <TableCell className="text-center">{player.rebounds}</TableCell>
                    <TableCell className="text-center">{player.assists}</TableCell>
                    <TableCell className="text-center">{player.steals}</TableCell>
                    <TableCell className="text-center">{player.blocks}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
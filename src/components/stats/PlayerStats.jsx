import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User } from "lucide-react";

export default function PlayerStats({ players, teams, stats }) {
  const playerAggregates = players.map(player => {
    const playerStats = stats.filter(s => s.player_id === player.id);
    const team = teams.find(t => t.id === player.team_id);
    
    const totals = playerStats.reduce((acc, stat) => ({
      points: acc.points + ((stat.points_2 || 0) * 2) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0),
      points_2: acc.points_2 + (stat.points_2 || 0),
      points_3: acc.points_3 + (stat.points_3 || 0),
      freeThrows: acc.freeThrows + (stat.free_throws || 0),
      offensiveRebounds: acc.offensiveRebounds + (stat.offensive_rebounds || 0),
      defensiveRebounds: acc.defensiveRebounds + (stat.defensive_rebounds || 0),
      rebounds: acc.rebounds + (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0),
      assists: acc.assists + (stat.assists || 0),
      steals: acc.steals + (stat.steals || 0),
      blocks: acc.blocks + (stat.blocks || 0),
      turnovers: acc.turnovers + (stat.turnovers || 0),
      fouls: acc.fouls + (stat.fouls || 0),
      games: acc.games + 1
    }), { points: 0, points_2: 0, points_3: 0, freeThrows: 0, offensiveRebounds: 0, defensiveRebounds: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0, games: 0 });

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
                  <TableHead className="text-center">PPG</TableHead>
                  <TableHead className="text-center">2PM</TableHead>
                  <TableHead className="text-center">3PM</TableHead>
                  <TableHead className="text-center">FTM</TableHead>
                  <TableHead className="text-center">OREB</TableHead>
                  <TableHead className="text-center">DREB</TableHead>
                  <TableHead className="text-center">RPG</TableHead>
                  <TableHead className="text-center">APG</TableHead>
                  <TableHead className="text-center">SPG</TableHead>
                  <TableHead className="text-center">BPG</TableHead>
                  <TableHead className="text-center">TPG</TableHead>
                  <TableHead className="text-center">FPG</TableHead>
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
                    <TableCell className="text-center font-semibold">{player.ppg}</TableCell>
                    <TableCell className="text-center">{(player.points_2 / player.games).toFixed(1)}</TableCell>
                    <TableCell className="text-center">{(player.points_3 / player.games).toFixed(1)}</TableCell>
                    <TableCell className="text-center">{(player.freeThrows / player.games).toFixed(1)}</TableCell>
                    <TableCell className="text-center">{(player.offensiveRebounds / player.games).toFixed(1)}</TableCell>
                    <TableCell className="text-center">{(player.defensiveRebounds / player.games).toFixed(1)}</TableCell>
                    <TableCell className="text-center">{player.rpg}</TableCell>
                    <TableCell className="text-center">{player.apg}</TableCell>
                    <TableCell className="text-center">{(player.steals / player.games).toFixed(1)}</TableCell>
                    <TableCell className="text-center">{(player.blocks / player.games).toFixed(1)}</TableCell>
                    <TableCell className="text-center">{(player.turnovers / player.games).toFixed(1)}</TableCell>
                    <TableCell className="text-center">{(player.fouls / player.games).toFixed(1)}</TableCell>
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
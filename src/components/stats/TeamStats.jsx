import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield } from "lucide-react";

export default function TeamStats({ teams, games, stats, leagues }) {
  const teamStatistics = teams.map(team => {
    const teamGames = games.filter(g => 
      g.status === 'completed' && (g.home_team_id === team.id || g.away_team_id === team.id)
    );

    const teamStats = stats.filter(s => s.team_id === team.id);
    
    const totals = teamStats.reduce((acc, stat) => ({
      points: acc.points + ((stat.points_2 || 0) * 2) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0),
      offensiveRebounds: acc.offensiveRebounds + (stat.offensive_rebounds || 0),
      defensiveRebounds: acc.defensiveRebounds + (stat.defensive_rebounds || 0),
      rebounds: acc.rebounds + (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0),
      assists: acc.assists + (stat.assists || 0),
      steals: acc.steals + (stat.steals || 0),
      blocks: acc.blocks + (stat.blocks || 0),
      turnovers: acc.turnovers + (stat.turnovers || 0),
      fouls: acc.fouls + (stat.fouls || 0),
    }), { points: 0, offensiveRebounds: 0, defensiveRebounds: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0 });

    const gamesPlayed = teamGames.length;

    return {
      ...team,
      gamesPlayed,
      totalPoints: totals.points,
      totalOffensiveRebounds: totals.offensiveRebounds,
      totalDefensiveRebounds: totals.defensiveRebounds,
      totalRebounds: totals.rebounds,
      totalAssists: totals.assists,
      totalSteals: totals.steals,
      totalBlocks: totals.blocks,
      totalTurnovers: totals.turnovers,
      totalFouls: totals.fouls,
      ppg: gamesPlayed > 0 ? (totals.points / gamesPlayed).toFixed(1) : '0.0',
      rpg: gamesPlayed > 0 ? (totals.rebounds / gamesPlayed).toFixed(1) : '0.0',
      apg: gamesPlayed > 0 ? (totals.assists / gamesPlayed).toFixed(1) : '0.0',
    };
  }).filter(t => t.gamesPlayed > 0).sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-600" />
          Team Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {teamStatistics.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No team stats yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>League</TableHead>
                  <TableHead className="text-center">GP</TableHead>
                  <TableHead className="text-center">PPG</TableHead>
                  <TableHead className="text-center">RPG</TableHead>
                  <TableHead className="text-center">APG</TableHead>
                  <TableHead className="text-center">OREB</TableHead>
                  <TableHead className="text-center">DREB</TableHead>
                  <TableHead className="text-center">STL</TableHead>
                  <TableHead className="text-center">BLK</TableHead>
                  <TableHead className="text-center">TO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamStatistics.map((team) => {
                  const league = leagues.find(l => l.id === team.league_id);
                  return (
                    <TableRow key={team.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: team.color || '#f97316' }}
                          >
                            {team.name?.[0]}
                          </div>
                          <span className="font-medium">{team.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{league?.name}</TableCell>
                      <TableCell className="text-center">{team.gamesPlayed}</TableCell>
                      <TableCell className="text-center font-semibold text-purple-600">{team.ppg}</TableCell>
                      <TableCell className="text-center">{team.rpg}</TableCell>
                      <TableCell className="text-center">{team.apg}</TableCell>
                      <TableCell className="text-center">{team.totalOffensiveRebounds}</TableCell>
                      <TableCell className="text-center">{team.totalDefensiveRebounds}</TableCell>
                      <TableCell className="text-center">{team.totalSteals}</TableCell>
                      <TableCell className="text-center">{team.totalBlocks}</TableCell>
                      <TableCell className="text-center">{team.totalTurnovers}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield } from "lucide-react";
import TeamLogo from "../teams/TeamLogo";

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
      ppg: gamesPlayed > 0 ? (totals.points / gamesPlayed).toFixed(1) : '0.0',
      rpg: gamesPlayed > 0 ? (totals.rebounds / gamesPlayed).toFixed(1) : '0.0',
      apg: gamesPlayed > 0 ? (totals.assists / gamesPlayed).toFixed(1) : '0.0',
      orebpg: gamesPlayed > 0 ? (totals.offensiveRebounds / gamesPlayed).toFixed(1) : '0.0',
      drebpg: gamesPlayed > 0 ? (totals.defensiveRebounds / gamesPlayed).toFixed(1) : '0.0',
      stlpg: gamesPlayed > 0 ? (totals.steals / gamesPlayed).toFixed(1) : '0.0',
      blkpg: gamesPlayed > 0 ? (totals.blocks / gamesPlayed).toFixed(1) : '0.0',
      topg: gamesPlayed > 0 ? (totals.turnovers / gamesPlayed).toFixed(1) : '0.0',
    };
  }).filter(t => t.gamesPlayed > 0).sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-600" />
          Team Statistics (Per Game Averages)
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
                  <TableHead className="hidden md:table-cell">League</TableHead>
                  <TableHead className="text-center">GP</TableHead>
                  <TableHead className="text-center">PTS</TableHead>
                  <TableHead className="text-center">REB</TableHead>
                  <TableHead className="text-center">AST</TableHead>
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
                        <div className="flex items-center gap-2 min-w-0">
                          <TeamLogo team={team} size="sm" />
                          <span className="font-medium truncate text-sm md:text-base">{team.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-slate-600 text-sm">{league?.name}</TableCell>
                      <TableCell className="text-center">{team.gamesPlayed}</TableCell>
                      <TableCell className="text-center font-semibold text-purple-600">{team.ppg}</TableCell>
                      <TableCell className="text-center">{team.rpg}</TableCell>
                      <TableCell className="text-center">{team.apg}</TableCell>
                      <TableCell className="text-center">{team.orebpg}</TableCell>
                      <TableCell className="text-center">{team.drebpg}</TableCell>
                      <TableCell className="text-center">{team.stlpg}</TableCell>
                      <TableCell className="text-center">{team.blkpg}</TableCell>
                      <TableCell className="text-center">{team.topg}</TableCell>
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
import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy } from "lucide-react";
import TeamLogo from "../teams/TeamLogo";

export default function TeamStandings({ teams, games, leagues }) {
  const teamStandings = teams.map(team => {
    const teamGames = games.filter(g => 
      g.status === 'completed' && (g.home_team_id === team.id || g.away_team_id === team.id)
    );
    
    const wins = team.wins || 0;
    const losses = team.losses || 0;
    const totalGames = wins + losses;
    const winPct = totalGames > 0 ? (wins / totalGames * 100).toFixed(1) : '0.0';

    // Calculate points differential
    let pointsFor = 0;
    let pointsAgainst = 0;
    teamGames.forEach(game => {
      if (game.home_team_id === team.id) {
        pointsFor += game.home_score || 0;
        pointsAgainst += game.away_score || 0;
      } else {
        pointsFor += game.away_score || 0;
        pointsAgainst += game.home_score || 0;
      }
    });
    const pointsDiff = pointsFor - pointsAgainst;

    return {
      ...team,
      wins,
      losses,
      winPct: parseFloat(winPct),
      pointsDiff
    };
  }).sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    return b.pointsDiff - a.pointsDiff;
  });

  return (
    <Card className="border-slate-200 w-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-purple-600" />
          Team Standings
        </CardTitle>
      </CardHeader>
      <CardContent>
        {teamStandings.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No teams yet</p>
        ) : (
          <>
            {/* Mobile: card layout */}
            <div className="block sm:hidden space-y-2">
              {teamStandings.map((team, index) => {
                const league = leagues.find(l => l.id === team.league_id);
                return (
                  <div key={team.id} className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
                    <span className="text-base font-bold text-slate-400 w-5 text-center flex-shrink-0">{index + 1}</span>
                    <TeamLogo team={team} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate text-sm">{team.name}</p>
                      {league && <p className="text-xs text-slate-400 truncate">{league.name}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 text-xs font-bold">
                      <span className="text-green-600">{team.wins}W</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-red-500">{team.losses}L</span>
                      <span className="text-slate-300">·</span>
                      <span className={team.pointsDiff > 0 ? 'text-green-600' : team.pointsDiff < 0 ? 'text-red-500' : 'text-slate-500'}>
                        {team.pointsDiff > 0 ? '+' : ''}{team.pointsDiff}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table layout */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="hidden md:table-cell">League</TableHead>
                    <TableHead className="text-center">W</TableHead>
                    <TableHead className="text-center">L</TableHead>
                    <TableHead className="text-center">Win %</TableHead>
                    <TableHead className="text-center">+/-</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamStandings.map((team, index) => {
                    const league = leagues.find(l => l.id === team.league_id);
                    return (
                      <TableRow key={team.id}>
                        <TableCell className="font-semibold">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            <TeamLogo team={team} size="sm" />
                            <span className="font-medium truncate">{team.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-slate-600 text-sm">{league?.name}</TableCell>
                        <TableCell className="text-center font-semibold text-green-600">{team.wins}</TableCell>
                        <TableCell className="text-center font-semibold text-red-600">{team.losses}</TableCell>
                        <TableCell className="text-center font-semibold">{team.winPct}%</TableCell>
                        <TableCell className={`text-center font-semibold ${team.pointsDiff > 0 ? 'text-green-600' : team.pointsDiff < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                          {team.pointsDiff > 0 ? '+' : ''}{team.pointsDiff}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
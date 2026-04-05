import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy } from "lucide-react";
import TeamLogo from "../teams/TeamLogo";

export default function TeamStandings({ teams, games, leagues }) {
  const teamStandings = teams.map(team => {
    const completedGames = games.filter(g =>
      g.status === 'completed' && (g.home_team_id === team.id || g.away_team_id === team.id)
    );

    let wins = 0;
    let losses = 0;

    completedGames.forEach(game => {
      // Default games: use default_winner_team_id / default_loser_team_id for standings
      if (game.is_default_result) {
        if (game.default_winner_team_id === team.id) wins++;
        else if (game.default_loser_team_id === team.id) losses++;
        return;
      }
      // Normal played game
      const isHome = game.home_team_id === team.id;
      const teamScore = isHome ? (game.home_score || 0) : (game.away_score || 0);
      const oppScore = isHome ? (game.away_score || 0) : (game.home_score || 0);
      if (teamScore > oppScore) wins++;
      else losses++;
    });
    const totalGames = wins + losses;
    const winPct = totalGames > 0 ? (wins / totalGames * 100).toFixed(1) : '0.0';

    // Points differential — only for actually played games (exclude defaults)
    let pointsFor = 0;
    let pointsAgainst = 0;
    completedGames.filter(g => !g.is_default_result).forEach(game => {
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
      <CardHeader className="py-3 px-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="w-4 h-4 text-purple-600" />
          Team Standings
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        {teamStandings.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No teams yet</p>
        ) : (
          <>
            {/* Mobile: table layout */}
            <div className="block sm:hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="text-left pb-2 pl-1 font-semibold">#</th>
                    <th className="text-left pb-2 font-semibold">Team</th>
                    <th className="text-center pb-2 font-semibold">W</th>
                    <th className="text-center pb-2 font-semibold">L</th>
                    <th className="text-center pb-2 font-semibold">+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {teamStandings.map((team, index) => (
                    <tr key={team.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pl-1 text-slate-400 font-bold">{index + 1}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <TeamLogo team={team} size="sm" />
                          <span className="font-semibold text-slate-900 truncate max-w-[100px]">{team.name}</span>
                        </div>
                      </td>
                      <td className="py-2 text-center font-bold text-green-600">{team.wins}</td>
                      <td className="py-2 text-center font-bold text-red-500">{team.losses}</td>
                      <td className={`py-2 text-center font-bold ${team.pointsDiff > 0 ? 'text-green-600' : team.pointsDiff < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                        {team.pointsDiff > 0 ? '+' : ''}{team.pointsDiff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
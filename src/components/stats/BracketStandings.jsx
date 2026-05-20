import React, { useState } from "react";
import TeamStandings from "./TeamStandings";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy } from "lucide-react";
import TeamLogo from "../teams/TeamLogo";

// Standalone standings calculator (mirrors TeamStandings logic)
function computeStandings(teams, games) {
  const unsorted = teams.map(team => {
    const completedGames = games.filter(g =>
      g.status === 'completed' && (g.home_team_id === team.id || g.away_team_id === team.id)
    );
    let wins = 0, losses = 0, pointsFor = 0, pointsAgainst = 0;
    completedGames.forEach(game => {
      if (game.is_default_result) {
        if (game.default_winner_team_id === team.id) wins++;
        else if (game.default_loser_team_id === team.id) losses++;
        return;
      }
      const isHome = game.home_team_id === team.id;
      const ts = isHome ? (game.home_score || 0) : (game.away_score || 0);
      const os = isHome ? (game.away_score || 0) : (game.home_score || 0);
      if (ts > os) wins++; else losses++;
      if (!game.is_default_result) { pointsFor += ts; pointsAgainst += os; }
    });
    const total = wins + losses;
    const winPct = total > 0 ? parseFloat((wins / total * 100).toFixed(1)) : 0;
    return { ...team, wins, losses, winPct, pointsDiff: pointsFor - pointsAgainst };
  });

  const getMiniStats = (teamId, subGames) => {
    let wins = 0, losses = 0, pf = 0, pa = 0;
    subGames.forEach(g => {
      if (g.home_team_id !== teamId && g.away_team_id !== teamId) return;
      if (g.is_default_result) {
        if (g.default_winner_team_id === teamId) wins++;
        else if (g.default_loser_team_id === teamId) losses++;
        return;
      }
      const isHome = g.home_team_id === teamId;
      const ts = isHome ? (g.home_score || 0) : (g.away_score || 0);
      const os = isHome ? (g.away_score || 0) : (g.home_score || 0);
      if (ts > os) wins++; else losses++;
      pf += ts; pa += os;
    });
    const total = wins + losses;
    return { winPct: total > 0 ? wins / total : 0, diff: pf - pa };
  };

  const sortTiedGroup = (group) => {
    if (group.length === 1) return group;
    if (group.length === 2) {
      const [a, b] = group;
      const h2hGames = games.filter(g =>
        g.status === 'completed' &&
        ((g.home_team_id === a.id && g.away_team_id === b.id) ||
         (g.home_team_id === b.id && g.away_team_id === a.id))
      );
      const sa = getMiniStats(a.id, h2hGames);
      const sb = getMiniStats(b.id, h2hGames);
      if (sb.winPct !== sa.winPct) return sb.winPct > sa.winPct ? [b, a] : [a, b];
      return b.pointsDiff >= a.pointsDiff ? [b, a] : [a, b];
    }
    return [...group].sort((a, b) => b.pointsDiff - a.pointsDiff);
  };

  const sorted = [];
  const seen = new Set();
  const byWinPct = [...unsorted].sort((a, b) => b.winPct - a.winPct);
  byWinPct.forEach(team => {
    if (seen.has(team.id)) return;
    const group = byWinPct.filter(t => t.winPct === team.winPct);
    group.forEach(t => seen.add(t.id));
    sortTiedGroup(group).forEach(t => sorted.push(t));
  });
  return sorted;
}

function OverallTable({ teams, games }) {
  const standings = computeStandings(teams, games);
  return (
    <Card className="border-slate-200 w-full overflow-hidden">
      <CardHeader className="py-3 px-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="w-4 h-4 text-purple-600" />
          Overall Standings
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        {standings.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No teams yet</p>
        ) : (
          <>
            {/* Mobile */}
            <div className="block sm:hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="text-left pb-2 pl-1 font-semibold">#</th>
                    <th className="text-left pb-2 font-semibold">Team</th>
                    <th className="text-left pb-2 font-semibold">Bracket</th>
                    <th className="text-center pb-2 font-semibold">W</th>
                    <th className="text-center pb-2 font-semibold">L</th>
                    <th className="text-center pb-2 font-semibold">+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((team, index) => (
                    <tr key={team.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pl-1 text-slate-400 font-bold">{index + 1}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <TeamLogo team={team} size="sm" />
                          <span className="font-semibold text-slate-900 truncate max-w-[80px]">{team.name}</span>
                        </div>
                      </td>
                      <td className="py-2">
                        {team.bracket ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 whitespace-nowrap">{team.bracket}</span>
                        ) : null}
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
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Bracket</TableHead>
                    <TableHead className="text-center">W</TableHead>
                    <TableHead className="text-center">L</TableHead>
                    <TableHead className="text-center">Win %</TableHead>
                    <TableHead className="text-center">+/-</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((team, index) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-semibold">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <TeamLogo team={team} size="sm" />
                          <span className="font-medium truncate">{team.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {team.bracket ? (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">{team.bracket}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-green-600">{team.wins}</TableCell>
                      <TableCell className="text-center font-semibold text-red-600">{team.losses}</TableCell>
                      <TableCell className="text-center font-semibold">{team.winPct}%</TableCell>
                      <TableCell className={`text-center font-semibold ${team.pointsDiff > 0 ? 'text-green-600' : team.pointsDiff < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                        {team.pointsDiff > 0 ? '+' : ''}{team.pointsDiff}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function BracketStandings({ teams, games, leagues }) {
  const brackets = [...new Set(teams.filter(t => t.bracket).map(t => t.bracket))].sort();
  const tabs = ["Overall", ...brackets];
  const [activeTab, setActiveTab] = useState(brackets[0] || "Overall");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-yellow-500 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Overall" ? (
        <OverallTable teams={teams} games={games} />
      ) : (
        <TeamStandings
          teams={teams.filter(t => t.bracket === activeTab)}
          games={games}
          leagues={leagues}
        />
      )}
    </div>
  );
}
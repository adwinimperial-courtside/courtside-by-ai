import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export default function PlayerStats({ players, teams, stats }) {
  const [sortField, setSortField] = useState("points");
  const [sortDirection, setSortDirection] = useState("desc");

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
  }).filter(p => p.games > 0);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedData = [...playerAggregates].sort((a, b) => {
    const aVal = typeof a[sortField] === 'string' ? parseFloat(a[sortField]) : a[sortField];
    const bVal = typeof b[sortField] === 'string' ? parseFloat(b[sortField]) : b[sortField];
    
    if (sortDirection === "asc") {
      return aVal - bVal;
    }
    return bVal - aVal;
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 opacity-40" />;
    return sortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

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
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("games")}>
                     <div className="flex items-center justify-center gap-1">GP <SortIcon field="games" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("ppg")}>
                     <div className="flex items-center justify-center gap-1">PPG <SortIcon field="ppg" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("points_2")}>
                     <div className="flex items-center justify-center gap-1">2PM <SortIcon field="points_2" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("points_3")}>
                     <div className="flex items-center justify-center gap-1">3PM <SortIcon field="points_3" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("freeThrows")}>
                     <div className="flex items-center justify-center gap-1">FTM <SortIcon field="freeThrows" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("offensiveRebounds")}>
                     <div className="flex items-center justify-center gap-1">OREB <SortIcon field="offensiveRebounds" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("defensiveRebounds")}>
                     <div className="flex items-center justify-center gap-1">DREB <SortIcon field="defensiveRebounds" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("rpg")}>
                     <div className="flex items-center justify-center gap-1">RPG <SortIcon field="rpg" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("apg")}>
                     <div className="flex items-center justify-center gap-1">APG <SortIcon field="apg" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("steals")}>
                     <div className="flex items-center justify-center gap-1">SPG <SortIcon field="steals" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("blocks")}>
                     <div className="flex items-center justify-center gap-1">BPG <SortIcon field="blocks" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("turnovers")}>
                     <div className="flex items-center justify-center gap-1">TPG <SortIcon field="turnovers" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("fouls")}>
                     <div className="flex items-center justify-center gap-1">FPG <SortIcon field="fouls" /></div>
                   </TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {sortedData.map((player) => (
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
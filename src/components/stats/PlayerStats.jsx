import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export default function PlayerStats({ players, teams, stats }) {
  const [sortField, setSortField] = useState("points");
  const [sortDirection, setSortDirection] = useState("desc");

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
    const playerStats = stats.filter(s => s.player_id === player.id);
    const participatedStats = playerStats.filter(didPlayerParticipate);
    const team = teams.find(t => t.id === player.team_id);
    
    const totals = participatedStats.reduce((acc, stat) => ({
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
      twopm: totals.games > 0 ? (totals.points_2 / totals.games).toFixed(1) : '0.0',
      threepm: totals.games > 0 ? (totals.points_3 / totals.games).toFixed(1) : '0.0',
      ftm: totals.games > 0 ? (totals.freeThrows / totals.games).toFixed(1) : '0.0',
      orebpg: totals.games > 0 ? (totals.offensiveRebounds / totals.games).toFixed(1) : '0.0',
      drebpg: totals.games > 0 ? (totals.defensiveRebounds / totals.games).toFixed(1) : '0.0',
      rpg: totals.games > 0 ? (totals.rebounds / totals.games).toFixed(1) : '0.0',
      apg: totals.games > 0 ? (totals.assists / totals.games).toFixed(1) : '0.0',
      spg: totals.games > 0 ? (totals.steals / totals.games).toFixed(1) : '0.0',
      bpg: totals.games > 0 ? (totals.blocks / totals.games).toFixed(1) : '0.0',
      tpg: totals.games > 0 ? (totals.turnovers / totals.games).toFixed(1) : '0.0',
      fpg: totals.games > 0 ? (totals.fouls / totals.games).toFixed(1) : '0.0'
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
                    <TableHead className="hidden md:table-cell">Team</TableHead>
                    <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("games")}>
                     <div className="flex items-center justify-center gap-1">GP <SortIcon field="games" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("ppg")}>
                     <div className="flex items-center justify-center gap-1">PPG <SortIcon field="ppg" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("twopm")}>
                     <div className="flex items-center justify-center gap-1">2PM <SortIcon field="twopm" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("threepm")}>
                     <div className="flex items-center justify-center gap-1">3PM <SortIcon field="threepm" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("ftm")}>
                     <div className="flex items-center justify-center gap-1">FTM <SortIcon field="ftm" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("orebpg")}>
                     <div className="flex items-center justify-center gap-1">OREB <SortIcon field="orebpg" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("drebpg")}>
                     <div className="flex items-center justify-center gap-1">DREB <SortIcon field="drebpg" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("rpg")}>
                     <div className="flex items-center justify-center gap-1">RPG <SortIcon field="rpg" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("apg")}>
                     <div className="flex items-center justify-center gap-1">APG <SortIcon field="apg" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("spg")}>
                     <div className="flex items-center justify-center gap-1">STL <SortIcon field="spg" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("bpg")}>
                     <div className="flex items-center justify-center gap-1">BLK <SortIcon field="bpg" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("tpg")}>
                     <div className="flex items-center justify-center gap-1">TO <SortIcon field="tpg" /></div>
                   </TableHead>
                   <TableHead className="text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("fpg")}>
                     <div className="flex items-center justify-center gap-1">PF <SortIcon field="fpg" /></div>
                   </TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {sortedData.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: player.team?.color || '#f97316' }}
                        >
                          {player.jersey_number}
                        </div>
                        <span className="font-medium truncate text-sm md:text-base">{player.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-slate-600 text-sm">{player.team?.name}</TableCell>
                    <TableCell className="text-center">{player.games}</TableCell>
                    <TableCell className="text-center font-semibold">{player.ppg}</TableCell>
                    <TableCell className="text-center">{player.twopm}</TableCell>
                    <TableCell className="text-center">{player.threepm}</TableCell>
                    <TableCell className="text-center">{player.ftm}</TableCell>
                    <TableCell className="text-center">{player.orebpg}</TableCell>
                    <TableCell className="text-center">{player.drebpg}</TableCell>
                    <TableCell className="text-center">{player.rpg}</TableCell>
                    <TableCell className="text-center">{player.apg}</TableCell>
                    <TableCell className="text-center">{player.spg}</TableCell>
                    <TableCell className="text-center">{player.bpg}</TableCell>
                    <TableCell className="text-center">{player.tpg}</TableCell>
                    <TableCell className="text-center">{player.fpg}</TableCell>
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
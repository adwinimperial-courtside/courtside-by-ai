import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { buildPlayerAggregates } from "./statEngine";

// PLAYERSTATS_ENGINE_V1 — all calculations come from statEngine (single source of truth)
export default function PlayerStats({ players, teams, stats, games = [] }) {
  const [sortField, setSortField] = useState("points");
  const [sortDirection, setSortDirection] = useState("desc");

  const playerAggregates = React.useMemo(() => {
    return buildPlayerAggregates({ players, teams, games, stats })
      .filter(p => p.gamesPlayed > 0)
      .map(p => ({
        ...p,
        games: p.gamesPlayed,
        points: p.totals.points,
        ppg: p.ppg.toFixed(1),
        twopm: p.twopm.toFixed(1),
        threepm: p.threepm.toFixed(1),
        ftm: p.ftm.toFixed(1),
        orebpg: p.orebpg.toFixed(1),
        drebpg: p.drebpg.toFixed(1),
        rpg: p.rpg.toFixed(1),
        apg: p.apg.toFixed(1),
        spg: p.spg.toFixed(1),
        bpg: p.bpg.toFixed(1),
        tpg: p.tpg.toFixed(1),
        fpg: p.fpg.toFixed(1),
      }));
  }, [players, teams, games, stats]);

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
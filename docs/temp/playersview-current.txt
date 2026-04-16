import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowUpDown } from "lucide-react";

export default function PlayersView() {
  const [sortConfig, setSortConfig] = useState({ key: 'created_date', direction: 'desc' });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
  });

  const players = useMemo(() => users.filter(u => u.user_type === 'player'), [users]);

  const sortedPlayers = useMemo(() => {
    const sorted = [...players];
    sorted.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (sortConfig.key === 'created_date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [players, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getLeagueNames = (leagueIds) => {
    if (!leagueIds || leagueIds.length === 0) return 'None';
    return leagueIds.map(id => {
      const league = leagues.find(l => l.id === id);
      return league ? league.name : 'Unknown';
    }).join(', ');
  };

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Players</CardTitle>
            <p className="text-sm text-slate-600 mt-2">Users with Player access</p>
          </div>
          <Badge className="bg-indigo-100 text-indigo-800 text-lg px-3 py-1">
            {players.length} Total
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>
                  <button onClick={() => handleSort('full_name')} className="flex items-center gap-2 font-semibold hover:text-slate-900">
                    Name <ArrowUpDown className="w-4 h-4" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => handleSort('created_date')} className="flex items-center gap-2 font-semibold hover:text-slate-900">
                    Created On <ArrowUpDown className="w-4 h-4" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => handleSort('email')} className="flex items-center gap-2 font-semibold hover:text-slate-900">
                    Email <ArrowUpDown className="w-4 h-4" />
                  </button>
                </TableHead>
                <TableHead>Assigned Leagues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlayers.length > 0 ? (
                sortedPlayers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell className="text-slate-600">{new Date(user.created_date).toLocaleString()}</TableCell>
                    <TableCell className="text-slate-600">{user.email}</TableCell>
                    <TableCell className="text-slate-600">{getLeagueNames(user.assigned_league_ids)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">No players found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
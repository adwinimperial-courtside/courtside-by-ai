import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users } from "lucide-react";

export default function AllPlayersView() {
  const [search, setSearch] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: players = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ['allPlayers'],
    queryFn: () => base44.entities.Player.list(),
    enabled: currentUser?.user_type === 'app_admin',
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['allTeams'],
    queryFn: () => base44.entities.Team.list(),
    enabled: currentUser?.user_type === 'app_admin',
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ['allLeagues'],
    queryFn: () => base44.entities.League.list(),
    enabled: currentUser?.user_type === 'app_admin',
  });

  if (currentUser && currentUser.user_type !== 'app_admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
          <Users className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const getTeam = (teamId) => teams.find(t => t.id === teamId);
  const getLeague = (leagueId) => leagues.find(l => l.id === leagueId);

  const enrichedPlayers = players.map(player => {
    const team = getTeam(player.team_id);
    const league = team ? getLeague(team.league_id) : null;
    return { ...player, teamName: team?.name || '—', leagueName: league?.name || '—', leagueSeason: league?.season || '' };
  });

  const filtered = search.trim()
    ? enrichedPlayers.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.teamName?.toLowerCase().includes(search.toLowerCase()) ||
        p.leagueName?.toLowerCase().includes(search.toLowerCase())
      )
    : enrichedPlayers;

  const sorted = [...filtered].sort((a, b) => a.name?.localeCompare(b.name));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">All Players</h1>
            <p className="text-slate-500 text-sm">{enrichedPlayers.length} total players across all leagues</p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by player name, team, or league..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-11 bg-white shadow-sm"
          />
        </div>

        {loadingPlayers ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No players found{search ? ` for "${search}"` : ''}.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Player</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Position</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Team</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">League</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((player, idx) => (
                  <tr key={player.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                    <td className="px-4 py-3 text-slate-500 font-mono">{player.jersey_number ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{player.name}</td>
                    <td className="px-4 py-3">
                      {player.position ? (
                        <Badge variant="outline" className="text-xs">{player.position}</Badge>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{player.teamName}</td>
                    <td className="px-4 py-3">
                      <span className="text-slate-700">{player.leagueName}</span>
                      {player.leagueSeason && <span className="text-slate-400 text-xs ml-1">({player.leagueSeason})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100">
              Showing {sorted.length} of {enrichedPlayers.length} players
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
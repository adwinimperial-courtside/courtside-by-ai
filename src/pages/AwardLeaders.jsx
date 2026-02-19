import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Filter } from "lucide-react";

import AwardLeadersComponent from "../components/stats/AwardLeaders";

export default function AwardLeadersPage() {
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        if (user?.default_league_id) {
          setSelectedLeague(user.default_league_id);
        } else {
          setSelectedLeague("all");
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };
    fetchUser();
  }, []);

  const { data: leagues } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
    initialData: [],
  });

  const isLeagueAdmin = currentUser?.user_type === 'league_admin';
  const assignedLeagueIds = currentUser?.assigned_league_ids || [];
  const visibleLeagues = isLeagueAdmin
    ? leagues.filter(league => assignedLeagueIds.includes(league.id))
    : leagues;

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
    initialData: [],
  });

  const { data: players } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list(),
    initialData: [],
  });

  const { data: games } = useQuery({
    queryKey: ['games'],
    queryFn: () => base44.entities.Game.list(),
    initialData: [],
  });

  const { data: allStats } = useQuery({
    queryKey: ['allPlayerStats'],
    queryFn: () => base44.entities.PlayerStats.list(),
    initialData: [],
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Award Leaders</h1>
          </div>
          <p className="text-slate-600 ml-15">MVP candidates, Mythical 5, and Defensive Player of the Year</p>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-5 h-5 text-yellow-600" />
            <h2 className="text-lg font-semibold text-slate-900">Select League</h2>
          </div>
          <div className="max-w-md">
            <Select value={selectedLeague} onValueChange={setSelectedLeague}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select league" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value="all">All Leagues</SelectItem>
                 {visibleLeagues.map(league => (
                   <SelectItem key={league.id} value={league.id}>
                     {league.name} ({league.season})
                   </SelectItem>
                 ))}
               </SelectContent>
            </Select>
          </div>
        </div>

        {selectedLeague === "all" ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <p className="text-slate-500 text-center">Please select a league to view award leaders</p>
          </div>
        ) : (
          <AwardLeadersComponent
            league={leagues.find(l => l.id === selectedLeague)}
            teams={teams.filter(t => t.league_id === selectedLeague)}
            games={games.filter(g => g.league_id === selectedLeague)}
            players={players.filter(p => teams.find(t => t.id === p.team_id)?.league_id === selectedLeague)}
            stats={allStats}
          />
        )}
      </div>
    </div>
  );
}
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Filter } from "lucide-react";

import TeamStandings from "../components/stats/TeamStandings";

export default function StandingsPage() {
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        if (user?.default_league_id) {
          setSelectedLeague(user.default_league_id);
        } else if (user?.user_type === 'league_admin' && user?.assigned_league_ids?.length === 1) {
          setSelectedLeague(user.assigned_league_ids[0]);
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

  const isAppAdmin = currentUser?.user_type === 'app_admin';
  const assignedLeagueIds = currentUser?.assigned_league_ids || [];
  const hasAssignedLeagues = assignedLeagueIds.length > 0;
  const visibleLeagues = isAppAdmin
    ? leagues
    : hasAssignedLeagues
      ? leagues.filter(league => assignedLeagueIds.includes(league.id))
      : leagues;

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
    initialData: [],
  });

  const { data: games } = useQuery({
    queryKey: ['games'],
    queryFn: () => base44.entities.Game.list(),
    initialData: [],
  });

  const baseTeams = (hasAssignedLeagues && !isAppAdmin) ? teams.filter(t => assignedLeagueIds.includes(t.league_id)) : teams;
  const baseGames = (hasAssignedLeagues && !isAppAdmin) ? games.filter(g => assignedLeagueIds.includes(g.league_id)) : games;

  const filteredTeams = selectedLeague === "all" 
    ? baseTeams 
    : baseTeams.filter(t => t.league_id === selectedLeague);

  const filteredGames = selectedLeague === "all"
    ? baseGames
    : baseGames.filter(g => g.league_id === selectedLeague);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 overflow-x-hidden">
      <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-4 md:py-12">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Trophy className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </div>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-slate-900">Team Standings</h1>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm pl-1">Team rankings and records</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-6 mb-3 sm:mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-yellow-600" />
            <h2 className="text-base font-semibold text-slate-900">Filter by League</h2>
          </div>
          <div className="w-full max-w-md">
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
          <div className="flex flex-col items-center justify-center py-20 px-4 bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
              <Trophy className="w-12 h-12 text-yellow-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Select a League</h3>
            <p className="text-slate-600 text-center max-w-md">
              Please select a league from the filter above to view team standings.
            </p>
          </div>
        ) : (
          <TeamStandings 
            teams={filteredTeams}
            games={filteredGames}
            leagues={leagues}
          />
        )}
      </div>
    </div>
  );
}
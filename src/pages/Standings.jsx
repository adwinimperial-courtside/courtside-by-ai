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

  const assignedLeagues = currentUser?.assigned_league_ids 
    ? leagues.filter(league => currentUser.assigned_league_ids.includes(league.id))
    : [];

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

  const filteredTeams = selectedLeague === "all" 
    ? teams 
    : teams.filter(t => t.league_id === selectedLeague);

  const filteredGames = selectedLeague === "all"
    ? games
    : games.filter(g => {
        const homeTeam = teams.find(t => t.id === g.home_team_id);
        const awayTeam = teams.find(t => t.id === g.away_team_id);
        return homeTeam?.league_id === selectedLeague || awayTeam?.league_id === selectedLeague;
      });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 overflow-x-hidden">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900">Team Standings</h1>
          </div>
          <p className="text-slate-600 text-sm pl-1">Team rankings and records</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-4 sm:mb-6">
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
                 {assignedLeagues.map(league => (
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
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BarChart3, Filter, BarChart4 } from "lucide-react";

import TeamStats from "../components/stats/TeamStats";
import PlayerStats from "../components/stats/PlayerStats";
import LeagueLeaders from "../components/stats/LeagueLeaders";
import GameStats from "../components/stats/GameStats";
import MobileTeamStats from "../components/stats/mobile/MobileTeamStats";
import MobilePlayerStats from "../components/stats/mobile/MobilePlayerStats";
import MobileLeagueLeaders from "../components/stats/mobile/MobileLeagueLeaders";
import MobileGameStats from "../components/stats/mobile/MobileGameStats";


export default function StatisticsPage() {
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [playerSearch, setPlayerSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [mobileTab, setMobileTab] = useState("teamstats");
  const [desktopTab, setDesktopTab] = useState("teamstats");

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        if (user?.default_league_id) {
          setSelectedLeague(user.default_league_id);
        } else if (user?.assigned_league_ids?.length === 1) {
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

  // Debounce player search with 300ms delay
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(playerSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [playerSearch]);

  const { data: leagues } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list('-created_date', 200),
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

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', selectedLeague],
    queryFn: async () => {
      if (!selectedLeague || selectedLeague === 'all') return [];
      return base44.entities.Team.filter({ league_id: selectedLeague }, null, 500);
    },
    enabled: !!selectedLeague && selectedLeague !== 'all',
    staleTime: 300000,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players', selectedLeague],
    queryFn: async () => {
      if (!selectedLeague || selectedLeague === 'all') return [];
      const leagueTeams = await base44.entities.Team.filter({ league_id: selectedLeague }, null, 500);
      const teamIds = leagueTeams.map(t => t.id);
      if (teamIds.length === 0) return [];
      return base44.entities.Player.filter({ team_id: { $in: teamIds } }, null, 1000);
    },
    enabled: !!selectedLeague && selectedLeague !== 'all',
    staleTime: 300000,
  });

  const { data: games = [] } = useQuery({
    queryKey: ['games', selectedLeague],
    queryFn: async () => {
      if (!selectedLeague || selectedLeague === 'all') return [];
      return base44.entities.Game.filter({ league_id: selectedLeague }, '-game_date', 1000);
    },
    enabled: !!selectedLeague && selectedLeague !== 'all',
    staleTime: 5000,
  });

  const { data: allStats = [] } = useQuery({
    queryKey: ['allPlayerStats', selectedLeague],
    queryFn: async () => {
      if (!selectedLeague || selectedLeague === 'all') return [];
      const leagueGames = await base44.entities.Game.filter({ league_id: selectedLeague }, null, 1000);
      const gameIds = leagueGames.map(g => g.id);
      if (gameIds.length === 0) return [];
      return base44.entities.PlayerStats.filter({ game_id: { $in: gameIds } }, null, 5000);
    },
    enabled: !!selectedLeague && selectedLeague !== 'all',
    staleTime: 5000,
  });

  // Already league-filtered from queries above
  const filteredTeams = teams;
  const filteredPlayers = selectedTeam === "all" 
    ? players 
    : players.filter(p => p.team_id === selectedTeam);

  const filteredGames = selectedTeam === "all" 
    ? games 
    : games.filter(g => g.home_team_id === selectedTeam || g.away_team_id === selectedTeam);

  const filteredStats = selectedTeam === "all"
    ? allStats
    : allStats.filter(s => s.team_id === selectedTeam);

  const availableTeams = teams;

  const searchedPlayers = debouncedSearch.trim()
    ? filteredPlayers.filter(p => 
        p.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : filteredPlayers;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Statistics & Analytics</h1>
          </div>
          <p className="text-slate-600 ml-15">Comprehensive league, team, and player statistics</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">League</label>
              <Select value={selectedLeague} onValueChange={(value) => {
                setSelectedLeague(value);
                setSelectedTeam("all");
                setPlayerSearch("");
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select league" />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">All Leagues</SelectItem>
                   {[...visibleLeagues].sort((a, b) => a.name.localeCompare(b.name)).map(league => (
                     <SelectItem key={league.id} value={league.id}>
                       {league.name} ({league.season})
                     </SelectItem>
                   ))}
                 </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Team</label>
              <Select value={selectedTeam} onValueChange={(value) => {
                setSelectedTeam(value);
                setPlayerSearch("");
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {[...availableTeams].sort((a, b) => a.name.localeCompare(b.name)).map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(mobileTab === "players" || desktopTab === "players") && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Search Player</label>
                <Input
                  type="text"
                  placeholder="Filter by player name..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>

        {selectedLeague === "all" ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mb-6">
              <BarChart3 className="w-12 h-12 text-purple-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Select a League</h3>
            <p className="text-slate-600 text-center max-w-md">
              Please select a league from the filter above to view statistics and analytics.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile tab selector - only shown on mobile */}
            <div className="block md:hidden mb-4">
              <Select value={mobileTab} onValueChange={setMobileTab}>
                <SelectTrigger className="w-full bg-white border-slate-200">
                  <div className="flex items-center gap-2">
                    <BarChart4 className="w-4 h-4 text-purple-600" />
                    <span>
                      View: {
                        mobileTab === "teamstats" ? "Team Stats" :
                        mobileTab === "players" ? "Player Stats" :
                        mobileTab === "leaders" ? "League Leaders" :
                        "Game Stats"
                      }
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teamstats">Team Stats</SelectItem>
                  <SelectItem value="players">Player Stats</SelectItem>
                  <SelectItem value="leaders">League Leaders</SelectItem>

                </SelectContent>
              </Select>
            </div>

            {/* Mobile content */}
            <div className="block md:hidden">
              {mobileTab === "teamstats" && (
                <MobileTeamStats teams={filteredTeams} games={filteredGames} stats={filteredStats} />
              )}
              {mobileTab === "players" && (
                <MobilePlayerStats
                  players={searchedPlayers}
                  teams={teams}
                  stats={filteredStats}
                  games={games}
                />
              )}
              {mobileTab === "leaders" && (
                <MobileLeagueLeaders players={filteredPlayers} teams={teams} stats={filteredStats} games={games} />
              )}

            </div>

            {/* Desktop tabs - hidden on mobile */}
            <div className="hidden md:block">
              <Tabs defaultValue="teamstats" value={desktopTab} onValueChange={setDesktopTab} className="space-y-6 w-full">
                <TabsList className="bg-white border border-slate-200 p-1 h-auto flex-wrap w-full">
                  <TabsTrigger value="teamstats" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white px-6 py-2.5">
                    Team Stats
                  </TabsTrigger>
                  <TabsTrigger value="players" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white px-6 py-2.5">
                    Player Stats
                  </TabsTrigger>
                  <TabsTrigger value="leaders" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white px-6 py-2.5">
                    League Leaders
                  </TabsTrigger>

                </TabsList>

                <TabsContent value="teamstats">
                  <TeamStats teams={filteredTeams} games={filteredGames} stats={filteredStats} leagues={leagues} />
                </TabsContent>
                <TabsContent value="players">
                  <PlayerStats
                    players={searchedPlayers}
                    teams={teams}
                    stats={filteredStats}
                    games={games}
                  />
                </TabsContent>
                <TabsContent value="leaders">
                  <LeagueLeaders players={filteredPlayers} teams={teams} stats={filteredStats} games={games} />
                </TabsContent>

              </Tabs>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
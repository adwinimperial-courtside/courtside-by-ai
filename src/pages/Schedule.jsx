import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import CreateGameDialog from "../components/schedule/CreateGameDialog";
import GameCard from "../components/schedule/GameCard";

export default function SchedulePage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const isLeagueAdmin = currentUser?.user_type === 'league_admin';
  const isAppAdmin = currentUser?.user_type === 'app_admin';
  const assignedLeagueIds = currentUser?.assigned_league_ids || [];
  const hasAssignedLeagues = assignedLeagueIds.length > 0;

  const { data: leagues = [] } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
    staleTime: 300000,
  });

  const visibleLeagues = isAppAdmin
    ? leagues
    : hasAssignedLeagues
      ? leagues.filter(league => assignedLeagueIds.includes(league.id))
      : leagues;

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', selectedLeague],
    queryFn: async () => {
      if (!selectedLeague || selectedLeague === 'all') return [];
      return base44.entities.Team.filter({ league_id: selectedLeague });
    },
    enabled: !!selectedLeague && selectedLeague !== 'all',
    staleTime: 300000,
  });

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['games', selectedLeague],
    queryFn: async () => {
      if (!selectedLeague || selectedLeague === 'all') return [];
      const filtered = await base44.entities.Game.filter({ league_id: selectedLeague }, '-game_date');
      return filtered || [];
    },
    enabled: !!selectedLeague && selectedLeague !== 'all',
    staleTime: 5000,
  });



  const createGameMutation = useMutation({
    mutationFn: (gameData) => base44.entities.Game.create(gameData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      setShowCreateDialog(false);
    },
  });

  const startGame = (game) => {
    const baseUrl = createPageUrl("LiveGame");
    navigate(`${baseUrl}?gameId=${game.id}`);
  };

  // Filter teams/games to only show data from assigned leagues for non-app-admins with assigned leagues
  const visibleTeams = (hasAssignedLeagues && !isAppAdmin)
    ? teams.filter(t => assignedLeagueIds.includes(t.league_id))
    : teams;

  const filteredGames = games.filter(game => {
    const leagueMatch = selectedLeague === "all" || game.league_id === selectedLeague;
    const teamMatch = selectedTeam === "all" || game.home_team_id === selectedTeam || game.away_team_id === selectedTeam;
    const assignedFilter = isAppAdmin || !hasAssignedLeagues || assignedLeagueIds.includes(game.league_id);
    return leagueMatch && teamMatch && assignedFilter;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 w-full">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Schedule</h1>
            </div>
            <p className="text-slate-600 ml-15">Manage game schedules and matchups</p>
          </div>
          {(isLeagueAdmin || isAppAdmin) && (
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg shadow-green-500/30 h-12 px-6"
              disabled={teams.length < 2}
            >
              <Plus className="w-5 h-5 mr-2" />
              Schedule Game
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex items-center gap-2 flex-1">
            <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <Select value={selectedLeague} onValueChange={setSelectedLeague}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Leagues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leagues</SelectItem>
                {visibleLeagues.map(league => (
                  <SelectItem key={league.id} value={league.id}>{league.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 flex-1">
            <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {visibleTeams.map(team => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedLeague === "all" ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <Calendar className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Select a League</h3>
            <p className="text-slate-600 text-center max-w-md">
              Please select a league from the filter above to view and manage games.
            </p>
          </div>
        ) : isLoading ? (
          <div className="w-full space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-20 px-4">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Calendar className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {teams.length < 2 ? "Need More Teams" : "No Games Scheduled"}
            </h3>
            <p className="text-slate-600 text-center mb-8 max-w-md">
              {teams.length < 2 
                ? "You need at least 2 teams to schedule a game"
                : "Start scheduling games for your league"}
            </p>
          </div>
        ) : (
          <div className="w-full space-y-4">
            {filteredGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                teams={teams}
                leagues={leagues}
                players={players}
                stats={allStats}
                onStartGame={() => startGame(game)}
                currentUser={currentUser}
              />
            ))}
          </div>
        )}

        <CreateGameDialog
           open={showCreateDialog}
           onOpenChange={setShowCreateDialog}
           onSubmit={(data) => createGameMutation.mutate(data)}
           isLoading={createGameMutation.isPending}
           leagues={visibleLeagues}
           teams={visibleTeams}
         />
      </div>
    </div>
  );
}
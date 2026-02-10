import React, { useState } from "react";
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
  const [selectedLeague, setSelectedLeague] = useState("all");
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
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

  const { data: games, isLoading } = useQuery({
    queryKey: ['games'],
    queryFn: () => base44.entities.Game.list('-game_date'),
    initialData: [],
    refetchOnMount: 'always',
  });

  const { data: players } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list(),
    initialData: [],
    refetchOnMount: 'always',
  });

  const { data: allStats } = useQuery({
    queryKey: ['allPlayerStats'],
    queryFn: () => base44.entities.PlayerStats.list(),
    initialData: [],
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

  const filteredGames = games.filter(game => {
    const leagueMatch = selectedLeague === "all" || game.league_id === selectedLeague;
    const teamMatch = selectedTeam === "all" || game.home_team_id === selectedTeam || game.away_team_id === selectedTeam;
    return leagueMatch && teamMatch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
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
          <Button 
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg shadow-green-500/30 h-12 px-6"
            disabled={teams.length < 2}
          >
            <Plus className="w-5 h-5 mr-2" />
            Schedule Game
          </Button>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <Select value={selectedLeague} onValueChange={setSelectedLeague}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Leagues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leagues</SelectItem>
                {assignedLeagues.map(league => (
                  <SelectItem key={league.id} value={league.id}>{league.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map(team => (
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
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
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
          <div className="space-y-4">
            {filteredGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                teams={teams}
                leagues={leagues}
                players={players}
                stats={allStats}
                onStartGame={() => startGame(game)}
              />
            ))}
          </div>
        )}

        <CreateGameDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSubmit={(data) => createGameMutation.mutate(data)}
          isLoading={createGameMutation.isPending}
          leagues={leagues}
          teams={teams}
        />
      </div>
    </div>
  );
}
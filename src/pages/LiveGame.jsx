import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import StartingLineup from "../components/live/StartingLineup";
import LiveStatTracker from "../components/live/LiveStatTracker";

export default function LiveGamePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('gameId');

  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [homeStarters, setHomeStarters] = useState([]);
  const [awayStarters, setAwayStarters] = useState([]);

  const { data: game, isLoading: gameLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const games = await base44.entities.Game.filter({ id: gameId });
      return games[0];
    },
    enabled: !!gameId,
  });

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

  const { data: existingStats } = useQuery({
    queryKey: ['playerStats', gameId],
    queryFn: () => base44.entities.PlayerStats.filter({ game_id: gameId }),
    initialData: [],
    enabled: !!gameId,
  });

  const updateGameMutation = useMutation({
    mutationFn: ({ gameId, data }) => base44.entities.Game.update(gameId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  useEffect(() => {
    if (game && existingStats.length > 0) {
      const homeStarterIds = existingStats
        .filter(s => s.team_id === game.home_team_id && s.is_starter)
        .map(s => s.player_id);
      const awayStarterIds = existingStats
        .filter(s => s.team_id === game.away_team_id && s.is_starter)
        .map(s => s.player_id);
      
      if (homeStarterIds.length > 0 || awayStarterIds.length > 0) {
        setHomeStarters(homeStarterIds);
        setAwayStarters(awayStarterIds);
        setIsSetupComplete(true);
      }
    }
  }, [game, existingStats]);

  if (!gameId || gameLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Game Not Found</h2>
          <Button onClick={() => navigate(createPageUrl("Schedule"))}>
            Back to Schedule
          </Button>
        </div>
      </div>
    );
  }

  const homeTeam = teams.find(t => t.id === game.home_team_id);
  const awayTeam = teams.find(t => t.id === game.away_team_id);
  const homePlayers = players.filter(p => p.team_id === game.home_team_id);
  const awayPlayers = players.filter(p => p.team_id === game.away_team_id);

  const handleStartGame = async () => {
    if (homeStarters.length !== 5 || awayStarters.length !== 5) {
      alert("Please select 5 starters for each team");
      return;
    }

    const statsToCreate = [
      ...homeStarters.map(playerId => ({
        game_id: gameId,
        player_id: playerId,
        team_id: game.home_team_id,
        is_starter: true,
      })),
      ...awayStarters.map(playerId => ({
        game_id: gameId,
        player_id: playerId,
        team_id: game.away_team_id,
        is_starter: true,
      }))
    ];

    await base44.entities.PlayerStats.bulkCreate(statsToCreate);
    await updateGameMutation.mutateAsync({
      gameId,
      data: { status: 'in_progress' }
    });
    
    queryClient.invalidateQueries({ queryKey: ['playerStats', gameId] });
    setIsSetupComplete(true);
  };

  if (!isSetupComplete) {
    return (
      <StartingLineup
        game={game}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homePlayers={homePlayers}
        awayPlayers={awayPlayers}
        homeStarters={homeStarters}
        awayStarters={awayStarters}
        onHomeStartersChange={setHomeStarters}
        onAwayStartersChange={setAwayStarters}
        onStartGame={handleStartGame}
        onBack={() => navigate(createPageUrl("Schedule"))}
      />
    );
  }

  return (
    <LiveStatTracker
      game={game}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      players={players}
      existingStats={existingStats}
      onBack={() => navigate(createPageUrl("Schedule"))}
    />
  );
}
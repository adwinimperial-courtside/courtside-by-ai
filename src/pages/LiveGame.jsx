import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
  const [currentUser, setCurrentUser] = useState(null);
  const [gameOverride, setGameOverride] = useState(null); // optimistic local clock state

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

  const { data: game = null, isLoading: gamesLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      if (!gameId) return null;
      const result = await base44.entities.Game.filter({ id: gameId });
      return result?.[0] || null;
    },
    enabled: !!gameId,
    staleTime: 2000,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', game?.home_team_id, game?.away_team_id],
    queryFn: async () => {
      if (!game?.home_team_id || !game?.away_team_id) return [];
      const [homeTeam, awayTeam] = await Promise.all([
        base44.entities.Team.filter({ id: game.home_team_id }),
        base44.entities.Team.filter({ id: game.away_team_id })
      ]);
      return [...(homeTeam || []), ...(awayTeam || [])];
    },
    enabled: !!game?.home_team_id && !!game?.away_team_id,
    staleTime: 300000,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players', game?.home_team_id, game?.away_team_id],
    queryFn: async () => {
      if (!game?.home_team_id || !game?.away_team_id) return [];
      const [homePlayers, awayPlayers] = await Promise.all([
        base44.entities.Player.filter({ team_id: game.home_team_id }),
        base44.entities.Player.filter({ team_id: game.away_team_id })
      ]);
      return [...(homePlayers || []), ...(awayPlayers || [])];
    },
    enabled: !!game?.home_team_id && !!game?.away_team_id,
    staleTime: 300000,
  });

  const { data: existingStats = [] } = useQuery({
    queryKey: ['playerStats', gameId],
    queryFn: async () => {
      if (!gameId) return [];
      return base44.entities.PlayerStats.filter({ game_id: gameId });
    },
    enabled: !!gameId,
    staleTime: 2000,
  });

  const updateGameMutation = useMutation({
    mutationFn: ({ gameId, data }) => base44.entities.Game.update(gameId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
    },
  });

  // Merge optimistic clock overrides (cleared when real-time sync arrives)
  const mergedGame = game && gameOverride ? { ...game, ...gameOverride } : game;

  // When server syncs new clock state, clear the override
  useEffect(() => {
    if (gameOverride && game) {
      const keysMatch = ['clock_running', 'clock_time_left', 'clock_started_at', 'clock_period'].every(
        k => game[k] === gameOverride[k] || gameOverride[k] === undefined
      );
      if (keysMatch) setGameOverride(null);
    }
  }, [game]);

  useEffect(() => {
    if (game && existingStats && existingStats.length > 0) {
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

  if (currentUser?.user_type === "viewer") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-slate-400 mb-6">Viewers cannot access the live stat tracker.</p>
          <Button onClick={() => navigate(createPageUrl("Schedule"))}>
            Back to Schedule
          </Button>
        </div>
      </div>
    );
  }

  if (!gameId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">No Game Selected</h2>
          <Button onClick={() => navigate(createPageUrl("Schedule"))}>
            Back to Schedule
          </Button>
        </div>
      </div>
    );
  }

  if (gamesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-white">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Game Not Found</h2>
          <p className="text-slate-400 mb-6">The game you're looking for doesn't exist.</p>
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

    try {
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
    } catch (error) {
      console.error("Error starting game:", error);
      alert("Error starting game. Please try again.");
    }
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
      onGameUpdate={(updates) => setGameOverride(prev => ({ ...prev, ...updates }))}
    />
  );
}
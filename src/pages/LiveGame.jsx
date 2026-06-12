import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import StartingLineup from "../components/live/StartingLineup";
import LiveStatTracker from "../components/live/LiveStatTracker";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";

export default function LiveGamePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('gameid') || urlParams.get('gameId');

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

  const { data: game = null, isLoading: gamesLoading, isError: gameError } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      if (!gameId) return null;
      return base44.entities.Game.get(gameId);
    },
    enabled: !!gameId,
    staleTime: 10000,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: attemptIndex => Math.min(2000 * 2 ** attemptIndex, 15000),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', game?.home_team_id, game?.away_team_id],
    queryFn: async () => {
      if (!game?.home_team_id || !game?.away_team_id) return [];
      const [homeTeam, awayTeam] = await Promise.all([
        base44.entities.Team.get(game.home_team_id),
        base44.entities.Team.get(game.away_team_id)
      ]);
      return [homeTeam, awayTeam].filter(Boolean);
    },
    enabled: !!game?.home_team_id && !!game?.away_team_id,
    staleTime: 300000,
    retry: 3,
    retryDelay: attemptIndex => Math.min(2000 * 2 ** attemptIndex, 15000),
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
    staleTime: 60000,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: attemptIndex => Math.min(2000 * 2 ** attemptIndex, 15000),
  });

  const { data: existingStats = [] } = useQuery({
    queryKey: ['playerStats', gameId],
    queryFn: async () => {
      if (!gameId) return [];
      return base44.entities.PlayerStats.filter({ game_id: gameId });
    },
    enabled: !!gameId,
    staleTime: 5000,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: attemptIndex => Math.min(2000 * 2 ** attemptIndex, 15000),
  });

  const { isViewer: liveIsViewer, isAppAdmin, isLeagueAdmin } = useEffectiveRole(currentUser, game?.league_id || null);

  const updateGameMutation = useMutation({
    mutationFn: ({ gameId, data }) => base44.entities.Game.update(gameId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
    },
  });

  // Merge optimistic clock overrides (cleared when real-time sync arrives)
  const mergedGame = useMemo(
    () => game && gameOverride ? { ...game, ...gameOverride } : game,
    [game, gameOverride]
  );

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
    if (mergedGame && existingStats && existingStats.length > 0) {
      const homeStarterIds = existingStats
        .filter(s => s.team_id === mergedGame.home_team_id && s.is_starter)
        .map(s => s.player_id);
      const awayStarterIds = existingStats
        .filter(s => s.team_id === mergedGame.away_team_id && s.is_starter)
        .map(s => s.player_id);
      
      if (homeStarterIds.length > 0 || awayStarterIds.length > 0) {
        setHomeStarters(homeStarterIds);
        setAwayStarters(awayStarterIds);
        setIsSetupComplete(true);
      }
    }
  }, [mergedGame, existingStats]);

  const isStartingGameRef = React.useRef(false);

  if (currentUser && !isAppAdmin && !isLeagueAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="text-slate-400 mb-6">Only league admins can access the live stat tracker.</p>
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

  // Show loading while fetching, or while retrying after rate limit errors
  if (gamesLoading || (!mergedGame && !gameError)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-white">Loading game...</p>
        </div>
      </div>
    );
  }

  // Only show "not found" after all retries have been exhausted
  if (!mergedGame) {
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

  const homeTeam = teams.find(t => t.id === mergedGame.home_team_id);
  const awayTeam = teams.find(t => t.id === mergedGame.away_team_id);
  const homePlayers = players.filter(p => p.team_id === mergedGame.home_team_id);
  const awayPlayers = players.filter(p => p.team_id === mergedGame.away_team_id);

  const handleStartGame = async () => {
    if (homeStarters.length !== 5 || awayStarters.length !== 5) {
      alert("Please select 5 starters for each team");
      return;
    }
    // START_GAME_GUARD_V1 — block double-taps and make retries safe.
    if (isStartingGameRef.current) return;
    isStartingGameRef.current = true;

    try {
      // If a previous attempt already created rows (e.g. the status update
      // failed and the user tapped Start again), reuse them instead of
      // creating duplicates. Only create rows for starters with no row yet.
      const existingRows = await base44.entities.PlayerStats.filter({ game_id: gameId });
      const existingIds = new Set(existingRows.map(s => s.player_id));
      const chosenIds = new Set([...homeStarters, ...awayStarters]);

      // Heal leftovers from a previous attempt: deactivate rows for players
      // no longer in the chosen five, re-activate chosen players whose row
      // exists but is not active/starter.
      for (const row of existingRows) {
        if (!chosenIds.has(row.player_id) && (row.is_active || row.is_starter)) {
          await base44.entities.PlayerStats.update(row.id, { is_active: false, is_starter: false });
        } else if (chosenIds.has(row.player_id) && (!row.is_active || !row.is_starter)) {
          await base44.entities.PlayerStats.update(row.id, { is_active: true, is_starter: true });
        }
      }

      const statsToCreate = [
        ...homeStarters.filter(playerId => !existingIds.has(playerId)).map(playerId => ({
          game_id: gameId,
          player_id: playerId,
          team_id: mergedGame.home_team_id,
          is_starter: true,
          is_active: true,
        })),
        ...awayStarters.filter(playerId => !existingIds.has(playerId)).map(playerId => ({
          game_id: gameId,
          player_id: playerId,
          team_id: mergedGame.away_team_id,
          is_starter: true,
          is_active: true,
        }))
      ];

      if (statsToCreate.length > 0) {
        await base44.entities.PlayerStats.bulkCreate(statsToCreate);
      }
      await updateGameMutation.mutateAsync({
        gameId,
        data: { status: 'in_progress' }
      });

      queryClient.invalidateQueries({ queryKey: ['playerStats', gameId] });
      setIsSetupComplete(true);
    } catch (error) {
      console.error("Error starting game:", error);
      alert("Error starting game. Please try again.");
    } finally {
      isStartingGameRef.current = false;
    }
  };

  if (!isSetupComplete) {
    return (
      <StartingLineup
        game={mergedGame}
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
      game={mergedGame}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      players={players}
      existingStats={existingStats}
      onBack={() => navigate(createPageUrl("Schedule"))}
      onGameUpdate={(updates) => setGameOverride(prev => ({ ...prev, ...updates }))}
    />
  );
}
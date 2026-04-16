import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

import StartingLineup from "../components/live/StartingLineup";
import LiveStatTracker from "../components/live/LiveStatTracker";

export default function LiveGamePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('gameid') || urlParams.get('gameId');

  const [homeStarters, setHomeStarters] = useState([]);
  const [awayStarters, setAwayStarters] = useState([]);

  const { data: game = null, isLoading: gamesLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!gameId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', game?.home_team_id, game?.away_team_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .in('id', [game.home_team_id, game.away_team_id]);
      if (error) throw error;
      return data;
    },
    enabled: !!game?.home_team_id && !!game?.away_team_id,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players', game?.home_team_id, game?.away_team_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .in('team_id', [game.home_team_id, game.away_team_id]);
      if (error) throw error;
      return data;
    },
    enabled: !!game?.home_team_id && !!game?.away_team_id,
  });

  const { data: existingStats = [] } = useQuery({
    queryKey: ['player_stats', gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_stats')
        .select('*')
        .eq('game_id', gameId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!gameId,
  });

  // Setup is complete when at least one player_stats row has is_starter = true
  const isSetupComplete = existingStats.some(s => s.is_starter === true);

  if (!gameId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">No Game Selected</h2>
          <Button onClick={() => navigate('/Schedule')}>
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
          <Button onClick={() => navigate('/Schedule')}>
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
        onStartGame={() => {
          queryClient.invalidateQueries({ queryKey: ['player_stats', gameId] });
        }}
        onBack={() => navigate('/Schedule')}
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
      onBack={() => navigate('/Schedule')}
      onGameUpdate={() => {
        queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      }}
    />
  );
}

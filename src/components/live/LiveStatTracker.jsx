import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import ScoreHeader from "./ScoreHeader";
import StatButtons from "./StatButtons";
import PlayerSelector from "./PlayerSelector";

const STAT_TYPES = [
  { key: 'points_2', label: '2PT', points: 2, color: 'bg-blue-500' },
  { key: 'points_3', label: '3PT', points: 3, color: 'bg-purple-500' },
  { key: 'offensive_rebounds', label: 'OREB', points: 0, color: 'bg-green-500' },
  { key: 'defensive_rebounds', label: 'DREB', points: 0, color: 'bg-green-600' },
  { key: 'assists', label: 'AST', points: 0, color: 'bg-yellow-500' },
  { key: 'steals', label: 'STL', points: 0, color: 'bg-orange-500' },
  { key: 'blocks', label: 'BLK', points: 0, color: 'bg-red-500' },
  { key: 'turnovers', label: 'TO', points: 0, color: 'bg-gray-500' },
  { key: 'fouls', label: 'FOUL', points: 0, color: 'bg-slate-500' },
  { key: 'technical_fouls', label: 'TECH', points: 0, color: 'bg-rose-600' },
  { key: 'unsportsmanlike_fouls', label: 'UNSP', points: 0, color: 'bg-red-700' },
];

export default function LiveStatTracker({ game, homeTeam, awayTeam, players, existingStats, onBack }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState('home');
  const queryClient = useQueryClient();

  const updateStatMutation = useMutation({
    mutationFn: async ({ statId, updates }) => {
      return await base44.entities.PlayerStats.update(statId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerStats', game.id] });
    },
  });

  const updateGameMutation = useMutation({
    mutationFn: async ({ gameId, data }) => {
      return await base44.entities.Game.update(gameId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['game', game.id] });
    },
  });

  const updateTeamRecordMutation = useMutation({
    mutationFn: async ({ teamId, isWin }) => {
      const teams = await base44.entities.Team.filter({ id: teamId });
      const team = teams[0];
      return await base44.entities.Team.update(teamId, {
        wins: isWin ? (team.wins || 0) + 1 : team.wins || 0,
        losses: !isWin ? (team.losses || 0) + 1 : team.losses || 0
      });
    },
  });

  const handleStatClick = async (statType) => {
    if (!selectedPlayer) return;

    const playerStat = existingStats.find(s => s.player_id === selectedPlayer.id);
    if (!playerStat) return;

    const currentValue = playerStat[statType.key] || 0;
    const updates = { [statType.key]: currentValue + 1 };

    await updateStatMutation.mutateAsync({ statId: playerStat.id, updates });

    if (statType.points > 0) {
      const isHomeTeam = selectedTeam === 'home';
      const newScore = isHomeTeam 
        ? (game.home_score || 0) + statType.points
        : (game.away_score || 0) + statType.points;

      await updateGameMutation.mutateAsync({
        gameId: game.id,
        data: isHomeTeam 
          ? { home_score: newScore }
          : { away_score: newScore }
      });
    }
  };

  const handleEndGame = async () => {
    if (!confirm("Are you sure you want to end this game? This cannot be undone.")) {
      return;
    }

    const homeScore = game.home_score || 0;
    const awayScore = game.away_score || 0;
    const homeWins = homeScore > awayScore;

    await updateGameMutation.mutateAsync({
      gameId: game.id,
      data: { status: 'completed' }
    });

    await updateTeamRecordMutation.mutateAsync({
      teamId: game.home_team_id,
      isWin: homeWins
    });

    await updateTeamRecordMutation.mutateAsync({
      teamId: game.away_team_id,
      isWin: !homeWins
    });

    onBack();
  };

  const currentTeamId = selectedTeam === 'home' ? game.home_team_id : game.away_team_id;
  const teamPlayers = players.filter(p => p.team_id === currentTeamId);
  const teamColor = selectedTeam === 'home' ? homeTeam?.color : awayTeam?.color;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Exit
          </Button>
          <Button
            onClick={handleEndGame}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            <Trophy className="w-4 h-4 mr-2" />
            End Game
          </Button>
        </div>

        <ScoreHeader
          game={game}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
        />

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2">
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
              <div className="flex gap-2 mb-6">
                <Button
                  onClick={() => {
                    setSelectedTeam('home');
                    setSelectedPlayer(null);
                  }}
                  variant={selectedTeam === 'home' ? 'default' : 'outline'}
                  className={selectedTeam === 'home' 
                    ? 'flex-1 h-14 text-lg' 
                    : 'flex-1 h-14 text-lg bg-white/5 border-white/10 text-white hover:bg-white/10'}
                  style={selectedTeam === 'home' ? { backgroundColor: homeTeam?.color } : {}}
                >
                  {homeTeam?.name}
                </Button>
                <Button
                  onClick={() => {
                    setSelectedTeam('away');
                    setSelectedPlayer(null);
                  }}
                  variant={selectedTeam === 'away' ? 'default' : 'outline'}
                  className={selectedTeam === 'away' 
                    ? 'flex-1 h-14 text-lg' 
                    : 'flex-1 h-14 text-lg bg-white/5 border-white/10 text-white hover:bg-white/10'}
                  style={selectedTeam === 'away' ? { backgroundColor: awayTeam?.color } : {}}
                >
                  {awayTeam?.name}
                </Button>
              </div>

              <PlayerSelector
                players={teamPlayers}
                existingStats={existingStats}
                selectedPlayer={selectedPlayer}
                onSelectPlayer={setSelectedPlayer}
                teamColor={teamColor}
              />
            </div>
          </div>

          <div>
            <StatButtons
              statTypes={STAT_TYPES}
              selectedPlayer={selectedPlayer}
              onStatClick={handleStatClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
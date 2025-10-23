import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy } from "lucide-react";
import { motion } from "framer-motion";

import ScoreHeader from "./ScoreHeader";
import StatButtons from "./StatButtons";

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
      const isHomeTeam = selectedPlayer.team_id === game.home_team_id;
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

  const homePlayers = players.filter(p => p.team_id === game.home_team_id);
  const awayPlayers = players.filter(p => p.team_id === game.away_team_id);

  const PlayerButton = ({ player, teamColor }) => {
    const playerStats = existingStats.find(s => s.player_id === player.id);
    const totalPoints = ((playerStats?.points_2 || 0) * 2) + ((playerStats?.points_3 || 0) * 3);
    const isSelected = selectedPlayer?.id === player.id;

    return (
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setSelectedPlayer(player)}
        className={`p-4 rounded-xl transition-all ${
          isSelected
            ? 'ring-4 ring-offset-2 ring-offset-slate-900'
            : 'hover:bg-white/10'
        } bg-white/5 border-2 ${isSelected ? 'border-white' : 'border-white/10'}`}
        style={isSelected ? { ringColor: teamColor, backgroundColor: `${teamColor}30` } : {}}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
            style={{ backgroundColor: teamColor || '#f97316' }}
          >
            {player.jersey_number}
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{player.name}</p>
            <p className="text-sm text-slate-400">{player.position}</p>
          </div>
          {playerStats && (
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{totalPoints}</p>
              <p className="text-xs text-slate-400">PTS</p>
            </div>
          )}
        </div>
        {playerStats && (
          <div className="flex justify-between text-xs text-slate-300 pt-3 mt-3 border-t border-white/10">
            <span>{(playerStats.offensive_rebounds || 0) + (playerStats.defensive_rebounds || 0)} REB</span>
            <span>{playerStats.assists || 0} AST</span>
            <span>{playerStats.steals || 0} STL</span>
            <span>{playerStats.blocks || 0} BLK</span>
          </div>
        )}
      </motion.button>
    );
  };

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

        <div className="mt-8 space-y-6">
          {/* Home Team */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
                style={{ backgroundColor: homeTeam?.color || '#f97316' }}
              >
                {homeTeam?.name?.[0]}
              </div>
              <h2 className="text-2xl font-bold text-white">{homeTeam?.name}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {homePlayers.map((player) => (
                <PlayerButton key={player.id} player={player} teamColor={homeTeam?.color} />
              ))}
            </div>
          </div>

          {/* Stat Buttons */}
          <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 backdrop-blur border-2 border-orange-500/30 rounded-2xl p-6">
            <div className="text-center mb-6">
              {selectedPlayer ? (
                <div className="flex items-center justify-center gap-3">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg"
                    style={{ backgroundColor: selectedPlayer.team_id === game.home_team_id ? homeTeam?.color : awayTeam?.color }}
                  >
                    {selectedPlayer.jersey_number}
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-bold text-white">{selectedPlayer.name}</p>
                    <p className="text-slate-400">Recording stats for this player</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-2xl font-bold text-white mb-2">Select a Player</p>
                  <p className="text-slate-400">Click on any player above or below to start tracking stats</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {STAT_TYPES.map((stat) => (
                <motion.div key={stat.key} whileTap={{ scale: selectedPlayer ? 0.95 : 1 }}>
                  <Button
                    onClick={() => handleStatClick(stat)}
                    disabled={!selectedPlayer}
                    className={`w-full h-24 text-white font-bold text-lg ${stat.color} hover:opacity-90 disabled:opacity-30`}
                  >
                    {stat.label}
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Away Team */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
                style={{ backgroundColor: awayTeam?.color || '#f97316' }}
              >
                {awayTeam?.name?.[0]}
              </div>
              <h2 className="text-2xl font-bold text-white">{awayTeam?.name}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {awayPlayers.map((player) => (
                <PlayerButton key={player.id} player={player} teamColor={awayTeam?.color} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
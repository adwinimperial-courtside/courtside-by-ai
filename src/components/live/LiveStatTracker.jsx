import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Trophy, RefreshCw, X } from "lucide-react";
import { motion } from "framer-motion";

import ScoreHeader from "./ScoreHeader";

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
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [playerToReplace, setPlayerToReplace] = useState(null);
  const queryClient = useQueryClient();

  const activePlayers = existingStats.filter(s => s.is_starter || s.minutes_played > 0);
  const activePlayerIds = activePlayers.map(s => s.player_id);

  const updateStatMutation = useMutation({
    mutationFn: async ({ statId, updates }) => {
      return await base44.entities.PlayerStats.update(statId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerStats', game.id] });
    },
  });

  const createStatMutation = useMutation({
    mutationFn: async (statData) => {
      return await base44.entities.PlayerStats.create(statData);
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

  const handleSubstitution = async (newPlayerId) => {
    if (!playerToReplace) return;

    const oldPlayerStat = existingStats.find(s => s.player_id === playerToReplace.id);
    if (oldPlayerStat) {
      await updateStatMutation.mutateAsync({
        statId: oldPlayerStat.id,
        updates: { is_starter: false }
      });
    }

    const existingNewPlayerStat = existingStats.find(s => s.player_id === newPlayerId);
    if (existingNewPlayerStat) {
      await updateStatMutation.mutateAsync({
        statId: existingNewPlayerStat.id,
        updates: { is_starter: true }
      });
    } else {
      await createStatMutation.mutateAsync({
        game_id: game.id,
        player_id: newPlayerId,
        team_id: playerToReplace.team_id,
        is_starter: true,
      });
    }

    setShowSubDialog(false);
    setPlayerToReplace(null);
    if (selectedPlayer?.id === playerToReplace.id) {
      setSelectedPlayer(null);
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

  const homeActivePlayers = players.filter(p => 
    p.team_id === game.home_team_id && activePlayerIds.includes(p.id)
  );
  const awayActivePlayers = players.filter(p => 
    p.team_id === game.away_team_id && activePlayerIds.includes(p.id)
  );

  const homeBenchPlayers = players.filter(p => 
    p.team_id === game.home_team_id && !activePlayerIds.includes(p.id)
  );
  const awayBenchPlayers = players.filter(p => 
    p.team_id === game.away_team_id && !activePlayerIds.includes(p.id)
  );

  const PlayerButton = ({ player, teamColor, onSubClick }) => {
    const playerStats = existingStats.find(s => s.player_id === player.id);
    const totalPoints = ((playerStats?.points_2 || 0) * 2) + ((playerStats?.points_3 || 0) * 3);
    const isSelected = selectedPlayer?.id === player.id;

    return (
      <div className="relative">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setSelectedPlayer(player)}
          className={`w-full p-4 rounded-xl transition-all ${
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
        <Button
          size="sm"
          variant="destructive"
          className="absolute -top-2 -right-2 w-8 h-8 rounded-full p-0 shadow-lg"
          onClick={(e) => {
            e.stopPropagation();
            onSubClick(player);
          }}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  const BenchPlayerButton = ({ player, teamColor }) => {
    return (
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => handleSubstitution(player.id)}
        className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
            style={{ backgroundColor: teamColor || '#f97316' }}
          >
            {player.jersey_number}
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{player.name}</p>
            <p className="text-sm text-slate-400">{player.position}</p>
          </div>
        </div>
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
          {/* Home Team Active Players */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
                style={{ backgroundColor: homeTeam?.color || '#f97316' }}
              >
                {homeTeam?.name?.[0]}
              </div>
              <h2 className="text-2xl font-bold text-white">{homeTeam?.name}</h2>
              <span className="ml-auto text-slate-400 text-sm">Active: {homeActivePlayers.length}/5</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {homeActivePlayers.map((player) => (
                <PlayerButton 
                  key={player.id} 
                  player={player} 
                  teamColor={homeTeam?.color}
                  onSubClick={(p) => {
                    setPlayerToReplace(p);
                    setShowSubDialog(true);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Substitution and Stat Buttons */}
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
                  <p className="text-slate-400">Click on any active player to start tracking stats</p>
                </div>
              )}
            </div>

            {/* Stat Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
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

            {/* Substitution Button */}
            <Button
              onClick={() => setShowSubDialog(true)}
              className="w-full h-16 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-lg shadow-lg"
            >
              <RefreshCw className="w-6 h-6 mr-3" />
              Make Substitution
            </Button>
          </div>

          {/* Away Team Active Players */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
                style={{ backgroundColor: awayTeam?.color || '#f97316' }}
              >
                {awayTeam?.name?.[0]}
              </div>
              <h2 className="text-2xl font-bold text-white">{awayTeam?.name}</h2>
              <span className="ml-auto text-slate-400 text-sm">Active: {awayActivePlayers.length}/5</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {awayActivePlayers.map((player) => (
                <PlayerButton 
                  key={player.id} 
                  player={player} 
                  teamColor={awayTeam?.color}
                  onSubClick={(p) => {
                    setPlayerToReplace(p);
                    setShowSubDialog(true);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Substitution Dialog */}
      <Dialog open={showSubDialog} onOpenChange={setShowSubDialog}>
        <DialogContent className="bg-slate-900 text-white border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {playerToReplace ? `Substitute ${playerToReplace.name}` : 'Select Player to Substitute'}
            </DialogTitle>
          </DialogHeader>
          
          {!playerToReplace ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                    style={{ backgroundColor: homeTeam?.color }}
                  >
                    {homeTeam?.name?.[0]}
                  </div>
                  {homeTeam?.name}
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {homeActivePlayers.map(player => (
                    <Button
                      key={player.id}
                      variant="outline"
                      className="justify-start h-auto p-3 border-slate-700 hover:bg-slate-800"
                      onClick={() => setPlayerToReplace(player)}
                    >
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3"
                        style={{ backgroundColor: homeTeam?.color }}
                      >
                        {player.jersey_number}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">{player.name}</p>
                        <p className="text-sm text-slate-400">{player.position}</p>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                    style={{ backgroundColor: awayTeam?.color }}
                  >
                    {awayTeam?.name?.[0]}
                  </div>
                  {awayTeam?.name}
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {awayActivePlayers.map(player => (
                    <Button
                      key={player.id}
                      variant="outline"
                      className="justify-start h-auto p-3 border-slate-700 hover:bg-slate-800"
                      onClick={() => setPlayerToReplace(player)}
                    >
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3"
                        style={{ backgroundColor: awayTeam?.color }}
                      >
                        {player.jersey_number}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">{player.name}</p>
                        <p className="text-sm text-slate-400">{player.position}</p>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-lg p-4 flex items-center gap-3">
                <div 
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: playerToReplace.team_id === game.home_team_id ? homeTeam?.color : awayTeam?.color }}
                >
                  {playerToReplace.jersey_number}
                </div>
                <div>
                  <p className="font-semibold text-lg">{playerToReplace.name}</p>
                  <p className="text-slate-400">{playerToReplace.position} • Coming Out</p>
                </div>
              </div>

              <p className="text-center text-slate-400 font-semibold">SELECT REPLACEMENT</p>

              <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
                {(playerToReplace.team_id === game.home_team_id ? homeBenchPlayers : awayBenchPlayers).map(player => (
                  <BenchPlayerButton
                    key={player.id}
                    player={player}
                    teamColor={playerToReplace.team_id === game.home_team_id ? homeTeam?.color : awayTeam?.color}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setPlayerToReplace(null)}
              >
                Back
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Trophy, RefreshCw, X, Undo2, Activity, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

import ScoreHeader from "./ScoreHeader";
import { findPlayerOfGame } from "../utils/pogCalculator";

const STAT_TYPES = [
  { key: 'points_2', label: '2PT', points: 2, color: 'bg-blue-600 hover:bg-blue-700' },
  { key: 'points_3', label: '3PT', points: 3, color: 'bg-purple-600 hover:bg-purple-700' },
  { key: 'free_throws', label: 'FT', points: 1, color: 'bg-indigo-600 hover:bg-indigo-700' },
  { key: 'offensive_rebounds', label: 'OREB', points: 0, color: 'bg-emerald-500 hover:bg-emerald-600' },
  { key: 'defensive_rebounds', label: 'DREB', points: 0, color: 'bg-green-600 hover:bg-green-700' },
  { key: 'assists', label: 'AST', points: 0, color: 'bg-amber-500 hover:bg-amber-600' },
  { key: 'steals', label: 'STL', points: 0, color: 'bg-orange-600 hover:bg-orange-700' },
  { key: 'blocks', label: 'BLK', points: 0, color: 'bg-red-600 hover:bg-red-700' },
  { key: 'turnovers', label: 'TO', points: 0, color: 'bg-slate-700 hover:bg-slate-800' },
  { key: 'fouls', label: 'FOUL', points: 0, color: 'bg-slate-600 hover:bg-slate-700' },
  { key: 'technical_fouls', label: 'TECH', points: 0, color: 'bg-pink-600 hover:bg-pink-700' },
  { key: 'unsportsmanlike_fouls', label: 'UNSP', points: 0, color: 'bg-rose-700 hover:bg-rose-800' },
];

export default function LiveStatTracker({ game, homeTeam, awayTeam, players, existingStats, onBack }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [playersToReplace, setPlayersToReplace] = useState([]);
  const [replacementPlayers, setReplacementPlayers] = useState([]);
  const [subStep, setSubStep] = useState('select_out'); // 'select_out' or 'select_in'
  const [ejectedPlayer, setEjectedPlayer] = useState(null); // player ejected due to 2 techs
  const queryClient = useQueryClient();

  const { data: gameLogs = [] } = useQuery({
    queryKey: ['gameLogs', game.id],
    queryFn: () => base44.entities.GameLog.filter({ game_id: game.id }, '-created_date'),
  });

  const activePlayers = existingStats.filter(s => s.is_starter);
  const activePlayerIds = activePlayers.map(s => s.player_id);

  const gameLog = gameLogs.map(log => {
    const player = players.find(p => p.id === log.player_id);
    const teamColor = log.team_id === game.home_team_id ? homeTeam?.color : awayTeam?.color;
    return {
      id: log.id,
      timestamp: new Date(log.created_date),
      player: player,
      statType: {
        key: log.stat_type,
        label: log.stat_label,
        points: log.stat_points,
        color: log.stat_color
      },
      statId: log.player_stat_id,
      oldValue: log.old_value,
      newValue: log.new_value,
      oldScores: {
        home: log.old_home_score,
        away: log.old_away_score
      },
      teamColor: teamColor
    };
  });

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

  const createLogMutation = useMutation({
    mutationFn: async (logData) => {
      return await base44.entities.GameLog.create(logData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameLogs', game.id] });
    },
  });

  const deleteLogMutation = useMutation({
    mutationFn: async (logId) => {
      return await base44.entities.GameLog.delete(logId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameLogs', game.id] });
    },
  });

  const handleStatClick = async (statType) => {
    if (!selectedPlayer) return;

    const playerStat = existingStats.find(s => s.player_id === selectedPlayer.id);
    if (!playerStat) return;

    const currentValue = playerStat[statType.key] || 0;
    const updates = { [statType.key]: currentValue + 1 };
    
    const oldScores = { home: game.home_score || 0, away: game.away_score || 0 };

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

    // Add to game log database
    await createLogMutation.mutateAsync({
      game_id: game.id,
      player_id: selectedPlayer.id,
      team_id: selectedPlayer.team_id,
      stat_type: statType.key,
      stat_label: statType.label,
      stat_points: statType.points,
      stat_color: statType.color,
      player_stat_id: playerStat.id,
      old_value: currentValue,
      new_value: currentValue + 1,
      old_home_score: oldScores.home,
      old_away_score: oldScores.away
    });

    // Check for 2 technical fouls ejection
    if (statType.key === 'technical_fouls' && currentValue + 1 >= 2) {
      setEjectedPlayer(selectedPlayer);
      setSelectedPlayer(null);
    }
  };

  const handleConfirmSubstitution = async () => {
    if (playersToReplace.length !== replacementPlayers.length) return;

    for (let i = 0; i < playersToReplace.length; i++) {
      const playerOut = playersToReplace[i];
      const playerInId = replacementPlayers[i];

      const oldPlayerStat = existingStats.find(s => s.player_id === playerOut.id);
      if (oldPlayerStat) {
        await updateStatMutation.mutateAsync({
          statId: oldPlayerStat.id,
          updates: { is_starter: false }
        });
      }

      const existingNewPlayerStat = existingStats.find(s => s.player_id === playerInId);
      if (existingNewPlayerStat) {
        await updateStatMutation.mutateAsync({
          statId: existingNewPlayerStat.id,
          updates: { is_starter: true }
        });
      } else {
        await createStatMutation.mutateAsync({
          game_id: game.id,
          player_id: playerInId,
          team_id: playerOut.team_id,
          is_starter: true,
        });
      }

      if (selectedPlayer?.id === playerOut.id) {
        setSelectedPlayer(null);
      }
    }

    setShowSubDialog(false);
    setPlayersToReplace([]);
    setReplacementPlayers([]);
    setSubStep('select_out');
  };

  const togglePlayerToReplace = (player) => {
    setPlayersToReplace(prev => 
      prev.some(p => p.id === player.id)
        ? prev.filter(p => p.id !== player.id)
        : [...prev, player]
    );
  };

  const toggleReplacementPlayer = (playerId) => {
    setReplacementPlayers(prev => 
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleUndo = async (logEntry) => {
    // Revert the stat
    const updates = { [logEntry.statType.key]: logEntry.oldValue };
    await updateStatMutation.mutateAsync({ statId: logEntry.statId, updates });

    // Revert score if it was a scoring action
    if (logEntry.statType.points > 0) {
      await updateGameMutation.mutateAsync({
        gameId: game.id,
        data: { 
          home_score: logEntry.oldScores.home,
          away_score: logEntry.oldScores.away
        }
      });
    }

    // Remove from log database
    await deleteLogMutation.mutateAsync(logEntry.id);
  };

  const handleEndGame = async () => {
    if (!confirm("Are you sure you want to end this game? This cannot be undone.")) {
      return;
    }

    const homeScore = game.home_score || 0;
    const awayScore = game.away_score || 0;
    const homeWins = homeScore > awayScore;

    // Calculate Player of the Game automatically from winning team
    const playerOfGameId = findPlayerOfGame(existingStats, game);

    await updateGameMutation.mutateAsync({
      gameId: game.id,
      data: { 
        status: 'completed',
        player_of_game: playerOfGameId
      }
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
  ).slice(0, 5);
  const awayActivePlayers = players.filter(p => 
    p.team_id === game.away_team_id && activePlayerIds.includes(p.id)
  ).slice(0, 5);

  const isEligibleReplacement = (playerId) => {
    const stats = existingStats.find(s => s.player_id === playerId);
    if (!stats) return true; // no stats yet = eligible
    return (stats.technical_fouls || 0) < 2 && (stats.fouls || 0) < 5;
  };

  const homeBenchPlayers = players.filter(p => 
    p.team_id === game.home_team_id && !activePlayerIds.includes(p.id)
  );
  const awayBenchPlayers = players.filter(p => 
    p.team_id === game.away_team_id && !activePlayerIds.includes(p.id)
  );

  const PlayerButton = ({ player, teamColor, onSubClick }) => {
    const playerStats = existingStats.find(s => s.player_id === player.id);
    const totalPoints = ((playerStats?.points_2 || 0) * 2) + ((playerStats?.points_3 || 0) * 3) + (playerStats?.free_throws || 0);
    const isSelected = selectedPlayer?.id === player.id;

    return (
      <div className="relative">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setSelectedPlayer(player)}
          className={`w-full p-1.5 rounded-xl transition-all ${
            isSelected ? 'ring-2 ring-offset-1 ring-offset-indigo-100' : 'hover:bg-slate-100'
          } bg-white/70 border-2 ${isSelected ? 'border-indigo-400' : 'border-slate-200'}`}
          style={isSelected ? { backgroundColor: `${teamColor}15` } : {}}
        >
          <div className="flex flex-col items-center gap-1">
            <div 
              className="w-8 h-8 2xl:w-12 2xl:h-12 rounded-full flex items-center justify-center text-white font-bold text-xs 2xl:text-base shadow-md"
              style={{ backgroundColor: teamColor || '#f97316' }}
            >
              {player.jersey_number}
            </div>
            <div className="text-center w-full">
              <p className="font-semibold text-slate-900 text-[10px] 2xl:text-xs truncate leading-tight">{player.name}</p>
            </div>
            {playerStats && (
              <div className="text-center pt-1 border-t border-slate-200 w-full">
                <p className="text-sm font-bold text-slate-900">{totalPoints} <span className="text-[9px] font-normal text-slate-500">PTS</span></p>
                <div className="grid grid-cols-2 gap-x-1 mt-0.5">
                  <span className="text-[9px] text-slate-500">{(playerStats.offensive_rebounds||0)+(playerStats.defensive_rebounds||0)}R</span>
                  <span className="text-[9px] text-slate-500">{playerStats.assists||0}A</span>
                  <span className="text-[9px] text-slate-500">{playerStats.fouls||0}F</span>
                  <span className="text-[9px] text-slate-500">{playerStats.technical_fouls||0}T</span>
                </div>
              </div>
            )}
          </div>
        </motion.button>
        <Button
          size="sm"
          variant="destructive"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full p-0 shadow-lg"
          onClick={(e) => {
            e.stopPropagation();
            onSubClick(player);
          }}
        >
          <X className="w-2.5 h-2.5" />
        </Button>
      </div>
    );
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-slate-600 hover:bg-slate-200/50 h-10 sm:h-12 px-3 sm:px-6 text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            Exit
          </Button>
          <Button
            onClick={handleEndGame}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 h-10 sm:h-12 px-3 sm:px-6 text-sm sm:text-base text-white"
          >
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
            End Game
          </Button>
        </div>

        <ScoreHeader
          game={game}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
        />

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-3">
          {/* Main Content */}
          <div className="space-y-3 sm:space-y-4">
            {/* Home Team Active Players */}
            <div className="bg-white/60 backdrop-blur border border-slate-200 rounded-2xl p-3 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div 
                  className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg"
                  style={{ backgroundColor: homeTeam?.color || '#f97316' }}
                >
                  {homeTeam?.name?.[0]}
                </div>
                <h2 className="text-base sm:text-xl font-bold text-slate-900 truncate">{homeTeam?.name}</h2>
                <span className="ml-auto text-slate-500 text-xs sm:text-sm whitespace-nowrap">Active: {homeActivePlayers.length}/5</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
                {homeActivePlayers.map((player) => (
                  <PlayerButton 
                    key={player.id} 
                    player={player} 
                    teamColor={homeTeam?.color}
                    onSubClick={(p) => {
                      setPlayersToReplace([p]);
                      setSubStep('select_in');
                      setShowSubDialog(true);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Stat Control Center */}
            <div className="bg-gradient-to-r from-indigo-100/50 to-purple-100/50 backdrop-blur border-2 border-indigo-300/50 rounded-2xl p-3">
              <div className="flex items-center justify-center gap-3 mb-3">
                {selectedPlayer ? (
                  <>
                    <div 
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0"
                      style={{ backgroundColor: selectedPlayer.team_id === game.home_team_id ? homeTeam?.color : awayTeam?.color }}
                    >
                      {selectedPlayer.jersey_number}
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-slate-900 truncate leading-tight">{selectedPlayer.name}</p>
                      <p className="text-slate-500 text-xs">Recording stats</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-base font-bold text-slate-900">Select a Player</p>
                    <p className="text-slate-500 text-xs">Tap any active player to start tracking</p>
                  </div>
                )}
              </div>

              {/* Stat Buttons */}
              <div className="grid grid-cols-6 gap-1.5 mb-2">
                {STAT_TYPES.map((stat) => (
                  <motion.div key={stat.key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                    <Button
                      onClick={() => handleStatClick(stat)}
                      disabled={!selectedPlayer}
                      className={`w-full h-10 text-white font-bold text-xs ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md transition-all duration-150`}
                    >
                      {stat.label}
                    </Button>
                  </motion.div>
                ))}
              </div>

              {/* Action Buttons */}
              <Button
                onClick={() => {
                  setPlayersToReplace([]);
                  setReplacementPlayers([]);
                  setSubStep('select_out');
                  setShowSubDialog(true);
                }}
                className="w-full h-10 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-sm shadow-lg"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Make Substitution
              </Button>
            </div>

            {/* Away Team Active Players */}
            <div className="bg-white/60 backdrop-blur border border-slate-200 rounded-2xl p-3 sm:p-5">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div 
                  className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg"
                  style={{ backgroundColor: awayTeam?.color || '#f97316' }}
                >
                  {awayTeam?.name?.[0]}
                </div>
                <h2 className="text-base sm:text-xl font-bold text-slate-900 truncate">{awayTeam?.name}</h2>
                <span className="ml-auto text-slate-500 text-xs sm:text-sm whitespace-nowrap">Active: {awayActivePlayers.length}/5</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
                {awayActivePlayers.map((player) => (
                  <PlayerButton 
                    key={player.id} 
                    player={player} 
                    teamColor={awayTeam?.color}
                    onSubClick={(p) => {
                      setPlayersToReplace([p]);
                      setSubStep('select_in');
                      setShowSubDialog(true);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Activity Log Sidebar */}
          <div className="bg-white/60 backdrop-blur border border-slate-200 rounded-2xl p-3 flex flex-col" style={{ maxHeight: 'calc(100vh - 180px)', minHeight: '200px', overflowY: 'auto' }}>
            <div className="flex items-center gap-2 mb-3 sm:mb-4 pb-3 border-b border-slate-200">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
              <h3 className="text-base sm:text-lg font-bold text-slate-900">Game Activity</h3>
              <span className="ml-auto text-xs sm:text-sm text-slate-500">{gameLog.length} actions</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {gameLog.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <Activity className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No actions yet</p>
                  <p className="text-slate-400 text-xs mt-1">Stats will appear here</p>
                </div>
              ) : (
                gameLog.slice(0, 10).map((log, index) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-2 sm:p-3 rounded-lg bg-white/80 border border-slate-200 ${index === 0 ? 'ring-2 ring-amber-300/50' : ''}`}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div 
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-lg flex-shrink-0"
                        style={{ backgroundColor: log.teamColor }}
                      >
                        {log.player.jersey_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 font-semibold text-xs sm:text-sm truncate">{log.player.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span 
                            className={`text-xs px-2 py-0.5 rounded text-white font-bold ${log.statType.color}`}
                          >
                            {log.statType.label}
                          </span>
                          {log.statType.points > 0 && (
                            <span className="text-xs text-green-600 font-bold">
                              +{log.statType.points} pts
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {format(log.timestamp, 'HH:mm:ss')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUndo(log)}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-red-100 text-slate-400 hover:text-red-600 flex-shrink-0"
                      >
                        <Undo2 className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ejection Alert Dialog */}
      <Dialog open={!!ejectedPlayer} onOpenChange={(open) => { if (!open) setEjectedPlayer(null); }}>
        <DialogContent className="bg-white border-red-200 w-[95vw] max-w-md text-center">
          <DialogHeader>
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-9 h-9 text-red-600" />
              </div>
            </div>
            <DialogTitle className="text-xl text-red-700 text-center">Player Ejected</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {ejectedPlayer && (
              <p className="text-slate-700 text-base font-semibold">
                #{ejectedPlayer.jersey_number} {ejectedPlayer.name}
              </p>
            )}
            <p className="text-slate-500 text-sm mt-2">
              This player has received <span className="font-bold text-red-600">2 Technical Fouls</span> and must leave the game. A substitution is required.
            </p>
          </div>
          <Button
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white mt-2"
            onClick={() => {
              if (ejectedPlayer) {
                setPlayersToReplace([ejectedPlayer]);
                setReplacementPlayers([]);
                setSubStep('select_in');
                setShowSubDialog(true);
              }
              setEjectedPlayer(null);
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Proceed to Substitution
          </Button>
        </DialogContent>
      </Dialog>

      {/* Substitution Dialog */}
      <Dialog open={showSubDialog} onOpenChange={setShowSubDialog}>
        <DialogContent className="bg-white/80 text-slate-900 border-slate-200 w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl text-slate-900">
              {subStep === 'select_out' ? 'Select Players to Take Out' : 'Select Replacement Players'}
            </DialogTitle>
            <p className="text-slate-500 text-sm mt-2">
              {subStep === 'select_out' 
                ? 'Click on players you want to substitute (can select multiple)'
                : `Select ${playersToReplace.length} replacement player${playersToReplace.length > 1 ? 's' : ''}`
              }
            </p>
          </DialogHeader>
          
          {subStep === 'select_out' ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm text-white"
                    style={{ backgroundColor: homeTeam?.color }}
                  >
                    {homeTeam?.name?.[0]}
                  </div>
                  {homeTeam?.name}
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {homeActivePlayers.map(player => {
                    const isSelected = playersToReplace.some(p => p.id === player.id);
                    return (
                      <Button
                        key={player.id}
                        variant={isSelected ? "default" : "outline"}
                        className={`justify-start h-auto p-3 ${isSelected ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : 'border-slate-300 hover:bg-slate-100'}`}
                        onClick={() => togglePlayerToReplace(player)}
                      >
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3"
                          style={{ backgroundColor: homeTeam?.color }}
                        >
                          {player.jersey_number}
                        </div>
                        <div className="text-left flex-1">
                          <p className="font-semibold">{player.name}</p>
                          <p className="text-sm text-slate-500">{player.position}</p>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-white text-cyan-500 flex items-center justify-center font-bold">
                            ✓
                          </div>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm text-white"
                    style={{ backgroundColor: awayTeam?.color }}
                  >
                    {awayTeam?.name?.[0]}
                  </div>
                  {awayTeam?.name}
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {awayActivePlayers.map(player => {
                    const isSelected = playersToReplace.some(p => p.id === player.id);
                    return (
                      <Button
                        key={player.id}
                        variant={isSelected ? "default" : "outline"}
                        className={`justify-start h-auto p-3 ${isSelected ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : 'border-slate-300 hover:bg-slate-100'}`}
                        onClick={() => togglePlayerToReplace(player)}
                      >
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3"
                          style={{ backgroundColor: awayTeam?.color }}
                        >
                          {player.jersey_number}
                        </div>
                        <div className="text-left flex-1">
                          <p className="font-semibold">{player.name}</p>
                          <p className="text-sm text-slate-500">{player.position}</p>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-white text-cyan-500 flex items-center justify-center font-bold">
                            ✓
                          </div>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                disabled={playersToReplace.length === 0}
                onClick={() => setSubStep('select_in')}
              >
                Next: Select Replacements ({playersToReplace.length} selected)
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-100 rounded-lg p-4 space-y-2">
                <p className="text-sm text-slate-500 font-semibold">COMING OUT:</p>
                {playersToReplace.map(player => (
                  <div key={player.id} className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: player.team_id === game.home_team_id ? homeTeam?.color : awayTeam?.color }}
                    >
                      {player.jersey_number}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{player.name}</p>
                      <p className="text-sm text-slate-500">{player.position}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-center text-slate-600 font-semibold">
                SELECT {playersToReplace.length} REPLACEMENT{playersToReplace.length > 1 ? 'S' : ''} ({replacementPlayers.length}/{playersToReplace.length})
              </p>

              <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
                {playersToReplace.map(playerOut => {
                  const benchPlayers = playerOut.team_id === game.home_team_id ? homeBenchPlayers : awayBenchPlayers;
                  const teamColor = playerOut.team_id === game.home_team_id ? homeTeam?.color : awayTeam?.color;
                  
                  return (
                    <div key={playerOut.id}>
                      <p className="text-sm text-slate-600 mb-2">Replacement for #{playerOut.jersey_number} {playerOut.name}:</p>
                      {benchPlayers.map(player => {
                        const isSelected = replacementPlayers.includes(player.id);
                        const eligible = isEligibleReplacement(player.id);
                        const canSelect = eligible && (!replacementPlayers.includes(player.id) || isSelected);
                        const pStats = existingStats.find(s => s.player_id === player.id);
                        return (
                          <Button
                            key={player.id}
                            variant={isSelected ? "default" : "outline"}
                            disabled={!canSelect}
                            className={`w-full justify-start h-auto p-3 mb-2 ${isSelected ? 'bg-green-500 hover:bg-green-600 text-white' : eligible ? 'border-slate-300 hover:bg-slate-100' : 'border-red-200 bg-red-50 opacity-60 cursor-not-allowed'}`}
                            onClick={() => toggleReplacementPlayer(player.id)}
                          >
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3"
                              style={{ backgroundColor: teamColor }}
                            >
                              {player.jersey_number}
                            </div>
                            <div className="text-left flex-1">
                              <p className="font-semibold">{player.name}</p>
                              <p className="text-xs text-slate-500">
                                {player.position}
                                {pStats && ` · ${pStats.fouls||0}F · ${pStats.technical_fouls||0}T`}
                              </p>
                              {!eligible && <p className="text-xs text-red-500 font-semibold">Ineligible (foul out / 2 techs)</p>}
                            </div>
                            {isSelected && (
                              <div className="w-6 h-6 rounded-full bg-white text-green-600 flex items-center justify-center font-bold">
                                ✓
                              </div>
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-slate-300 hover:bg-slate-100"
                  onClick={() => {
                    setSubStep('select_out');
                    setReplacementPlayers([]);
                  }}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                  disabled={replacementPlayers.length !== playersToReplace.length}
                  onClick={handleConfirmSubstitution}
                >
                  Confirm Substitution
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
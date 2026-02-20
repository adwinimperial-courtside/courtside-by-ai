import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Trophy, RefreshCw, X, Undo2, Activity, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

import ScoreHeader from "./ScoreHeader";
import EndOfPeriodModal from "./EndOfPeriodModal";
import { findPlayerOfGame } from "../utils/pogCalculator";

const STAT_TYPES = [
  { key: 'points_2', label: '2PT', points: 2, color: 'bg-blue-600 hover:bg-blue-700' },
  { key: 'points_3', label: '3PT', points: 3, color: 'bg-purple-600 hover:bg-purple-700' },
  { key: 'free_throws', label: 'FTM', points: 1, color: 'bg-indigo-600 hover:bg-indigo-700' },
  { key: 'free_throws_missed', label: 'FTX', points: 0, color: 'bg-indigo-300 hover:bg-indigo-400' },
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

const getDeviceName = () => {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua) && /Mobile/.test(ua)) return 'Android Phone';
  if (/Android/.test(ua)) return 'Android Tablet';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown Device';
};

export default function LiveStatTracker({ game, homeTeam, awayTeam, players, existingStats, onBack, onGameUpdate }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [playersToReplace, setPlayersToReplace] = useState([]);
  const [replacementPlayers, setReplacementPlayers] = useState([]);
  const [subStep, setSubStep] = useState('select_out'); // 'select_out' or 'select_in'
  const [ejectedPlayer, setEjectedPlayer] = useState(null); // player ejected due to 2 techs or 5 fouls
  const [ejectionReason, setEjectionReason] = useState(''); // reason for ejection
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const periodEndHandledRef = React.useRef(false);
  const playerMinutesRef = React.useRef({}); // Track accumulated minutes per player {playerId: totalSeconds}
  const playerSubInTimeRef = React.useRef({}); // Track when each player subbed in {playerId: timestamp}
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: gameLogs = [] } = useQuery({
    queryKey: ['gameLogs', game.id],
    queryFn: () => base44.entities.GameLog.filter({ game_id: game.id }, '-created_date'),
  });

  // Real-time subscriptions for live multi-user updates
  useEffect(() => {
    const unsubscribeStats = base44.entities.PlayerStats.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['playerStats', game.id] });
    });
    const unsubscribeLogs = base44.entities.GameLog.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['gameLogs', game.id] });
    });
    const unsubscribeGame = base44.entities.Game.subscribe((event) => {
      if (event.id === game.id) {
        queryClient.invalidateQueries({ queryKey: ['games'] });
        queryClient.invalidateQueries({ queryKey: ['game', game.id] });
      }
    });
    return () => {
      unsubscribeStats();
      unsubscribeLogs();
      unsubscribeGame();
    };
  }, [game.id, queryClient]);

  const activePlayers = existingStats.filter(s => s.is_starter);
  const activePlayerIds = activePlayers.map(s => s.player_id);

  const gameLog = gameLogs.map(log => {
    const player = players.find(p => p.id === log.player_id);
    const teamColor = log.team_id === game.home_team_id ? homeTeam?.color : awayTeam?.color;
    // For substitutions, stat_label holds the player-in's name
    const playerIn = log.stat_type === 'substitution' ? { name: log.stat_label } : null;
    return {
      id: log.id,
      timestamp: new Date(log.created_date),
      player: player,
      playerIn: playerIn,
      isSubstitution: log.stat_type === 'substitution',
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

  // Track period start time to calculate minutes when period ends
  useEffect(() => {
    if (game.clock_running && game.clock_started_at) {
      activePlayers.forEach(stat => {
        if (!periodStartTimeRef.current[stat.id]) {
          periodStartTimeRef.current[stat.id] = Date.now();
        }
      });
    }
  }, [game.clock_running, activePlayers]);

  // Detect period expiration for timed games - just stop the clock
  useEffect(() => {
    if (game.game_mode !== 'timed' || !game.clock_running) return;

    // Compute actual time left (accounting for elapsed time since clock_started_at)
    const stored = game.clock_time_left ?? 0;
    const elapsed = (Date.now() - new Date(game.clock_started_at).getTime()) / 1000;
    const timeLeft = Math.max(0, stored - elapsed);

    if (timeLeft <= 0 && !periodEndHandledRef.current) {
      periodEndHandledRef.current = true;

      // Stop clock (user will press play button to advance)
      updateGameMutation.mutate({
        gameId: game.id,
        data: {
          clock_running: false,
          clock_time_left: 0
        }
      });
    }

    // Reset handler when clock is manually stopped/started
    if (!game.clock_running) {
      periodEndHandledRef.current = false;
    }
  }, [game.clock_running, game.clock_time_left, game.game_mode, updateGameMutation]);

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
      old_away_score: oldScores.away,
      logged_by: currentUser?.email || '',
      device_name: getDeviceName()
    });

    // Check for ejection conditions
    if (statType.key === 'technical_fouls' && currentValue + 1 >= 2) {
      setEjectedPlayer(selectedPlayer);
      setEjectionReason('2 Technical Fouls');
      setSelectedPlayer(null);
    } else if (statType.key === 'fouls' && currentValue + 1 >= 5) {
      setEjectedPlayer(selectedPlayer);
      setEjectionReason('5 Fouls');
      setSelectedPlayer(null);
    }
  };

  const handleConfirmSubstitution = async () => {
    if (playersToReplace.length !== replacementPlayers.length) return;

    for (let i = 0; i < playersToReplace.length; i++) {
      const playerOut = playersToReplace[i];
      const playerInId = replacementPlayers[i];
      const playerIn = players.find(p => p.id === playerInId);

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
          minutes_played: 0
        });
      }

      // Track when this player enters the court for minutes calculation
      periodStartTimeRef.current[playerInId] = Date.now();

      // Log the substitution to game log
      await createLogMutation.mutateAsync({
        game_id: game.id,
        player_id: playerOut.id,
        team_id: playerOut.team_id,
        stat_type: 'substitution',
        stat_label: playerIn?.name || 'Unknown',
        stat_points: 0,
        stat_color: 'bg-cyan-600 hover:bg-cyan-700',
        old_home_score: game.home_score || 0,
        old_away_score: game.away_score || 0,
        logged_by: currentUser?.email || '',
        device_name: getDeviceName()
      });

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

  const handleStartNextPeriod = async () => {
    const nextPeriod = game.clock_period + 1;
    const totalPeriods = game.period_count || (game.period_type === 'halves' ? 2 : 4);
    const nextIsOT = nextPeriod > totalPeriods;
    const nextMins = nextIsOT ? (game.overtime_minutes || 5) : (game.period_minutes || 10);

    await updateGameMutation.mutateAsync({
      gameId: game.id,
      data: {
        clock_period: nextPeriod,
        clock_time_left: nextMins * 60,
        clock_running: false,
        clock_started_at: null,
        period_status: 'active'
      }
    });

    // Clear period end handler and period tracking
    periodEndHandledRef.current = false;
    periodStartTimeRef.current = {};
    };

  const handleStartOvertime = async () => {
    const totalPeriods = game.period_count || (game.period_type === 'halves' ? 2 : 4);
    const otPeriod = totalPeriods + 1;
    const otMins = game.overtime_minutes || 5;

    await updateGameMutation.mutateAsync({
      gameId: game.id,
      data: {
        clock_period: otPeriod,
        clock_time_left: otMins * 60,
        clock_running: false,
        clock_started_at: null,
        period_status: 'active'
      }
    });

    periodEndHandledRef.current = false;
    periodStartTimeRef.current = {};
    };

  const handleEndGameFromModal = async () => {
    const homeScore = game.home_score || 0;
    const awayScore = game.away_score || 0;
    const homeWins = homeScore > awayScore;

    // Calculate total minutes for each player who played
    const periodMinutes = game.period_minutes || 10;
    const overtimeMinutes = game.overtime_minutes || 5;
    const totalPeriods = game.period_count || (game.period_type === 'halves' ? 2 : 4);

    existingStats.forEach(playerStat => {
      if (playerStat.is_starter && periodStartTimeRef.current[playerStat.id]) {
        const secondsPlayed = (Date.now() - periodStartTimeRef.current[playerStat.id]) / 1000;
        const minutesThisPeriod = Math.round((secondsPlayed / 60) * 100) / 100;
        const totalMinutes = (playerStat.minutes_played || 0) + minutesThisPeriod;

        updateStatMutation.mutate({
          statId: playerStat.id,
          updates: { minutes_played: totalMinutes }
        });
      }
    });

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

    try {
      console.log('Starting end game process...');
      const homeScore = game.home_score || 0;
      const awayScore = game.away_score || 0;
      const homeWins = homeScore > awayScore;
      
      console.log('Final score - Home:', homeScore, 'Away:', awayScore, 'Home wins:', homeWins);

      // Update game status to completed
      console.log('Updating game status to completed...');
      const result = await base44.entities.Game.update(game.id, { 
        status: 'completed',
        player_of_game: findPlayerOfGame(existingStats, game)
      });
      console.log('Game updated:', result);

      // Update team records
      console.log('Updating team records...');
      const teams = await base44.entities.Team.filter({ id: game.home_team_id });
      const homeTeamData = teams[0];
      
      await base44.entities.Team.update(game.home_team_id, {
        wins: homeWins ? (homeTeamData.wins || 0) + 1 : homeTeamData.wins || 0,
        losses: !homeWins ? (homeTeamData.losses || 0) + 1 : homeTeamData.losses || 0
      });
      console.log('Home team updated');

      await new Promise(resolve => setTimeout(resolve, 200));

      const awayTeams = await base44.entities.Team.filter({ id: game.away_team_id });
      const awayTeamData = awayTeams[0];
      
      await base44.entities.Team.update(game.away_team_id, {
        wins: !homeWins ? (awayTeamData.wins || 0) + 1 : awayTeamData.wins || 0,
        losses: homeWins ? (awayTeamData.losses || 0) + 1 : awayTeamData.losses || 0
      });
      console.log('Away team updated');

      console.log('Game end complete, navigating back...');
      onBack();
    } catch (error) {
      console.error('Error ending game:', error);
      alert('Failed to end game: ' + error.message);
    }
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

  const PlayerButton = ({ player, teamColor, onSubClick, isDesktop }) => {
    const playerStats = existingStats.find(s => s.player_id === player.id);
    const totalPoints = ((playerStats?.points_2 || 0) * 2) + ((playerStats?.points_3 || 0) * 3) + (playerStats?.free_throws || 0);
    const isSelected = selectedPlayer?.id === player.id;

    const desktopStyle = isDesktop
      ? isSelected
        ? {
            backgroundColor: `${teamColor}0E`,
            borderColor: teamColor,
            borderWidth: '3px',
            boxShadow: `0 4px 12px ${teamColor}30, 0 0 0 1px ${teamColor}20`,
            transition: 'all 0.15s ease',
          }
        : playerStats?.fouls >= 4
          ? { backgroundColor: '#fff7ed', borderColor: '#d1d5db', borderWidth: '1px', boxShadow: '0 2px 6px rgba(0,0,0,0.10)', transition: 'all 0.15s ease' }
          : { borderColor: '#d1d5db', borderWidth: '1px', boxShadow: '0 2px 6px rgba(0,0,0,0.10)', transition: 'all 0.15s ease' }
      : isSelected
        ? { backgroundColor: `${teamColor}18`, borderColor: teamColor, boxShadow: `0 0 0 2px ${teamColor}30` }
        : playerStats?.fouls >= 4
          ? { backgroundColor: '#fff7ed', borderColor: '#e2e8f0' }
          : { borderColor: '#e2e8f0' };

    return (
      <div className="relative">
        <motion.button
          whileTap={{ scale: isDesktop ? 0.98 : 0.92 }}
          onClick={() => setSelectedPlayer(player)}
          className={`w-full p-1.5 rounded-xl border-2 ${isDesktop ? 'hover:shadow-md' : isSelected ? 'ring-2 ring-offset-1 hover:bg-slate-100' : 'hover:bg-slate-100'}`}
          style={desktopStyle}
        >
          <div className="flex flex-col items-center gap-1">
            <div 
                className="w-8 h-8 2xl:w-12 2xl:h-12 rounded-full flex items-center justify-center text-white font-bold text-xs 2xl:text-base shadow-md bg-slate-600"
              >
              {player.jersey_number}
            </div>
            <div className="text-center w-full">
              <p className="font-semibold text-slate-900 text-[10px] 2xl:text-xs truncate leading-tight">{player.name}</p>
            </div>
            {playerStats && (
              <div className="text-center pt-1 border-t border-slate-200 w-full">
                <p className="text-sm font-bold text-slate-900">{totalPoints} <span className="text-[9px] font-normal text-slate-500">PTS</span></p>
                <p className="text-[9px] text-slate-400 mt-0.5">{(playerStats.minutes_played || 0).toFixed(1)}M</p>
                <div className="grid grid-cols-2 gap-x-1 mt-0.5">
                  <span className="text-[9px] text-slate-500">{(playerStats.offensive_rebounds||0)+(playerStats.defensive_rebounds||0)}R</span>
                  <span className="text-[9px] text-slate-500">{playerStats.assists||0}A</span>
                  <span className={`text-[9px] font-semibold ${(playerStats.fouls||0) >= 4 ? 'text-red-600' : 'text-slate-500'}`}>{playerStats.fouls||0}F</span>
                  <span className="text-[9px] text-slate-500">{playerStats.technical_fouls||0}T</span>
                </div>
              </div>
            )}
          </div>
        </motion.button>
        <button
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full p-0 shadow-lg flex items-center justify-center transition-colors"
          style={{ backgroundColor: '#E5E7EB' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#D1D5DB'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#E5E7EB'}
          onClick={(e) => {
            e.stopPropagation();
            onSubClick(player);
          }}
        >
          <RefreshCw className="w-2.5 h-2.5 text-slate-600" />
        </button>
      </div>
    );
  };



  // ── Shared sub-component for team panel (vertical player list) ──
  const TeamPanel = ({ team, activePlayers: teamPlayers, borderColor, labelColor, side }) => {
    const isHome = side === 'home';
    // Fixed accent colors: home=blue, away=red (regardless of team color)
    const accentColor = isHome ? '#3b82f6' : '#ef4444';
    const bgTint = isHome ? '#3b82f610' : '#ef444410';
    const isSelectedTeam = selectedPlayer && selectedPlayer.team_id === (isHome ? game.home_team_id : game.away_team_id);
    const borderWidth = isSelectedTeam ? '4px' : '3px';
    const borderStyle = side === undefined
      ? {}
      : isHome
        ? { borderRight: `${borderWidth} solid ${accentColor}`, backgroundColor: bgTint }
        : { borderLeft: `${borderWidth} solid ${accentColor}`, backgroundColor: bgTint };
    return (
    <div className={`backdrop-blur border border-slate-200 rounded-2xl p-2 flex flex-col h-full`} style={borderStyle}>
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md"
          style={{ backgroundColor: team?.color || '#64748b' }}
        >
          {team?.name?.[0]}
        </div>
        <h2 className={`text-sm font-bold ${labelColor} truncate`}>{team?.name}</h2>
        <span className="ml-auto text-slate-500 text-xs whitespace-nowrap">{teamPlayers.length}/5</span>
      </div>
      {/* Mobile: 5-col grid / Desktop: vertical stack */}
      <div className="grid grid-cols-5 gap-1 min-[900px]:grid-cols-1 min-[900px]:gap-1.5 min-[900px]:flex-1">
        {teamPlayers.map((player) => (
          <PlayerButton
            key={player.id}
            player={player}
            teamColor={team?.color}
            isDesktop={side !== undefined}
            onSubClick={(p) => {
              setPlayersToReplace([p]);
              setSubStep('select_in');
              setShowSubDialog(true);
            }}
          />
        ))}
      </div>
    </div>
    );
  };

  // ── Stat control panel (shared between mobile & desktop, button heights differ) ──
  const StatPanel = ({ large }) => {
    const btnH = large ? 'h-[4.5rem]' : 'h-14';
    return (
      <div className="bg-gradient-to-r from-indigo-100/50 to-purple-100/50 backdrop-blur border-2 border-indigo-300/50 rounded-2xl p-3 flex flex-col h-full">
        {/* Selected player indicator */}
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

        {/* Row 1: FT split + 2PT + 3PT */}
        <div className={`grid grid-cols-3 gap-1.5 mb-${large ? '2' : '1.5'}`}>
          {/* FTM/FTX split */}
          <div className="flex rounded-lg overflow-hidden shadow-md">
            <motion.button
              whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}
              onClick={() => handleStatClick(STAT_TYPES.find(s => s.key === 'free_throws'))}
              disabled={!selectedPlayer}
              className={`flex-1 ${btnH} text-white font-bold text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150`}
            >
              FTM
            </motion.button>
            <div className="w-px bg-indigo-900/30" />
            <motion.button
              whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}
              onClick={() => handleStatClick(STAT_TYPES.find(s => s.key === 'free_throws_missed'))}
              disabled={!selectedPlayer}
              className={`flex-1 ${btnH} text-white font-bold text-xs bg-indigo-300 hover:bg-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150`}
            >
              FTX
            </motion.button>
          </div>
          {['points_2', 'points_3'].map(key => {
            const stat = STAT_TYPES.find(s => s.key === key);
            return (
              <motion.div key={stat.key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                <Button
                  onClick={() => handleStatClick(stat)}
                  disabled={!selectedPlayer}
                  className={`w-full ${btnH} text-white font-bold text-sm ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md transition-all duration-150`}
                >
                  {stat.label}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Row 2: OREB DREB AST */}
        <div className={`grid grid-cols-3 gap-1.5 mb-${large ? '2' : '1.5'}`}>
          {['offensive_rebounds', 'defensive_rebounds', 'assists'].map(key => {
            const stat = STAT_TYPES.find(s => s.key === key);
            return (
              <motion.div key={stat.key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                <Button
                  onClick={() => handleStatClick(stat)}
                  disabled={!selectedPlayer}
                  className={`w-full ${btnH} text-white font-bold text-sm ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md transition-all duration-150`}
                >
                  {stat.label}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Row 3: STL BLK TO FOUL TECH UNSP */}
        <div className={`grid grid-cols-6 gap-1.5 mb-${large ? '2' : '1.5'}`}>
          {['steals', 'blocks', 'turnovers', 'fouls', 'technical_fouls', 'unsportsmanlike_fouls'].map(key => {
            const stat = STAT_TYPES.find(s => s.key === key);
            return (
              <motion.div key={stat.key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                <Button
                  onClick={() => handleStatClick(stat)}
                  disabled={!selectedPlayer}
                  className={`w-full ${btnH} text-white font-bold text-xs ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md transition-all duration-150`}
                >
                  {stat.label}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Row 4: Substitution */}
        <Button
          onClick={() => {
            setPlayersToReplace([]);
            setReplacementPlayers([]);
            setSubStep('select_out');
            setShowSubDialog(true);
          }}
          className={`w-full ${large ? 'h-12' : 'h-10'} bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-sm shadow-lg mt-auto`}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Make Substitution
        </Button>
      </div>
    );
  };

  const ActivityLog = ({ compact = false }) => (
    <div className={`flex flex-col overflow-hidden h-full ${compact ? '' : 'bg-white/60 backdrop-blur border border-slate-200 rounded-2xl p-3'}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 flex-shrink-0 ${compact ? 'px-2 py-1 border-b border-slate-200 mb-1' : 'mb-3 pb-3 border-b border-slate-200'}`}>
        <Activity className="w-3.5 h-3.5 text-indigo-500" />
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Game Activity</h3>
        <span className="ml-auto text-xs text-slate-400">{gameLog.length} actions</span>
      </div>
      {/* Feed */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {gameLog.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400 text-xs">No actions yet</p>
          </div>
        ) : (
          gameLog.filter(log => log.player).slice(0, 30).map((log, index) => (
            <div
              key={log.id}
              className={`flex items-center gap-2 px-2 py-1.5 border-b border-slate-100 last:border-0 ${index === 0 ? 'bg-amber-50/60' : 'hover:bg-slate-50/50'}`}
            >
              {log.isSubstitution ? (
                /* Substitution row */
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <RefreshCw className="w-3 h-3 text-cyan-500 flex-shrink-0" />
                  <span className="text-[10px] font-bold text-cyan-600 flex-shrink-0">SUB</span>
                  <span className="text-[10px] text-slate-500 truncate">
                    <span className="font-semibold" style={{ color: log.player?.team_id === game.home_team_id ? '#3b82f6' : '#ef4444' }}>{log.player?.name}</span>
                    <span className="text-slate-400"> → </span>
                    <span className="font-semibold text-green-600">{log.playerIn?.name}</span>
                  </span>
                </div>
              ) : (
                <>
                  {/* Player name */}
                  <p className="font-semibold text-xs truncate w-[30%] flex-shrink-0" style={{ color: log.player?.team_id === game.home_team_id ? '#3b82f6' : log.player?.team_id === game.away_team_id ? '#ef4444' : '#1e293b' }}>{log.player?.name ?? '—'}</p>
                  {/* Stat badge + points */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white font-bold flex-shrink-0 ${log.statType.color}`}>{log.statType.label}</span>
                    {log.statType.points > 0 && <span className="text-[10px] text-green-600 font-bold flex-shrink-0">+{log.statType.points}pts</span>}
                  </div>
                </>
              )}
              {/* Timestamp + undo (no undo for substitutions) */}
              <span className="text-[10px] text-slate-400 flex-shrink-0">{format(log.timestamp, 'HH:mm:ss')}</span>
              {!log.isSubstitution && (
                <Button size="sm" variant="ghost" onClick={() => handleUndo(log)} className="h-5 w-5 p-0 hover:bg-red-100 text-slate-300 hover:text-red-500 flex-shrink-0">
                  <Undo2 className="w-2.5 h-2.5" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 min-[900px]:h-screen min-[900px]:overflow-hidden">

      {/* ── MOBILE LAYOUT (< 900px) ── */}
      <div className="min-[900px]:hidden max-w-[1400px] mx-auto px-3 py-3 pb-10">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" onClick={() => setShowExitDialog(true)} className="text-slate-600 hover:bg-slate-200/50 h-10 px-3 text-sm">
            <ArrowLeft className="w-4 h-4 mr-1" />Exit
          </Button>
          <Button onClick={handleEndGame} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 h-10 px-3 text-sm text-white">
            <Trophy className="w-4 h-4 mr-1" />End Game
          </Button>
        </div>
        <ScoreHeader game={game} homeTeam={homeTeam} awayTeam={awayTeam} onGameUpdate={onGameUpdate} />
        <div className="mt-3 space-y-3">
          <TeamPanel team={homeTeam} activePlayers={homeActivePlayers} borderColor="border-l-blue-300" labelColor="text-blue-600" />
          {/* Stat buttons – mobile */}
          <div className="bg-gradient-to-r from-indigo-100/50 to-purple-100/50 backdrop-blur border-2 border-indigo-300/50 rounded-2xl p-3">
            {/* Selected player indicator */}
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
            {/* Row 1 */}
            <div className="grid grid-cols-3 gap-1.5 mb-1.5">
              <div className="flex rounded-lg overflow-hidden shadow-md">
                <motion.button whileTap={{ scale: selectedPlayer ? 0.92 : 1 }} onClick={() => handleStatClick(STAT_TYPES.find(s => s.key === 'free_throws'))} disabled={!selectedPlayer} className="flex-1 h-10 text-white font-bold text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150">FTM</motion.button>
                <div className="w-px bg-indigo-900/30" />
                <motion.button whileTap={{ scale: selectedPlayer ? 0.92 : 1 }} onClick={() => handleStatClick(STAT_TYPES.find(s => s.key === 'free_throws_missed'))} disabled={!selectedPlayer} className="flex-1 h-10 text-white font-bold text-xs bg-indigo-300 hover:bg-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150">FTX</motion.button>
              </div>
              {['points_2', 'points_3'].map(key => { const stat = STAT_TYPES.find(s => s.key === key); return (
                <motion.div key={stat.key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                  <Button onClick={() => handleStatClick(stat)} disabled={!selectedPlayer} className={`w-full h-10 text-white font-bold text-sm ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md`}>{stat.label}</Button>
                </motion.div>
              ); })}
            </div>
            {/* Row 2 */}
            <div className="grid grid-cols-3 gap-1.5 mb-1.5">
              {['offensive_rebounds', 'defensive_rebounds', 'assists'].map(key => { const stat = STAT_TYPES.find(s => s.key === key); return (
                <motion.div key={stat.key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                  <Button onClick={() => handleStatClick(stat)} disabled={!selectedPlayer} className={`w-full h-10 text-white font-bold text-sm ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md`}>{stat.label}</Button>
                </motion.div>
              ); })}
            </div>
            {/* Row 3 */}
            <div className="grid grid-cols-6 gap-1.5 mb-1.5">
              {['steals', 'blocks', 'turnovers', 'fouls', 'technical_fouls', 'unsportsmanlike_fouls'].map(key => { const stat = STAT_TYPES.find(s => s.key === key); return (
                <motion.div key={stat.key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                  <Button onClick={() => handleStatClick(stat)} disabled={!selectedPlayer} className={`w-full h-10 text-white font-bold text-xs ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md`}>{stat.label}</Button>
                </motion.div>
              ); })}
            </div>
            {/* Substitution */}
            <Button onClick={() => { setPlayersToReplace([]); setReplacementPlayers([]); setSubStep('select_out'); setShowSubDialog(true); }} className="w-full h-10 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-sm shadow-lg">
              <RefreshCw className="w-4 h-4 mr-2" />Make Substitution
            </Button>
          </div>
          <TeamPanel team={awayTeam} activePlayers={awayActivePlayers} borderColor="border-l-red-300" labelColor="text-red-600" />
          {/* Activity log */}
          <div className="bg-white/60 backdrop-blur border border-slate-200 rounded-2xl p-3" style={{ minHeight: '200px' }}>
            <ActivityLog compact={false} />
          </div>
        </div>
      </div>

      {/* ── LARGE SCREEN LAYOUT (≥ 900px) ── */}
      <div className="hidden min-[900px]:flex flex-col h-screen overflow-hidden px-4 py-3">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <Button variant="ghost" onClick={() => setShowExitDialog(true)} className="text-slate-600 hover:bg-slate-200/50 h-11 px-5">
            <ArrowLeft className="w-5 h-5 mr-2" />Exit
          </Button>
          <Button onClick={handleEndGame} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 h-11 px-5 text-white">
            <Trophy className="w-5 h-5 mr-2" />End Game
          </Button>
        </div>

        {/* Scoreboard – full width, ~100px */}
        <div className="flex-shrink-0 mb-2" style={{ height: '90px' }}>
          <ScoreHeader game={game} homeTeam={homeTeam} awayTeam={awayTeam} onGameUpdate={onGameUpdate} />
        </div>

        {/* Main 3-column row – fills all remaining space, no scroll */}
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Home team – 25% */}
          <div className="w-[25%] flex-shrink-0 min-h-0">
            <TeamPanel team={homeTeam} activePlayers={homeActivePlayers} borderColor="border-l-blue-300" labelColor="text-blue-600" side="home" />
          </div>

          {/* Center: Stat buttons (70%) + Activity (30%) stacked vertically – 50% */}
          <div className="w-[50%] flex-shrink-0 flex flex-col gap-2 min-h-0">
            <div className="flex-[7] min-h-0">
              <StatPanel large={true} />
            </div>
            <div className="flex-[3] min-h-0 bg-white/50 backdrop-blur border border-slate-200 rounded-xl overflow-hidden">
              <ActivityLog compact={true} />
            </div>
          </div>

          {/* Away team – 25% */}
          <div className="w-[25%] flex-shrink-0 min-h-0">
            <TeamPanel team={awayTeam} activePlayers={awayActivePlayers} borderColor="border-l-red-300" labelColor="text-red-600" side="away" />
          </div>
        </div>
      </div>

      {/* Exit Confirmation Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="bg-white border-slate-200 w-[95vw] max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <ArrowLeft className="w-9 h-9 text-amber-600" />
              </div>
            </div>
            <DialogTitle className="text-xl text-slate-800 text-center">Are you sure you want to exit?</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-center">
            <p className="text-slate-600 text-sm leading-relaxed">
              Please click the <span className="font-bold text-green-600">End Game</span> button if the game is finished. If not, you can exit and the game status will still be <span className="font-bold text-indigo-600">LIVE</span>.
            </p>
          </div>
          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              className="flex-1 border-slate-300 hover:bg-slate-100"
              onClick={() => setShowExitDialog(false)}
            >
              No, stay
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              onClick={() => { setShowExitDialog(false); onBack(); }}
            >
              Yes, exit
            </Button>
          </div>
        </DialogContent>
      </Dialog>



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
              This player has received <span className="font-bold text-red-600">{ejectionReason}</span> and must leave the game. A substitution is required.
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
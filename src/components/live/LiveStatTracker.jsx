import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Trophy, RefreshCw, X, Undo2, Activity, AlertTriangle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

import ScoreHeader from "./ScoreHeader";
import EndOfPeriodModal from "./EndOfPeriodModal";
import { findPlayerOfGame } from "../utils/pogCalculator";
import EmergencyLineupRepair from "./EmergencyLineupRepair";

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

const MAX_FOUL_LIMIT = 5; // Configurable: change this to support different league foul limits

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

export default function LiveStatTracker({ game, homeTeam, awayTeam, players, existingStats: initialStats, onBack, onGameUpdate }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [homePlayersOut, setHomePlayersOut] = useState([]);
  const [awayPlayersOut, setAwayPlayersOut] = useState([]);
  const [homePlayersIn, setHomePlayersIn] = useState([]);
  const [awayPlayersIn, setAwayPlayersIn] = useState([]);
  const [subStep, setSubStep] = useState('select_out');
  const [ejectedPlayer, setEjectedPlayer] = useState(null);
  const [ejectionReason, setEjectionReason] = useState('');
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [repairMode, setRepairMode] = useState(null); // null or { teams: [...] }
  const lastValidLineupsRef = React.useRef({});
  const periodEndHandledRef = React.useRef(false);
  const playerMinutesRef = React.useRef({});
  const playerGameClockStateRef = React.useRef({});
  const isSubmittingSubRef = React.useRef(false);
  const isProcessingStatRef = React.useRef(false);
  const lastStatClickTimeRef = React.useRef(0);
  const queryClient = useQueryClient();

  const computeTimeLeft = (currentGame) => {
    const stored = currentGame.clock_time_left ?? ((currentGame.period_minutes || 10) * 60);
    if (!currentGame.clock_running || !currentGame.clock_started_at) return Math.max(0, stored);
    const elapsed = (Date.now() - new Date(currentGame.clock_started_at).getTime()) / 1000;
    return Math.max(0, stored - elapsed);
  };

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: liveStats = initialStats } = useQuery({
    queryKey: ['playerStats', game.id],
    queryFn: () => base44.entities.PlayerStats.filter({ game_id: game.id }),
    initialData: initialStats,
    staleTime: 5000, // Keep data fresh for 5 seconds, reduce refetch spam
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const existingStats = liveStats;

  const { data: gameLogs = [] } = useQuery({
    queryKey: ['gameLogs', game.id],
    queryFn: () => base44.entities.GameLog.filter({ game_id: game.id }, '-created_date'),
    staleTime: 5000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    let timeoutStats, timeoutLogs;
    
    // Only invalidate PlayerStats when other sources change (external updates)
    const unsubscribeStats = base44.entities.PlayerStats.subscribe((event) => {
      // Only refetch if it's NOT from this current user's actions
      // Since mutations already update cache, only refetch on external changes
      if (event.type !== 'create' && event.type !== 'update') {
        clearTimeout(timeoutStats);
        timeoutStats = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['playerStats', game.id] });
        }, 500); // Longer debounce to batch updates
      }
    });
    
    // Only invalidate GameLogs when others modify (rare during live game)
    const unsubscribeLogs = base44.entities.GameLog.subscribe((event) => {
      if (event.type === 'delete') {
        clearTimeout(timeoutLogs);
        timeoutLogs = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['gameLogs', game.id] });
        }, 500);
      }
    });
    
    return () => {
      clearTimeout(timeoutStats);
      clearTimeout(timeoutLogs);
      unsubscribeStats();
      unsubscribeLogs();
    };
  }, [game.id, queryClient]);

  const activePlayers = existingStats.filter(s => s.is_starter);
  const activePlayerIds = activePlayers.map(s => s.player_id);

  // Track active player counts per team to detect lineup violations reactively
  const homeActiveCount = existingStats.filter(s => s.team_id === game.home_team_id && s.is_starter).length;
  const awayActiveCount = existingStats.filter(s => s.team_id === game.away_team_id && s.is_starter).length;

  // Final review mode: clock at 00:00, not running, last regulation period or any overtime
  const _totalPeriods = game.period_count || (game.period_type === 'halves' ? 2 : 4);
  const currentPeriod = game.clock_period ?? 1;
  const isInFinalReview = (
    (game.clock_time_left === 0 || game.clock_time_left == null) &&
    !game.clock_running &&
    (currentPeriod === _totalPeriods || currentPeriod > _totalPeriods) &&
    game.period_status === 'completed'
  );

  // Fire repair check whenever lineup counts change (catches bad state on load + real-time updates)
  useEffect(() => {
    if (existingStats.length === 0) return;
    if (isSubmittingSubRef.current) return; // Skip mid-substitution to avoid false positives
    checkAndTriggerRepair(existingStats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeActiveCount, awayActiveCount]);

  useEffect(() => {
    activePlayers.forEach(stat => {
      if (!playerMinutesRef.current[stat.player_id]) {
        playerMinutesRef.current[stat.player_id] = stat.minutes_played ? stat.minutes_played * 60 : 0;
      }
      if (!playerGameClockStateRef.current[stat.player_id] || playerGameClockStateRef.current[stat.player_id].period !== game.clock_period) {
        playerGameClockStateRef.current[stat.player_id] = {
          timeLeft: computeTimeLeft(game),
          period: game.clock_period
        };
      }
    });
    // Initialize valid lineup snapshots on first load
    if (existingStats.length > 0) {
      updateValidSnapshots(existingStats);
    }
  }, [activePlayers, game.clock_time_left, game.clock_period, game.clock_running, game.clock_started_at]);

  const gameLog = gameLogs.map(log => {
    const player = players.find(p => p.id === log.player_id);
    const teamColor = log.team_id === game.home_team_id ? homeTeam?.color : awayTeam?.color;
    let subData = null;
    let displayLabel = log.stat_label;
    if (log.stat_type === 'substitution') {
      try {
        const parsed = JSON.parse(log.stat_label);
        displayLabel = parsed.display || log.stat_label;
        subData = parsed;
      } catch (e) {
        displayLabel = log.stat_label;
      }
    }
    return {
      id: log.id,
      timestamp: new Date(log.created_date),
      player: player,
      isSubstitution: log.stat_type === 'substitution',
      subData,
      statType: {
        key: log.stat_type,
        label: displayLabel,
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
      teamColor: teamColor,
      teamId: log.team_id
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
      const team = await base44.entities.Team.get(teamId);
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

  useEffect(() => {
    if (game.game_mode !== 'timed' || !game.clock_running) return;

    const currentComputedTimeLeft = computeTimeLeft(game);

    if (currentComputedTimeLeft <= 0 && !periodEndHandledRef.current) {
      periodEndHandledRef.current = true;

      activePlayers.forEach(stat => {
        const clockState = playerGameClockStateRef.current[stat.player_id];
        if (clockState && clockState.period === game.clock_period) {
          const gameTimeElapsed = clockState.timeLeft - 0;
          playerMinutesRef.current[stat.player_id] = (playerMinutesRef.current[stat.player_id] || 0) + gameTimeElapsed;
        }
        playerGameClockStateRef.current[stat.player_id] = null;
      });

      updateGameMutation.mutate({
        gameId: game.id,
        data: {
          clock_running: false,
          clock_time_left: 0,
          clock_started_at: null,
          period_status: 'completed',
        }
      });
    }

    if (!game.clock_running) {
      periodEndHandledRef.current = false;
    }
  }, [game.clock_running, game.clock_time_left, game.game_mode, game.clock_started_at, game.clock_period, updateGameMutation, activePlayers]);

  // FIBA-style default rules — reads from game.game_rules with fallback
  const getGameRules = () => ({
    teamFoulBonusThreshold: 5,
    countPersonalFoulsAsTeamFoul: true,
    countOffensiveFoulsAsTeamFoul: true,
    countPlayerTechnicalAsTeamFoul: true,
    countUnsportsmanlikeAsTeamFoul: true,
    countPlayerDisqualifyingAsTeamFoul: true,
    countBenchTechnicalAsTeamFoul: false,
    countCoachTechnicalAsTeamFoul: false,
    ...(game.game_rules || {}),
  });

  const statCountsAsTeamFoul = (statKey) => {
    const rules = getGameRules();
    if (statKey === 'fouls') return rules.countPersonalFoulsAsTeamFoul;
    if (statKey === 'technical_fouls') return rules.countPlayerTechnicalAsTeamFoul;
    if (statKey === 'unsportsmanlike_fouls') return rules.countUnsportsmanlikeAsTeamFoul;
    return false;
  };

  const getFoulResetKey = (period) => {
    const totalPeriods = game.period_count || (game.period_type === 'halves' ? 2 : 4);
    if (period > totalPeriods) return String(period);
    if (game.period_type === 'halves') return period === 1 ? 'h1' : 'h2';
    return String(period);
  };

  // ── Lineup validation ────────────────────────────────────────────
  const getFoulLimits = () => ({
    personalFoulLimit: game.game_rules?.personalFoulLimit ?? MAX_FOUL_LIMIT,
    technicalFoulLimit: game.game_rules?.technicalFoulLimit ?? 2,
    unsportsmanlikeFoulLimit: game.game_rules?.unsportsmanlikeFoulLimit ?? 2,
  });

  const isPlayerEligibleForCourt = (playerId, stats) => {
    const limits = getFoulLimits();
    const s = stats.find(st => st.player_id === playerId);
    if (!s) return true;
    return (
      (s.fouls || 0) < limits.personalFoulLimit &&
      (s.technical_fouls || 0) < limits.technicalFoulLimit &&
      (s.unsportsmanlike_fouls || 0) < limits.unsportsmanlikeFoulLimit
    );
  };

  const checkAndTriggerRepair = (freshStats) => {
    const teamIds = [game.home_team_id, game.away_team_id];
    const teamsNeedingRepair = [];

    for (const teamId of teamIds) {
      const teamPlayers = players.filter(p => p.team_id === teamId);
      const activeIds = new Set(freshStats.filter(s => s.team_id === teamId && s.is_starter).map(s => s.player_id));
      const activePls = teamPlayers.filter(p => activeIds.has(p.id));
      const activeCount = activePls.length;
      const benchPls = teamPlayers.filter(p => !activeIds.has(p.id));
      const eligibleBench = benchPls.filter(p => isPlayerEligibleForCourt(p.id, freshStats));

      const isValid = activeCount === 5 || (activeCount < 5 && eligibleBench.length === 0);
      if (!isValid) {
        const teamObj = teamId === game.home_team_id ? homeTeam : awayTeam;
        teamsNeedingRepair.push({
          teamId,
          teamName: teamObj?.name || (teamId === game.home_team_id ? 'Home' : 'Away'),
          team: teamObj,
          activePlayers: activePls,
        });
      } else {
        // Valid — update snapshot
        lastValidLineupsRef.current[teamId] = {
          playerIds: [...activeIds],
          timestamp: new Date().toISOString(),
          period: game.clock_period ?? 1,
          clockTime: game.clock_time_left ?? 0,
        };
      }
    }

    if (teamsNeedingRepair.length > 0) {
      setRepairMode({ teams: teamsNeedingRepair });
    }
    return teamsNeedingRepair.length === 0;
  };

  const updateValidSnapshots = (freshStats) => {
    const teamIds = [game.home_team_id, game.away_team_id];
    for (const teamId of teamIds) {
      const teamPlayers = players.filter(p => p.team_id === teamId);
      const activeIds = new Set(freshStats.filter(s => s.team_id === teamId && s.is_starter).map(s => s.player_id));
      const activePls = teamPlayers.filter(p => activeIds.has(p.id));
      const activeCount = activePls.length;
      const benchPls = teamPlayers.filter(p => !activeIds.has(p.id));
      const eligibleBench = benchPls.filter(p => isPlayerEligibleForCourt(p.id, freshStats));
      const isValid = activeCount === 5 || (activeCount < 5 && eligibleBench.length === 0);
      if (isValid) {
        lastValidLineupsRef.current[teamId] = {
          playerIds: [...activeIds],
          timestamp: new Date().toISOString(),
          period: game.clock_period ?? 1,
          clockTime: game.clock_time_left ?? 0,
        };
      }
    }
  };

  const handleStatClick = async (statType) => {
    // Prevent rapid repeated clicks with cooldown
    const now = Date.now();
    if (now - lastStatClickTimeRef.current < 500) return;
    if (isProcessingStatRef.current) return;
    if (!selectedPlayer) return;
    
    lastStatClickTimeRef.current = now;

    const playerStat = existingStats.find(s => s.player_id === selectedPlayer.id);
    if (!playerStat) return;

    isProcessingStatRef.current = true;
    try {
      const currentValue = playerStat[statType.key] || 0;
      const updates = { [statType.key]: currentValue + 1 };
      
      const oldScores = { home: game.home_score || 0, away: game.away_score || 0 };

      // Update player stat
      await updateStatMutation.mutateAsync({ statId: playerStat.id, updates });

      // Build game update payload (can combine multiple fields)
      const gameUpdates = {};
      
      // Add team fouls if applicable
      if (statCountsAsTeamFoul(statType.key)) {
        const isHome = selectedPlayer.team_id === game.home_team_id;
        const foulKey = isHome ? 'home_team_fouls' : 'away_team_fouls';
        const period = game.clock_period ?? 1;
        const resetKey = getFoulResetKey(period);
        const currentFoulMap = { ...(game[foulKey] || {}) };
        currentFoulMap[resetKey] = (currentFoulMap[resetKey] || 0) + 1;
        gameUpdates[foulKey] = currentFoulMap;
      }

      // Add score if points were awarded
      if (statType.points > 0) {
        const isHomeTeam = selectedPlayer.team_id === game.home_team_id;
        const newScore = isHomeTeam 
          ? (game.home_score || 0) + statType.points
          : (game.away_score || 0) + statType.points;
        gameUpdates[isHomeTeam ? 'home_score' : 'away_score'] = newScore;
      }

      // Single game update call (combines fouls + score)
      if (Object.keys(gameUpdates).length > 0) {
        await updateGameMutation.mutateAsync({ gameId: game.id, data: gameUpdates });
      }

      // Create game log entry
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

      if (statType.key === 'technical_fouls' && currentValue + 1 >= 2) {
        setEjectedPlayer(selectedPlayer);
        setEjectionReason('2 Technical Fouls');
        setSelectedPlayer(null);
        await createLogMutation.mutateAsync({
          game_id: game.id,
          player_id: selectedPlayer.id,
          team_id: selectedPlayer.team_id,
          stat_type: 'ejection',
          stat_label: `EJECTION — ${selectedPlayer.name} received 2 technical fouls`,
          stat_points: 0,
          stat_color: 'bg-pink-700 hover:bg-pink-800',
          old_home_score: game.home_score || 0,
          old_away_score: game.away_score || 0,
          logged_by: currentUser?.email || '',
          device_name: getDeviceName()
        });
      } else if (statType.key === 'fouls' && currentValue + 1 >= MAX_FOUL_LIMIT) {
        setEjectedPlayer(selectedPlayer);
        setEjectionReason(`${MAX_FOUL_LIMIT} Fouls`);
        setSelectedPlayer(null);
        await createLogMutation.mutateAsync({
          game_id: game.id,
          player_id: selectedPlayer.id,
          team_id: selectedPlayer.team_id,
          stat_type: 'ejection',
          stat_label: `FOUL OUT — ${selectedPlayer.name} reached ${MAX_FOUL_LIMIT} fouls`,
          stat_points: 0,
          stat_color: 'bg-red-700 hover:bg-red-800',
          old_home_score: game.home_score || 0,
          old_away_score: game.away_score || 0,
          logged_by: currentUser?.email || '',
          device_name: getDeviceName()
        });
      } else if (statType.key === 'unsportsmanlike_fouls' && currentValue + 1 >= 2) {
        setEjectedPlayer(selectedPlayer);
        setEjectionReason('2 Unsportsmanlike Fouls');
        setSelectedPlayer(null);
        await createLogMutation.mutateAsync({
          game_id: game.id,
          player_id: selectedPlayer.id,
          team_id: selectedPlayer.team_id,
          stat_type: 'ejection',
          stat_label: `EJECTION — ${selectedPlayer.name} received 2 unsportsmanlike fouls`,
          stat_points: 0,
          stat_color: 'bg-rose-700 hover:bg-rose-800',
          old_home_score: game.home_score || 0,
          old_away_score: game.away_score || 0,
          logged_by: currentUser?.email || '',
          device_name: getDeviceName()
        });
      }
    } finally {
      isProcessingStatRef.current = false;
    }
  };

  const resetSubDialog = () => {
    setHomePlayersOut([]);
    setAwayPlayersOut([]);
    setHomePlayersIn([]);
    setAwayPlayersIn([]);
    setSubStep('select_out');
  };

  const handleConfirmSubstitution = async () => {
    if (isSubmittingSubRef.current) return;
    isSubmittingSubRef.current = true;

    // Capture selections and close dialog immediately to prevent double-tap
    const capturedHomeOut = [...homePlayersOut];
    const capturedHomeIn = [...homePlayersIn];
    const capturedAwayOut = [...awayPlayersOut];
    const capturedAwayIn = [...awayPlayersIn];
    setShowSubDialog(false);
    resetSubDialog();

    const currentComputedTimeLeft = computeTimeLeft(game);
    // Always fetch fresh stats to avoid stale cache causing > 5 players bug
    const freshStats = await base44.entities.PlayerStats.filter({ game_id: game.id });

    const processTeamSub = async (playersOut, playersIn, teamId) => {
      if (playersOut.length === 0) return;
      const team = teamId === game.home_team_id ? homeTeam : awayTeam;

      for (const playerOut of playersOut) {
        if (game.game_mode === 'timed' && game.clock_running) {
          const clockState = playerGameClockStateRef.current[playerOut.id];
          if (clockState && clockState.period === game.clock_period) {
            const elapsed = clockState.timeLeft - currentComputedTimeLeft;
            playerMinutesRef.current[playerOut.id] = (playerMinutesRef.current[playerOut.id] || 0) + elapsed;
          }
        }
        playerGameClockStateRef.current[playerOut.id] = null;
        const outStat = freshStats.find(s => s.player_id === playerOut.id);
        if (outStat) await updateStatMutation.mutateAsync({ statId: outStat.id, updates: { is_starter: false } });
        if (selectedPlayer?.id === playerOut.id) setSelectedPlayer(null);
      }

      for (const playerInId of playersIn) {
        const inStat = freshStats.find(s => s.player_id === playerInId);
        if (inStat) {
          await updateStatMutation.mutateAsync({ statId: inStat.id, updates: { is_starter: true } });
        } else {
          await createStatMutation.mutateAsync({ game_id: game.id, player_id: playerInId, team_id: teamId, is_starter: true, minutes_played: 0 });
        }
        playerGameClockStateRef.current[playerInId] = { timeLeft: currentComputedTimeLeft, period: game.clock_period };
        if (!playerMinutesRef.current[playerInId]) playerMinutesRef.current[playerInId] = 0;
      }

      const outNames = playersOut.map(p => p.name).join(', ');
      const inNames = playersIn.map(id => players.find(p => p.id === id)?.name || 'Unknown').join(', ');
      const logLabel = `${team?.name}: OUT — ${outNames} | IN — ${inNames}`;
      const logData = JSON.stringify({
        display: logLabel,
        out_ids: playersOut.map(p => p.id),
        in_ids: playersIn,
        team_id: teamId
      });
      await createLogMutation.mutateAsync({
        game_id: game.id,
        player_id: playersOut[0].id,
        team_id: teamId,
        stat_type: 'substitution',
        stat_label: logData,
        stat_points: 0,
        stat_color: teamId === game.home_team_id ? 'bg-blue-600' : 'bg-red-600',
        old_home_score: game.home_score || 0,
        old_away_score: game.away_score || 0,
        logged_by: currentUser?.email || '',
        device_name: getDeviceName()
      });
    };

    await processTeamSub(capturedHomeOut, capturedHomeIn, game.home_team_id);
    await processTeamSub(capturedAwayOut, capturedAwayIn, game.away_team_id);

    // Validate lineup integrity after substitution
    const postSubStats = await base44.entities.PlayerStats.filter({ game_id: game.id });
    checkAndTriggerRepair(postSubStats);

    isSubmittingSubRef.current = false;
  };

  const togglePlayerOut = (player, teamId) => {
    if (teamId === game.home_team_id) {
      setHomePlayersOut(prev =>
        prev.some(p => p.id === player.id) ? prev.filter(p => p.id !== player.id) : [...prev, player]
      );
      // Reset corresponding in selections when out changes
      setHomePlayersIn([]);
    } else {
      setAwayPlayersOut(prev =>
        prev.some(p => p.id === player.id) ? prev.filter(p => p.id !== player.id) : [...prev, player]
      );
      setAwayPlayersIn([]);
    }
  };

  const togglePlayerIn = (playerId, teamId) => {
    if (teamId === game.home_team_id) {
      setHomePlayersIn(prev =>
        prev.includes(playerId)
          ? prev.filter(id => id !== playerId)
          : prev.length < homePlayersOut.length ? [...prev, playerId] : prev
      );
    } else {
      setAwayPlayersIn(prev =>
        prev.includes(playerId)
          ? prev.filter(id => id !== playerId)
          : prev.length < awayPlayersOut.length ? [...prev, playerId] : prev
      );
    }
  };

  const isSubConfirmReady = () => {
    const totalOut = homePlayersOut.length + awayPlayersOut.length;
    if (totalOut === 0) return false;
    if (homePlayersOut.length > 0 && homePlayersIn.length !== homePlayersOut.length) return false;
    if (awayPlayersOut.length > 0 && awayPlayersIn.length !== awayPlayersOut.length) return false;
    return true;
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
    periodEndHandledRef.current = false;
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
  };

  const handleEndGameFromModal = async () => {
    const homeScore = game.home_score || 0;
    const awayScore = game.away_score || 0;
    const homeWins = homeScore > awayScore;

    if (game.game_mode === 'timed' && game.clock_running) {
      activePlayers.forEach(stat => {
        const clockState = playerGameClockStateRef.current[stat.player_id];
        if (clockState && clockState.period === game.clock_period) {
          const currentComputedTimeLeft = computeTimeLeft(game);
          const gameTimeElapsed = clockState.timeLeft - currentComputedTimeLeft;
          playerMinutesRef.current[stat.player_id] = (playerMinutesRef.current[stat.player_id] || 0) + gameTimeElapsed;
        }
      });
    }

    const minuteUpdates = existingStats.map(stat => {
      const totalSeconds = playerMinutesRef.current[stat.player_id] || 0;
      const totalMinutes = Math.round((totalSeconds / 60) * 100) / 100;
      return updateStatMutation.mutateAsync({
        statId: stat.id,
        updates: { minutes_played: totalMinutes }
      });
    });

    await Promise.all(minuteUpdates);

    await updateGameMutation.mutateAsync({
      gameId: game.id,
      data: { status: 'completed', player_of_game: findPlayerOfGame(existingStats, game) }
    });

    await updateTeamRecordMutation.mutateAsync({ teamId: game.home_team_id, isWin: homeWins });
    await updateTeamRecordMutation.mutateAsync({ teamId: game.away_team_id, isWin: !homeWins });

    onBack();
  };

  const handleUndo = async (logEntry) => {
    const updates = { [logEntry.statType.key]: logEntry.oldValue };
    await updateStatMutation.mutateAsync({ statId: logEntry.statId, updates });

    if (logEntry.statType.points > 0) {
      await updateGameMutation.mutateAsync({
        gameId: game.id,
        data: { 
          home_score: logEntry.oldScores.home,
          away_score: logEntry.oldScores.away
        }
      });
    }

    // Decrement team fouls if this stat counted as a team foul
    if (statCountsAsTeamFoul(logEntry.statType.key)) {
      const isHome = logEntry.teamId === game.home_team_id;
      const foulKey = isHome ? 'home_team_fouls' : 'away_team_fouls';
      const period = game.clock_period ?? 1;
      const resetKey = getFoulResetKey(period);
      const currentFoulMap = { ...(game[foulKey] || {}) };
      currentFoulMap[resetKey] = Math.max(0, (currentFoulMap[resetKey] || 0) - 1);
      await updateGameMutation.mutateAsync({ gameId: game.id, data: { [foulKey]: currentFoulMap } });
    }

    await deleteLogMutation.mutateAsync(logEntry.id);
  };

  const getTimeoutSegmentKey = (period) => {
    const totalPeriods = game.period_count || (game.period_type === 'halves' ? 2 : 4);
    if (period > totalPeriods) return 'OVERTIME';
    if (game.period_type === 'halves') return period === 1 ? 'FIRST_HALF' : 'SECOND_HALF';
    return period <= 2 ? 'FIRST_HALF' : 'SECOND_HALF';
  };

  const handleUndoTimeout = async (logEntry) => {
    const isHome = logEntry.teamId === game.home_team_id;
    const timeoutsKey = isHome ? 'home_timeouts' : 'away_timeouts';
    const segmentKey = getTimeoutSegmentKey(game.clock_period ?? 1);
    const currentMap = { ...(game[timeoutsKey] || {}) };
    currentMap[segmentKey] = Math.max(0, (currentMap[segmentKey] || 0) - 1);
    await updateGameMutation.mutateAsync({ gameId: game.id, data: { [timeoutsKey]: currentMap } });
    await deleteLogMutation.mutateAsync(logEntry.id);
  };

  const handleUndoSubstitution = async (logEntry) => {
    if (!logEntry.subData) return;
    const { out_ids, in_ids } = logEntry.subData;
    const freshStats = await base44.entities.PlayerStats.filter({ game_id: game.id });
    // Reverse: players who went OUT come back as starters
    for (const playerId of (out_ids || [])) {
      const stat = freshStats.find(s => s.player_id === playerId);
      if (stat) await updateStatMutation.mutateAsync({ statId: stat.id, updates: { is_starter: true } });
    }
    // Reverse: players who came IN go back to bench
    for (const playerId of (in_ids || [])) {
      const stat = freshStats.find(s => s.player_id === playerId);
      if (stat) await updateStatMutation.mutateAsync({ statId: stat.id, updates: { is_starter: false } });
    }
    await deleteLogMutation.mutateAsync(logEntry.id);

    // Validate lineup integrity after undo substitution
    const postUndoStats = await base44.entities.PlayerStats.filter({ game_id: game.id });
    checkAndTriggerRepair(postUndoStats);
  };

  const handleEndGame = async () => {
    if (!confirm("Are you sure you want to end this game? This cannot be undone.")) {
      return;
    }

    try {
      const homeScore = game.home_score || 0;
      const awayScore = game.away_score || 0;
      const homeWins = homeScore > awayScore;

      if (game.game_mode === 'timed' && game.clock_running) {
        activePlayers.forEach(stat => {
          const clockState = playerGameClockStateRef.current[stat.player_id];
          if (clockState && clockState.period === game.clock_period) {
            const currentComputedTimeLeft = computeTimeLeft(game);
            const gameTimeElapsed = clockState.timeLeft - currentComputedTimeLeft;
            playerMinutesRef.current[stat.player_id] = (playerMinutesRef.current[stat.player_id] || 0) + gameTimeElapsed;
          }
        });
      }

      const minuteUpdates = existingStats.map(stat => {
        const totalSeconds = playerMinutesRef.current[stat.player_id] || 0;
        const totalMinutes = Math.round((totalSeconds / 60) * 100) / 100;
        return updateStatMutation.mutateAsync({
          statId: stat.id,
          updates: { minutes_played: totalMinutes }
        });
      });

      await Promise.all(minuteUpdates);

      await base44.entities.Game.update(game.id, { 
        status: 'completed',
        player_of_game: findPlayerOfGame(existingStats, game)
      });

      const homeTeamData = await base44.entities.Team.get(game.home_team_id);
      await base44.entities.Team.update(game.home_team_id, {
        wins: homeWins ? (homeTeamData.wins || 0) + 1 : homeTeamData.wins || 0,
        losses: !homeWins ? (homeTeamData.losses || 0) + 1 : homeTeamData.losses || 0
      });

      const awayTeamData = await base44.entities.Team.get(game.away_team_id);
      await base44.entities.Team.update(game.away_team_id, {
        wins: !homeWins ? (awayTeamData.wins || 0) + 1 : awayTeamData.wins || 0,
        losses: homeWins ? (awayTeamData.losses || 0) + 1 : awayTeamData.losses || 0
      });

      onBack();
    } catch (error) {
      console.error('Error ending game:', error);
      alert('Failed to end game: ' + error.message);
    }
  };

  const homeActivePlayers = players.filter(p => 
    p.team_id === game.home_team_id && activePlayerIds.includes(p.id)
  );
  const awayActivePlayers = players.filter(p => 
    p.team_id === game.away_team_id && activePlayerIds.includes(p.id)
  );

  const isDisqualified = (playerId) => {
    const stats = existingStats.find(s => s.player_id === playerId);
    if (!stats) return false;
    return (
      (stats.fouls || 0) >= MAX_FOUL_LIMIT ||
      (stats.technical_fouls || 0) >= 2 ||
      (stats.unsportsmanlike_fouls || 0) >= 2
    );
  };

  const isEligibleReplacement = (playerId) => !isDisqualified(playerId);

  const homeBenchPlayers = players.filter(p => 
    p.team_id === game.home_team_id && !activePlayerIds.includes(p.id)
  );
  const awayBenchPlayers = players.filter(p => 
    p.team_id === game.away_team_id && !activePlayerIds.includes(p.id)
  );

  // ── Player Card ──
  // isDesktop=true → show R & A; isDesktop=false (mobile) → show only F & T
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
          className={`w-full rounded-xl border-2 ${isDesktop ? 'p-2 hover:shadow-md' : 'p-1.5'} ${!isDesktop && (isSelected ? 'ring-2 ring-offset-1 hover:bg-slate-100' : 'hover:bg-slate-100')}`}
          style={desktopStyle}
        >
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md bg-slate-600">
              {player.jersey_number}
            </div>
            <p className="font-semibold text-slate-900 text-[10px] truncate leading-tight w-full text-center">{player.name}</p>
            {playerStats && (
              <div className="w-full pt-0.5 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-900 text-center leading-none">{totalPoints} <span className="text-[9px] font-normal text-slate-500">PTS</span></p>
                <div className="flex justify-around mt-0.5">
                  {/* R and A only shown on desktop/tablet */}
                  {isDesktop && (
                    <>
                      <span className="text-[9px] text-slate-500">{(playerStats.offensive_rebounds||0)+(playerStats.defensive_rebounds||0)}R</span>
                      <span className="text-[9px] text-slate-500">{playerStats.assists||0}A</span>
                    </>
                  )}
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

  // ── Team panel ──
  const TeamPanel = ({ team, activePlayers: teamPlayers, borderColor, labelColor, side }) => {
    const isHome = side === 'home';
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
      <div className="backdrop-blur border border-slate-200 rounded-2xl p-2 flex flex-col h-full overflow-hidden" style={borderStyle}>
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md flex-shrink-0"
            style={{ backgroundColor: team?.color || '#64748b' }}
          >
            {team?.name?.[0]}
          </div>
          <h2 className={`text-sm font-bold ${labelColor} truncate`}>{team?.name}</h2>
          <span className="ml-auto text-slate-500 text-xs whitespace-nowrap">{teamPlayers.length}/5</span>
        </div>
        <div className="grid grid-cols-5 gap-1 min-[900px]:grid-cols-1 min-[900px]:flex-1 min-[900px]:min-h-0 min-[900px]:gap-0.5 min-[900px]:content-start">
          {teamPlayers.map((player) => 
            <div key={player.id}>
              {PlayerButton({
                player,
                teamColor: team?.color,
                isDesktop: side !== undefined,
                onSubClick: (p) => {
                  resetSubDialog();
                  if (p.team_id === game.home_team_id) setHomePlayersOut([p]);
                  else setAwayPlayersOut([p]);
                  setSubStep('select_in');
                  setShowSubDialog(true);
                }
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Stat control panel ──
  const StatPanel = ({ large, showSub = true }) => {
    const btnH = large ? 'h-[4.5rem]' : 'h-14';
    return (
      <div className={`bg-gradient-to-r from-indigo-100/50 to-purple-100/50 backdrop-blur border-2 border-indigo-300/50 rounded-2xl flex flex-col ${large && !showSub ? 'p-2' : 'p-3 h-full'}`}>
        <div className={`flex items-center justify-center gap-3 ${large ? 'mb-1.5' : 'mb-3'}`}>
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

        <div className={`grid grid-cols-3 gap-1.5 ${large ? 'mb-1' : 'mb-1.5'}`}>
          <div className="flex rounded-lg overflow-hidden shadow-md">
            <motion.button whileTap={{ scale: selectedPlayer ? 0.92 : 1 }} onClick={() => handleStatClick(STAT_TYPES.find(s => s.key === 'free_throws'))} disabled={!selectedPlayer} className={`flex-1 ${btnH} text-white font-bold text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150`}>FTM</motion.button>
            <div className="w-px bg-indigo-900/30" />
            <motion.button whileTap={{ scale: selectedPlayer ? 0.92 : 1 }} onClick={() => handleStatClick(STAT_TYPES.find(s => s.key === 'free_throws_missed'))} disabled={!selectedPlayer} className={`flex-1 ${btnH} text-white font-bold text-xs bg-indigo-300 hover:bg-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150`}>FTX</motion.button>
          </div>
          {['points_2', 'points_3'].map(key => {
            const stat = STAT_TYPES.find(s => s.key === key);
            return (
              <motion.div key={stat.key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                <Button onClick={() => handleStatClick(stat)} disabled={!selectedPlayer} className={`w-full ${btnH} text-white font-bold text-sm ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md transition-all duration-150`}>{stat.label}</Button>
              </motion.div>
            );
          })}
        </div>

        <div className={`grid grid-cols-3 gap-1.5 ${large ? 'mb-1' : 'mb-1.5'}`}>
          {['offensive_rebounds', 'defensive_rebounds', 'assists'].map(key => {
            const stat = STAT_TYPES.find(s => s.key === key);
            return (
              <motion.div key={stat.key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                <Button onClick={() => handleStatClick(stat)} disabled={!selectedPlayer} className={`w-full ${btnH} text-white font-bold text-sm ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md transition-all duration-150`}>{stat.label}</Button>
              </motion.div>
            );
          })}
        </div>

        <div className={`grid grid-cols-6 gap-1.5 ${large ? 'mb-0' : 'mb-1.5'}`}>
          {['steals', 'blocks', 'turnovers', 'fouls', 'technical_fouls', 'unsportsmanlike_fouls'].map(key => {
            const stat = STAT_TYPES.find(s => s.key === key);
            return (
              <motion.div key={stat.key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                <Button onClick={() => handleStatClick(stat)} disabled={!selectedPlayer} className={`w-full ${btnH} text-white font-bold text-xs ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md transition-all duration-150`}>{stat.label}</Button>
              </motion.div>
            );
          })}
        </div>

        {showSub && (
          <Button
            onClick={() => { resetSubDialog(); setShowSubDialog(true); }}
            className={`w-full ${large ? 'h-12' : 'h-10'} bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-sm shadow-lg mt-auto`}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Make Substitution
          </Button>
        )}
      </div>
    );
  };

  const ActivityLog = ({ compact = false }) => (
    <div className={`flex flex-col overflow-hidden h-full ${compact ? '' : 'bg-white/60 backdrop-blur border border-slate-200 rounded-2xl p-3'}`}>
      <div className={`flex items-center gap-2 flex-shrink-0 ${compact ? 'px-2 py-1 border-b border-slate-200 mb-1' : 'mb-3 pb-3 border-b border-slate-200'}`}>
        <Activity className="w-3.5 h-3.5 text-indigo-500" />
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Game Activity</h3>
        <span className="ml-auto text-xs text-slate-400">{gameLog.length} actions</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {gameLog.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400 text-xs">No actions yet</p>
          </div>
        ) : (
          gameLog.filter(log => log.player || log.isSubstitution || log.statType.key === 'ejection' || log.statType.key === 'substitution' || log.statType.key === 'timeout').slice(0, 30).map((log, index) => (
            <div key={log.id} className={`flex items-center gap-2 px-2 py-1.5 border-b border-slate-100 last:border-0 ${index === 0 ? 'bg-amber-50/60' : 'hover:bg-slate-50/50'}`}>
              {log.isSubstitution ? (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <RefreshCw className="w-3 h-3 text-cyan-500 flex-shrink-0" />
                  <span className="text-[10px] font-bold text-cyan-600 flex-shrink-0">SUB</span>
                  <span className="text-[10px] text-slate-600 truncate">{log.statType.label}</span>
                </div>
              ) : log.statType.key === 'timeout' ? (
                <>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-amber-600 flex-shrink-0">T/O</span>
                    <span className="text-[10px] text-slate-600 truncate">{log.statType.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{format(log.timestamp, 'HH:mm:ss')}</span>
                  <Button size="sm" variant="ghost" onClick={() => handleUndoTimeout(log)} className="h-5 w-5 p-0 hover:bg-red-100 text-slate-300 hover:text-red-500 flex-shrink-0">
                    <Undo2 className="w-2.5 h-2.5" />
                  </Button>
                </>
              ) : log.statType.key === 'ejection' ? (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
                  <span className="text-[10px] font-bold text-red-600 truncate">{log.statType.label}</span>
                </div>
              ) : (
                <>
                  <p className="font-semibold text-xs truncate w-[30%] flex-shrink-0" style={{ color: log.player?.team_id === game.home_team_id ? '#3b82f6' : log.player?.team_id === game.away_team_id ? '#ef4444' : '#1e293b' }}>{log.player?.name ?? '—'}</p>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white font-bold flex-shrink-0 ${log.statType.color}`}>{log.statType.label}</span>
                    {log.statType.points > 0 && <span className="text-[10px] text-green-600 font-bold flex-shrink-0">+{log.statType.points}pts</span>}
                  </div>
                </>
              )}
              <span className="text-[10px] text-slate-400 flex-shrink-0">{format(log.timestamp, 'HH:mm:ss')}</span>
              {log.isSubstitution && log.subData ? (
                <Button size="sm" variant="ghost" onClick={() => handleUndoSubstitution(log)} className="h-5 w-5 p-0 hover:bg-red-100 text-slate-300 hover:text-red-500 flex-shrink-0">
                  <Undo2 className="w-2.5 h-2.5" />
                </Button>
              ) : !log.isSubstitution && log.statId && log.statType.key !== 'ejection' && log.statType.key !== 'timeout' ? (
                <Button size="sm" variant="ghost" onClick={() => handleUndo(log)} className="h-5 w-5 p-0 hover:bg-red-100 text-slate-300 hover:text-red-500 flex-shrink-0">
                  <Undo2 className="w-2.5 h-2.5" />
                </Button>
              ) : null}
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
        <ScoreHeader game={game} homeTeam={homeTeam} awayTeam={awayTeam} onGameUpdate={onGameUpdate} onEndGame={handleEndGameFromModal} lineupBlocked={!!repairMode} />
        <div className="mt-3 space-y-3">
          {/* Mobile uses side=undefined so isDesktop=false → no R/A */}
          {TeamPanel({ team: homeTeam, activePlayers: homeActivePlayers, borderColor: "border-l-blue-300", labelColor: "text-blue-600" })}
          <div className="bg-gradient-to-r from-indigo-100/50 to-purple-100/50 backdrop-blur border-2 border-indigo-300/50 rounded-2xl p-3">
            <div className="flex items-center justify-center gap-3 mb-3">
              {selectedPlayer ? (
                <>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0" style={{ backgroundColor: selectedPlayer.team_id === game.home_team_id ? homeTeam?.color : awayTeam?.color }}>
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
            <div className="grid grid-cols-3 gap-1.5 mb-1.5">
              {['offensive_rebounds', 'defensive_rebounds', 'assists'].map(key => { const stat = STAT_TYPES.find(s => s.key === key); return (
                <motion.div key={stat.key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                  <Button onClick={() => handleStatClick(stat)} disabled={!selectedPlayer} className={`w-full h-10 text-white font-bold text-sm ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md`}>{stat.label}</Button>
                </motion.div>
              ); })}
            </div>
            <div className="grid grid-cols-6 gap-1.5 mb-1.5">
              {['steals', 'blocks', 'turnovers', 'fouls', 'technical_fouls', 'unsportsmanlike_fouls'].map(key => { const stat = STAT_TYPES.find(s => s.key === key); return (
                <motion.div key={stat.key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                  <Button onClick={() => handleStatClick(stat)} disabled={!selectedPlayer} className={`w-full h-10 text-white font-bold text-xs ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md`}>{stat.label}</Button>
                </motion.div>
              ); })}
            </div>
            <Button onClick={() => { resetSubDialog(); setShowSubDialog(true); }} className="w-full h-10 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-sm shadow-lg">
              <RefreshCw className="w-4 h-4 mr-2" />Make Substitution
            </Button>
          </div>
          {TeamPanel({ team: awayTeam, activePlayers: awayActivePlayers, borderColor: "border-l-red-300", labelColor: "text-red-600" })}
          <div className="bg-white/60 backdrop-blur border border-slate-200 rounded-2xl p-3" style={{ minHeight: '200px' }}>
            {ActivityLog({ compact: false })}
          </div>
        </div>
      </div>

      {/* ── LARGE SCREEN LAYOUT (≥ 900px) ── */}
      <div className="hidden min-[900px]:flex flex-col h-screen overflow-hidden px-4 py-3">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <Button variant="ghost" onClick={() => setShowExitDialog(true)} className="text-slate-600 hover:bg-slate-200/50 h-11 px-5">
            <ArrowLeft className="w-5 h-5 mr-2" />Exit
          </Button>
          <Button onClick={handleEndGame} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 h-11 px-5 text-white">
            <Trophy className="w-5 h-5 mr-2" />End Game
          </Button>
        </div>

        <div className="flex-shrink-0 mb-2">
          <ScoreHeader game={game} homeTeam={homeTeam} awayTeam={awayTeam} onGameUpdate={onGameUpdate} onEndGame={handleEndGameFromModal} lineupBlocked={!!repairMode} />
        </div>

        <div className="flex gap-3 flex-1 min-h-0">
          <div className="w-[25%] flex-shrink-0 min-h-0">
            {TeamPanel({ team: homeTeam, activePlayers: homeActivePlayers, borderColor: "border-l-blue-300", labelColor: "text-blue-600", side: "home" })}
          </div>

          <div className="w-[50%] flex-shrink-0 flex flex-col min-h-0">
            {/* Stat buttons — shrink-wrap to content */}
            <div className="flex-shrink-0">
              {StatPanel({ large: true, showSub: false })}
            </div>
            {/* Substitution strip — compact, attached to stat buttons */}
            <div className="flex-shrink-0 mt-1.5 mb-2">
              <Button
                onClick={() => { if (repairMode || isInFinalReview) return; resetSubDialog(); setShowSubDialog(true); }}
                disabled={!!repairMode || isInFinalReview}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-sm shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ height: '36px' }}
                title={isInFinalReview ? 'Substitutions are locked during final review' : undefined}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {isInFinalReview ? 'Substitutions Locked (Review Mode)' : 'Make Substitution'}
              </Button>
            </div>
            {/* Activity log — all remaining space */}
            <div className="flex-1 min-h-0 bg-white/50 backdrop-blur border border-slate-200 rounded-xl overflow-hidden">
              {ActivityLog({ compact: true })}
            </div>
          </div>

          <div className="w-[25%] flex-shrink-0 min-h-0">
            {TeamPanel({ team: awayTeam, activePlayers: awayActivePlayers, borderColor: "border-l-red-300", labelColor: "text-red-600", side: "away" })}
          </div>
        </div>
      </div>

      {/* Emergency Lineup Repair Modal */}
      {repairMode && (
        <EmergencyLineupRepair
          repairData={repairMode}
          existingStats={existingStats}
          players={players}
          game={game}
          lastValidLineups={lastValidLineupsRef.current}
          onComplete={async () => {
            setRepairMode(null);
            const freshStats = await base44.entities.PlayerStats.filter({ game_id: game.id });
            updateValidSnapshots(freshStats);
            queryClient.invalidateQueries({ queryKey: ['playerStats', game.id] });
          }}
        />
      )}

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
            <Button variant="outline" className="flex-1 border-slate-300 hover:bg-slate-100" onClick={() => setShowExitDialog(false)}>No, stay</Button>
            <Button className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white" onClick={() => { setShowExitDialog(false); onBack(); }}>Yes, exit</Button>
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
            {ejectedPlayer && <p className="text-slate-700 text-base font-semibold">#{ejectedPlayer.jersey_number} {ejectedPlayer.name}</p>}
            <p className="text-slate-500 text-sm mt-2">
              This player has received <span className="font-bold text-red-600">{ejectionReason}</span> and must leave the game. A substitution is required.
            </p>
          </div>
          <Button
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white mt-2"
            onClick={() => {
              if (ejectedPlayer) {
                resetSubDialog();
                if (ejectedPlayer.team_id === game.home_team_id) setHomePlayersOut([ejectedPlayer]);
                else setAwayPlayersOut([ejectedPlayer]);
                setSubStep('select_in');
                setShowSubDialog(true);
              }
              setEjectedPlayer(null);
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />Proceed to Substitution
          </Button>
        </DialogContent>
      </Dialog>

      {/* Substitution Dialog */}
      <Dialog open={showSubDialog} onOpenChange={(open) => {
        if (!open) resetSubDialog();
        setShowSubDialog(open);
      }}>
        <DialogContent className="bg-white text-slate-900 border-slate-200 w-[95vw] max-w-xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
            <DialogTitle className="text-xl text-slate-900 font-bold">
              {subStep === 'select_out' ? 'Select Players to Take Out' : 'Select Replacement Players'}
            </DialogTitle>
            {subStep === 'select_out' ? (
              <div className="flex items-center gap-4 mt-1.5">
                {homePlayersOut.length > 0 && (
                  <span className="text-sm font-semibold text-blue-600">Home: {homePlayersOut.length} out</span>
                )}
                {awayPlayersOut.length > 0 && (
                  <span className="text-sm font-semibold text-red-600">Away: {awayPlayersOut.length} out</span>
                )}
                {homePlayersOut.length === 0 && awayPlayersOut.length === 0 && (
                  <span className="text-sm text-slate-400">Tap on-court players from either or both teams</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4 mt-1.5">
                {homePlayersOut.length > 0 && (
                  <span className={`text-sm font-semibold ${homePlayersIn.length === homePlayersOut.length ? 'text-green-600' : 'text-blue-600'}`}>
                    Home: {homePlayersIn.length}/{homePlayersOut.length}
                  </span>
                )}
                {awayPlayersOut.length > 0 && (
                  <span className={`text-sm font-semibold ${awayPlayersIn.length === awayPlayersOut.length ? 'text-green-600' : 'text-red-600'}`}>
                    Away: {awayPlayersIn.length}/{awayPlayersOut.length}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {subStep === 'select_out' ? (
              <>
                {/* HOME team — blue accent */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs text-white font-bold bg-blue-600">{homeTeam?.name?.[0]}</div>
                    <span className="font-bold text-blue-700 text-sm">{homeTeam?.name}</span>
                    <span className="ml-auto text-xs text-blue-500 font-semibold">{homePlayersOut.length} selected</span>
                  </div>
                  <div className="space-y-1.5">
                    {homeActivePlayers.map(player => {
                      const isSelected = homePlayersOut.some(p => p.id === player.id);
                      return (
                        <button key={player.id} onClick={() => togglePlayerOut(player, game.home_team_id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
                            ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-blue-600">{player.jersey_number}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 text-sm">{player.name}</p>
                            <p className="text-xs text-slate-500">{player.position}</p>
                          </div>
                          {isSelected && <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">✓</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* AWAY team — red accent */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs text-white font-bold bg-red-600">{awayTeam?.name?.[0]}</div>
                    <span className="font-bold text-red-700 text-sm">{awayTeam?.name}</span>
                    <span className="ml-auto text-xs text-red-500 font-semibold">{awayPlayersOut.length} selected</span>
                  </div>
                  <div className="space-y-1.5">
                    {awayActivePlayers.map(player => {
                      const isSelected = awayPlayersOut.some(p => p.id === player.id);
                      return (
                        <button key={player.id} onClick={() => togglePlayerOut(player, game.away_team_id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
                            ${isSelected ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/40'}`}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-red-600">{player.jersey_number}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 text-sm">{player.name}</p>
                            <p className="text-xs text-slate-500">{player.position}</p>
                          </div>
                          {isSelected && <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">✓</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* HOME replacements */}
                {homePlayersOut.length > 0 && (
                  <div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-2">
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1.5">Home — Coming Out</p>
                      <div className="flex flex-wrap gap-1.5">
                        {homePlayersOut.map(p => (
                          <div key={p.id} className="flex items-center gap-1 bg-white border border-blue-200 rounded-lg px-2 py-0.5">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-xs bg-blue-600">{p.jersey_number}</div>
                            <span className="text-xs font-semibold text-slate-800">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs font-bold text-blue-700 mb-1.5 px-1">Select {homePlayersOut.length} Home replacement{homePlayersOut.length > 1 ? 's' : ''} ({homePlayersIn.length}/{homePlayersOut.length})</p>
                    {homeBenchPlayers.filter(p => isEligibleReplacement(p.id)).length === 0 ? (
                      <p className="text-center text-red-500 py-3 text-xs font-semibold">No eligible home bench players.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {homeBenchPlayers.map(player => {
                          if (!isEligibleReplacement(player.id)) return null;
                          const isSelected = homePlayersIn.includes(player.id);
                          const limitReached = !isSelected && homePlayersIn.length >= homePlayersOut.length;
                          const pStats = existingStats.find(s => s.player_id === player.id);
                          return (
                            <button key={player.id} disabled={limitReached}
                              onClick={() => togglePlayerIn(player.id, game.home_team_id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
                                ${limitReached ? 'opacity-40 cursor-not-allowed border-slate-200 bg-white' :
                                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}>
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-blue-600">{player.jersey_number}</div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-900 text-sm">{player.name}</p>
                                <p className="text-xs text-slate-500">{player.position}{pStats ? ` · ${pStats.fouls||0}F · ${pStats.technical_fouls||0}T` : ''}</p>
                              </div>
                              {isSelected && <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">✓</div>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* AWAY replacements */}
                {awayPlayersOut.length > 0 && (
                  <div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-2">
                      <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-1.5">Away — Coming Out</p>
                      <div className="flex flex-wrap gap-1.5">
                        {awayPlayersOut.map(p => (
                          <div key={p.id} className="flex items-center gap-1 bg-white border border-red-200 rounded-lg px-2 py-0.5">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-xs bg-red-600">{p.jersey_number}</div>
                            <span className="text-xs font-semibold text-slate-800">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs font-bold text-red-700 mb-1.5 px-1">Select {awayPlayersOut.length} Away replacement{awayPlayersOut.length > 1 ? 's' : ''} ({awayPlayersIn.length}/{awayPlayersOut.length})</p>
                    {awayBenchPlayers.filter(p => isEligibleReplacement(p.id)).length === 0 ? (
                      <p className="text-center text-red-500 py-3 text-xs font-semibold">No eligible away bench players.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {awayBenchPlayers.map(player => {
                          if (!isEligibleReplacement(player.id)) return null;
                          const isSelected = awayPlayersIn.includes(player.id);
                          const limitReached = !isSelected && awayPlayersIn.length >= awayPlayersOut.length;
                          const pStats = existingStats.find(s => s.player_id === player.id);
                          return (
                            <button key={player.id} disabled={limitReached}
                              onClick={() => togglePlayerIn(player.id, game.away_team_id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
                                ${limitReached ? 'opacity-40 cursor-not-allowed border-slate-200 bg-white' :
                                  isSelected ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/40'}`}>
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-red-600">{player.jersey_number}</div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-900 text-sm">{player.name}</p>
                                <p className="text-xs text-slate-500">{player.position}{pStats ? ` · ${pStats.fouls||0}F · ${pStats.technical_fouls||0}T` : ''}</p>
                              </div>
                              {isSelected && <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">✓</div>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sticky footer */}
          <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex-shrink-0">
            {subStep === 'select_out' ? (
              <Button
                className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-base shadow"
                disabled={homePlayersOut.length === 0 && awayPlayersOut.length === 0}
                onClick={() => setSubStep('select_in')}
              >
                Next: Select Replacements ({homePlayersOut.length + awayPlayersOut.length} out)
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-12 border-slate-300"
                  onClick={() => { setSubStep('select_out'); setHomePlayersIn([]); setAwayPlayersIn([]); }}>
                  Back
                </Button>
                <Button
                  className="flex-1 h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold"
                  disabled={!isSubConfirmReady()}
                  onClick={handleConfirmSubstitution}
                >
                  Confirm Substitution
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
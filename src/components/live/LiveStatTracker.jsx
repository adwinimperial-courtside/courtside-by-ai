import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Trophy, RefreshCw, Undo2, Activity, AlertTriangle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";

import ScoreHeader from "./ScoreHeader";
import EndOfPeriodModal from "./EndOfPeriodModal";
import EmergencyLineupRepair from "./EmergencyLineupRepair";
import { findPlayerOfGame } from "../utils/pogCalculator";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAT_TYPES = [
  { key: 'points_2',              label: '2PT',  points: 2, color: 'bg-blue-600 hover:bg-blue-700' },
  { key: 'points_3',              label: '3PT',  points: 3, color: 'bg-purple-600 hover:bg-purple-700' },
  { key: 'free_throws',           label: 'FTM',  points: 1, color: 'bg-indigo-600 hover:bg-indigo-700' },
  { key: 'free_throws_missed',    label: 'FTX',  points: 0, color: 'bg-indigo-300 hover:bg-indigo-400' },
  { key: 'offensive_rebounds',    label: 'OREB', points: 0, color: 'bg-emerald-500 hover:bg-emerald-600' },
  { key: 'defensive_rebounds',    label: 'DREB', points: 0, color: 'bg-green-600 hover:bg-green-700' },
  { key: 'assists',               label: 'AST',  points: 0, color: 'bg-amber-500 hover:bg-amber-600' },
  { key: 'steals',                label: 'STL',  points: 0, color: 'bg-orange-600 hover:bg-orange-700' },
  { key: 'blocks',                label: 'BLK',  points: 0, color: 'bg-red-600 hover:bg-red-700' },
  { key: 'turnovers',             label: 'TO',   points: 0, color: 'bg-slate-700 hover:bg-slate-800' },
  { key: 'fouls',                 label: 'FOUL', points: 0, color: 'bg-slate-600 hover:bg-slate-700' },
  { key: 'technical_fouls',       label: 'TECH', points: 0, color: 'bg-pink-600 hover:bg-pink-700' },
  { key: 'unsportsmanlike_fouls', label: 'UNSP', points: 0, color: 'bg-rose-700 hover:bg-rose-800' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getDeviceName = () => {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua))                         return 'iPhone';
  if (/iPad/.test(ua))                            return 'iPad';
  if (/Android/.test(ua) && /Mobile/.test(ua))   return 'Android Phone';
  if (/Android/.test(ua))                         return 'Android Tablet';
  if (/Mac/.test(ua))                             return 'MacBook Pro M5';
  if (/Windows/.test(ua))                         return 'Windows PC';
  if (/Linux/.test(ua))                           return 'Linux';
  return 'Unknown Device';
};

const computeTimeLeft = (game) => {
  const stored = game?.clock_time_left ?? ((game?.period_minutes || 10) * 60);
  if (!game?.clock_running || !game?.clock_started_at) return Math.max(0, stored);
  const elapsed = (Date.now() - new Date(game.clock_started_at).getTime()) / 1000;
  return Math.max(0, stored - elapsed);
};

const calcTeamScore = (teamId, stats) =>
  (stats || []).reduce((acc, s) =>
    s.team_id === teamId
      ? acc + (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0)
      : acc,
  0);

const getFoulResetKey = (period, game) => {
  const total = game?.period_count || (game?.period_type === 'halves' ? 2 : 4);
  if (period > total) return String(period);
  if (game?.period_type === 'halves') return period === 1 ? 'h1' : 'h2';
  return String(period);
};

const getTimeoutSegmentKey = (period, game) => {
  const total = game?.period_count || (game?.period_type === 'halves' ? 2 : 4);
  if (period > total) return 'OVERTIME';
  if (game?.period_type === 'halves') return period === 1 ? 'FIRST_HALF' : 'SECOND_HALF';
  return period <= 2 ? 'FIRST_HALF' : 'SECOND_HALF';
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiveStatTracker({
  // New prop spec
  gameId: propGameId,
  leagueId: propLeagueId,
  onEndOfPeriod,
  onEmergencyRepair,
  // Backward-compat props from LiveGame.jsx
  game: propGame,
  homeTeam,
  awayTeam,
  players: propPlayers,
  existingStats: initialStats,
  onBack,
  onGameUpdate,
}) {
  const gameId   = propGameId  || propGame?.id;
  const leagueId = propLeagueId || propGame?.league_id;

  const queryClient = useQueryClient();

  // ─── State ────────────────────────────────────────────────────────────────
  const [selectedPlayer,      setSelectedPlayer]      = useState(null);
  const [showSubDialog,       setShowSubDialog]       = useState(false);
  const [homePlayersOut,      setHomePlayersOut]      = useState([]);
  const [awayPlayersOut,      setAwayPlayersOut]      = useState([]);
  const [homePlayersIn,       setHomePlayersIn]       = useState([]);
  const [awayPlayersIn,       setAwayPlayersIn]       = useState([]);
  const [subStep,             setSubStep]             = useState('select_out');
  const [ejectedPlayer,       setEjectedPlayer]       = useState(null);
  const [ejectionReason,      setEjectionReason]      = useState('');
  const [showExitDialog,      setShowExitDialog]      = useState(false);
  const [showEndOfPeriod,     setShowEndOfPeriod]     = useState(false);
  const [repairMode,          setRepairMode]          = useState(null);
  const [currentUser,         setCurrentUser]         = useState(null);
  const [statError,           setStatError]           = useState(null);

  const lastValidLineupsRef   = useRef({});
  const isSubmittingSubRef    = useRef(false);
  const isProcessingStatRef   = useRef(false);
  const lastStatClickTimeRef  = useRef(0);
  const playerMinutesRef      = useRef({});
  const playerClockStateRef   = useRef({});
  const periodEndHandledRef   = useRef(false);

  // ─── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data: { user } }) => setCurrentUser(user))
      .catch(() => {});
  }, []);

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const { data: liveGame = propGame } = useQuery({
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
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const game = liveGame;

  const { data: existingStats = initialStats || [] } = useQuery({
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
    initialData: initialStats,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: gameLogs = [] } = useQuery({
    queryKey: ['game_logs', gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('game_logs')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!gameId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: fetchedPlayers = [] } = useQuery({
    queryKey: ['players', game?.home_team_id, game?.away_team_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .in('team_id', [game.home_team_id, game.away_team_id]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!game?.home_team_id && !!game?.away_team_id,
    staleTime: 60000,
  });

  const players = propPlayers?.length > 0 ? propPlayers : fetchedPlayers;

  // ─── Realtime Subscriptions ───────────────────────────────────────────────
  // A unique id is generated inside the effect (not a ref) so every invocation
  // — including React StrictMode's second mount — gets genuinely fresh channel
  // names. This avoids the async-removal race where removeChannel() hasn't
  // finished when the second mount calls supabase.channel(same-name) and gets
  // the old LEAVING object back, causing .on() to register no listener.
  useEffect(() => {
    if (!gameId) return;

    const id = Math.random().toString(36).slice(2, 8);

    const statsChannel = supabase
      .channel(`live-stats-${gameId}-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_stats', filter: `game_id=eq.${gameId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['player_stats', gameId] });
        }
      )
      .subscribe();

    const logsChannel = supabase
      .channel(`live-logs-${gameId}-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_logs', filter: `game_id=eq.${gameId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['game_logs', gameId] });
        }
      )
      .subscribe();

    const gameChannel = supabase
      .channel(`live-game-${gameId}-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          if (payload.new) {
            queryClient.setQueryData(['game', gameId], payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      statsChannel.unsubscribe();
      logsChannel.unsubscribe();
      gameChannel.unsubscribe();
      supabase.removeChannel(statsChannel);
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(gameChannel);
    };
  }, [gameId, queryClient]);

  // ─── Derived State ────────────────────────────────────────────────────────

  const activePlayers     = existingStats.filter(s => s.is_starter);
  const activePlayerIds   = activePlayers.map(s => s.player_id);

  const homeActiveCount = existingStats.filter(s => s.team_id === game?.home_team_id && s.is_starter).length;
  const awayActiveCount = existingStats.filter(s => s.team_id === game?.away_team_id && s.is_starter).length;

  const totalPeriods  = game?.period_count || (game?.period_type === 'halves' ? 2 : 4);
  const currentPeriod = game?.clock_period ?? 1;
  const isInFinalReview = (
    (game?.clock_time_left === 0 || game?.clock_time_left == null) &&
    !game?.clock_running &&
    (currentPeriod === totalPeriods || currentPeriod > totalPeriods) &&
    game?.period_status === 'completed'
  );

  const getGameRules = () => ({
    foul_limit: 5,
    technicalFoulLimit: 2,
    unsportsmanlikeFoulLimit: 1,  // eject on first UNSP per spec
    countPersonalFoulsAsTeamFoul: true,
    countPlayerTechnicalAsTeamFoul: true,
    countUnsportsmanlikeAsTeamFoul: true,
    ...(game?.game_rules || {}),
  });

  const statCountsAsTeamFoul = (key) => {
    const r = getGameRules();
    if (key === 'fouls')                  return r.countPersonalFoulsAsTeamFoul;
    if (key === 'technical_fouls')        return r.countPlayerTechnicalAsTeamFoul;
    if (key === 'unsportsmanlike_fouls')  return r.countUnsportsmanlikeAsTeamFoul;
    return false;
  };

  const getFoulLimits = () => {
    const r = getGameRules();
    return {
      personalFoulLimit:         r.foul_limit           ?? 5,
      technicalFoulLimit:        r.technicalFoulLimit    ?? 2,
      unsportsmanlikeFoulLimit:  r.unsportsmanlikeFoulLimit ?? 1,
    };
  };

  const isPlayerEligible = (playerId, stats) => {
    const limits = getFoulLimits();
    const s = (stats || existingStats).find(st => st.player_id === playerId);
    if (!s) return true;
    return (
      (s.fouls                 || 0) < limits.personalFoulLimit &&
      (s.technical_fouls       || 0) < limits.technicalFoulLimit &&
      (s.unsportsmanlike_fouls || 0) < limits.unsportsmanlikeFoulLimit
    );
  };

  const isDisqualified = (playerId) => !isPlayerEligible(playerId, existingStats);

  // ─── Lineup snapshot + repair ─────────────────────────────────────────────

  const updateValidSnapshots = (freshStats) => {
    const teamIds = [game?.home_team_id, game?.away_team_id].filter(Boolean);
    for (const teamId of teamIds) {
      const activeIds = new Set(freshStats.filter(s => s.team_id === teamId && s.is_starter).map(s => s.player_id));
      const activePls = players.filter(p => activeIds.has(p.id));
      const benchPls  = players.filter(p => p.team_id === teamId && !activeIds.has(p.id));
      const eligibleBench = benchPls.filter(p => isPlayerEligible(p.id, freshStats));
      const isValid = activePls.length === 5 || (activePls.length < 5 && eligibleBench.length === 0);
      if (isValid) {
        lastValidLineupsRef.current[teamId] = {
          playerIds: [...activeIds],
          timestamp: new Date().toISOString(),
          period: game?.clock_period ?? 1,
          clockTime: game?.clock_time_left ?? 0,
        };
      }
    }
  };

  const checkAndTriggerRepair = (freshStats) => {
    const teamIds = [game?.home_team_id, game?.away_team_id].filter(Boolean);
    const teamsNeedingRepair = [];
    for (const teamId of teamIds) {
      const activeIds  = new Set(freshStats.filter(s => s.team_id === teamId && s.is_starter).map(s => s.player_id));
      const activePls  = players.filter(p => activeIds.has(p.id));
      const benchPls   = players.filter(p => p.team_id === teamId && !activeIds.has(p.id));
      const eligible   = benchPls.filter(p => isPlayerEligible(p.id, freshStats));
      const isValid    = activePls.length === 5 || (activePls.length < 5 && eligible.length === 0);
      if (!isValid) {
        const teamObj = teamId === game?.home_team_id ? homeTeam : awayTeam;
        teamsNeedingRepair.push({
          teamId,
          teamName: teamObj?.name || (teamId === game?.home_team_id ? 'Home' : 'Away'),
          team: teamObj,
          activePlayers: activePls,
        });
      } else {
        lastValidLineupsRef.current[teamId] = {
          playerIds: [...activeIds],
          timestamp: new Date().toISOString(),
          period: game?.clock_period ?? 1,
          clockTime: game?.clock_time_left ?? 0,
        };
      }
    }
    if (teamsNeedingRepair.length > 0) setRepairMode({ teams: teamsNeedingRepair });
    return teamsNeedingRepair.length === 0;
  };

  useEffect(() => {
    if (existingStats.length === 0) return;
    if (isSubmittingSubRef.current) return;
    checkAndTriggerRepair(existingStats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeActiveCount, awayActiveCount]);

  // ─── Minutes tracking ─────────────────────────────────────────────────────

  useEffect(() => {
    activePlayers.forEach(stat => {
      if (!playerMinutesRef.current[stat.player_id]) {
        playerMinutesRef.current[stat.player_id] = stat.minutes_played ? stat.minutes_played * 60 : 0;
      }
      if (!playerClockStateRef.current[stat.player_id] ||
          playerClockStateRef.current[stat.player_id].period !== game?.clock_period) {
        playerClockStateRef.current[stat.player_id] = {
          timeLeft: computeTimeLeft(game),
          period: game?.clock_period,
        };
      }
    });
    if (existingStats.length > 0) updateValidSnapshots(existingStats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlayers.length, game?.clock_time_left, game?.clock_period, game?.clock_running]);

  useEffect(() => {
    if (game?.game_mode !== 'timed' || !game?.clock_running || activePlayers.length === 0) return;
    const interval = setInterval(async () => {
      const now = computeTimeLeft(game);
      const updates = [];
      activePlayers.forEach(stat => {
        const cs = playerClockStateRef.current[stat.player_id];
        if (cs && cs.period === game.clock_period) {
          const elapsed = cs.timeLeft - now;
          if (elapsed > 0) {
            playerMinutesRef.current[stat.player_id] = (playerMinutesRef.current[stat.player_id] || 0) + elapsed;
            const totalSec = playerMinutesRef.current[stat.player_id] || 0;
            const totalMin = Math.round((totalSec / 60) * 100) / 100;
            updates.push(
              supabase.from('player_stats').update({ minutes_played: totalMin }).eq('id', stat.id)
            );
            playerClockStateRef.current[stat.player_id].timeLeft = now;
          }
        }
      });
      if (updates.length > 0) await Promise.all(updates).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.clock_running, game?.clock_started_at, game?.clock_period]);

  // ─── Stat Click ───────────────────────────────────────────────────────────

  const handleStatClick = async (statType) => {
    const now = Date.now();
    if (isProcessingStatRef.current || now - lastStatClickTimeRef.current < 300) return;
    if (!selectedPlayer) return;

    const playerStat = existingStats.find(s => s.player_id === selectedPlayer.id);
    if (!playerStat) return;

    lastStatClickTimeRef.current = now;
    isProcessingStatRef.current  = true;
    setStatError(null);

    const oldValue     = playerStat[statType.key] || 0;
    const newValue     = oldValue + 1;
    const currentHomeScore = calcTeamScore(game.home_team_id, existingStats);
    const currentAwayScore = calcTeamScore(game.away_team_id, existingStats);

    // 1 — Optimistic update (instant feedback)
    const previousStats = queryClient.getQueryData(['player_stats', gameId]);
    queryClient.setQueryData(['player_stats', gameId], prev =>
      (prev || []).map(s =>
        s.id === playerStat.id ? { ...s, [statType.key]: newValue } : s
      )
    );

    try {
      // 2 — Atomic server increment
      const { data: updatedStat, error: updateError } = await supabase
        .from('player_stats')
        .update({ [statType.key]: newValue })
        .eq('id', playerStat.id)
        .select()
        .single();
      if (updateError) throw updateError;

      // 3 — Team foul tracking
      const gameUpdates = {};
      if (statCountsAsTeamFoul(statType.key)) {
        const isHome   = selectedPlayer.team_id === game.home_team_id;
        const foulKey  = isHome ? 'home_team_fouls' : 'away_team_fouls';
        const resetKey = getFoulResetKey(currentPeriod, game);
        const current  = { ...(game[foulKey] || {}) };
        current[resetKey] = (current[resetKey] || 0) + 1;
        gameUpdates[foulKey] = current;
      }

      // 4 — Score update
      if (statType.points > 0) {
        const isHome = selectedPlayer.team_id === game.home_team_id;
        gameUpdates[isHome ? 'home_score' : 'away_score'] =
          (isHome ? currentHomeScore : currentAwayScore) + statType.points;
      }

      if (Object.keys(gameUpdates).length > 0) {
        const { error: gameError } = await supabase
          .from('games')
          .update(gameUpdates)
          .eq('id', gameId);
        if (gameError) throw gameError;
        queryClient.setQueryData(['game', gameId], prev => prev ? { ...prev, ...gameUpdates } : prev);
        onGameUpdate?.();
      }

      // 5 — Audit log (permanent — never deleted)
      const clockTime = computeTimeLeft(game);
      await supabase.from('game_logs').insert({
        game_id:         gameId,
        league_id:       leagueId,
        player_id:       selectedPlayer.id,
        team_id:         selectedPlayer.team_id,
        player_stat_id:  playerStat.id,
        stat_type:       statType.key,
        stat_label:      statType.label,
        stat_points:     statType.points,
        stat_color:      statType.color,
        old_value:       oldValue,
        new_value:       newValue,
        old_home_score:  currentHomeScore,
        old_away_score:  currentAwayScore,
        clock_time:      Math.round(clockTime),
        period:          currentPeriod,
        logged_by:       currentUser?.email || '',
        device_name:     getDeviceName(),
      });

      // 6 — Ejection check
      const rules = getGameRules();
      let ejectionLog = null;

      if (statType.key === 'fouls' && newValue >= (rules.foul_limit ?? 5)) {
        ejectionLog = {
          reason: `${rules.foul_limit ?? 5} Personal Fouls`,
          label:  `FOUL OUT — ${selectedPlayer.name} has ${newValue} fouls`,
          color:  'bg-red-700',
        };
      } else if (statType.key === 'technical_fouls' && newValue >= (rules.technicalFoulLimit ?? 2)) {
        ejectionLog = {
          reason: `${newValue} Technical Foul${newValue > 1 ? 's' : ''}`,
          label:  `EJECTION — ${selectedPlayer.name} received ${newValue} technical fouls`,
          color:  'bg-pink-700',
        };
      } else if (statType.key === 'unsportsmanlike_fouls' && newValue >= (rules.unsportsmanlikeFoulLimit ?? 1)) {
        ejectionLog = {
          reason: 'Unsportsmanlike Foul',
          label:  `EJECTION — ${selectedPlayer.name} received an unsportsmanlike foul`,
          color:  'bg-rose-700',
        };
      }

      if (ejectionLog) {
        // Mark is_starter = false server-side (player_stats has no is_active column)
        await supabase
          .from('player_stats')
          .update({ is_starter: false })
          .eq('id', playerStat.id);

        // Ejection audit log
        await supabase.from('game_logs').insert({
          game_id:        gameId,
          league_id:      leagueId,
          player_id:      selectedPlayer.id,
          team_id:        selectedPlayer.team_id,
          stat_type:      'ejection',
          stat_label:     ejectionLog.label,
          stat_points:    0,
          stat_color:     ejectionLog.color,
          old_home_score: currentHomeScore,
          old_away_score: currentAwayScore,
          clock_time:     Math.round(clockTime),
          period:         currentPeriod,
          logged_by:      currentUser?.email || '',
          device_name:    getDeviceName(),
        });

        setEjectedPlayer(selectedPlayer);
        setEjectionReason(ejectionLog.reason);
        setSelectedPlayer(null);
      }

      queryClient.invalidateQueries({ queryKey: ['player_stats', gameId] });
      queryClient.invalidateQueries({ queryKey: ['game_logs',    gameId] });

    } catch (err) {
      // Rollback optimistic update
      queryClient.setQueryData(['player_stats', gameId], previousStats);
      setStatError('Failed to record stat. Please try again.');
      console.error('[LiveStatTracker:handleStatClick]', err);
    } finally {
      isProcessingStatRef.current = false;
    }
  };

  // ─── Undo (marks log undone, restores old_value) ──────────────────────────

  const handleUndo = async (log) => {
    const previousStats = queryClient.getQueryData(['player_stats', gameId]);
    const previousLogs  = queryClient.getQueryData(['game_logs',    gameId]);

    // Optimistic: hide log + restore stat in cache
    queryClient.setQueryData(['game_logs', gameId], prev =>
      (prev || []).map(l => l.id === log.id ? { ...l, undone: true } : l)
    );
    queryClient.setQueryData(['player_stats', gameId], prev =>
      (prev || []).map(s =>
        s.id === log.player_stat_id ? { ...s, [log.stat_type]: log.old_value } : s
      )
    );

    try {
      // Mark log undone (never deleted — permanent audit trail)
      const { error: logError } = await supabase
        .from('game_logs')
        .update({ undone: true })
        .eq('id', log.id);
      if (logError) throw logError;

      // Restore stat to old_value (atomic restore to known-good value)
      const { error: statError } = await supabase
        .from('player_stats')
        .update({ [log.stat_type]: log.old_value })
        .eq('id', log.player_stat_id);
      if (statError) throw statError;

      // Reverse score if scoring play
      const gameUpdates = {};
      const statDef = STAT_TYPES.find(s => s.key === log.stat_type);
      if (statDef?.points > 0) {
        const freshHomeScore = calcTeamScore(game.home_team_id, existingStats);
        const freshAwayScore = calcTeamScore(game.away_team_id, existingStats);
        const isHome = log.team_id === game.home_team_id;
        gameUpdates[isHome ? 'home_score' : 'away_score'] = Math.max(
          0,
          (isHome ? freshHomeScore : freshAwayScore) - statDef.points
        );
      }

      // Reverse team foul if applicable
      if (statCountsAsTeamFoul(log.stat_type)) {
        const isHome   = log.team_id === game.home_team_id;
        const foulKey  = isHome ? 'home_team_fouls' : 'away_team_fouls';
        const resetKey = getFoulResetKey(currentPeriod, game);
        const current  = { ...(game[foulKey] || {}) };
        current[resetKey] = Math.max(0, (current[resetKey] || 0) - 1);
        gameUpdates[foulKey] = current;
      }

      if (Object.keys(gameUpdates).length > 0) {
        await supabase.from('games').update(gameUpdates).eq('id', gameId);
        queryClient.setQueryData(['game', gameId], prev => prev ? { ...prev, ...gameUpdates } : prev);
        onGameUpdate?.();
      }

      queryClient.invalidateQueries({ queryKey: ['player_stats', gameId] });
      queryClient.invalidateQueries({ queryKey: ['game_logs',    gameId] });

    } catch (err) {
      queryClient.setQueryData(['player_stats', gameId], previousStats);
      queryClient.setQueryData(['game_logs',    gameId], previousLogs);
      console.error('[LiveStatTracker:handleUndo]', err);
    }
  };

  const handleUndoTimeout = async (log) => {
    try {
      const { error: logError } = await supabase
        .from('game_logs')
        .update({ undone: true })
        .eq('id', log.id);
      if (logError) throw logError;

      const isHome      = log.team_id === game.home_team_id;
      const timeoutsKey = isHome ? 'home_timeouts' : 'away_timeouts';
      const segKey      = getTimeoutSegmentKey(currentPeriod, game);
      const map         = { ...(game[timeoutsKey] || {}) };
      map[segKey]       = Math.max(0, (map[segKey] || 0) - 1);

      await supabase.from('games').update({ [timeoutsKey]: map }).eq('id', gameId);
      queryClient.setQueryData(['game', gameId], prev => prev ? { ...prev, [timeoutsKey]: map } : prev);
      queryClient.invalidateQueries({ queryKey: ['game_logs', gameId] });
      onGameUpdate?.();
    } catch (err) {
      console.error('[LiveStatTracker:handleUndoTimeout]', err);
    }
  };

  const handleUndoSubstitution = async (log) => {
    if (!log.sub_data && !log.stat_label) return;
    let subData;
    try {
      subData = JSON.parse(log.stat_label);
    } catch {
      return;
    }
    const { out_ids = [], in_ids = [] } = subData;

    try {
      // Mark log undone
      await supabase.from('game_logs').update({ undone: true }).eq('id', log.id);

      const { data: freshStats, error: fetchErr } = await supabase
        .from('player_stats')
        .select('*')
        .eq('game_id', gameId);
      if (fetchErr) throw fetchErr;

      // Reverse: players who went OUT come back ON
      const reversals = [
        ...out_ids.map(pid => {
          const s = freshStats.find(st => st.player_id === pid);
          return s ? supabase.from('player_stats').update({ is_starter: true }).eq('id', s.id) : null;
        }),
        // Reverse: players who came IN go back to bench
        ...in_ids.map(pid => {
          const s = freshStats.find(st => st.player_id === pid);
          return s ? supabase.from('player_stats').update({ is_starter: false }).eq('id', s.id) : null;
        }),
      ].filter(Boolean);

      await Promise.all(reversals);

      const { data: postStats } = await supabase.from('player_stats').select('*').eq('game_id', gameId);
      queryClient.setQueryData(['player_stats', gameId], postStats || []);
      queryClient.invalidateQueries({ queryKey: ['game_logs', gameId] });

      if (postStats) checkAndTriggerRepair(postStats);
    } catch (err) {
      console.error('[LiveStatTracker:handleUndoSubstitution]', err);
    }
  };

  // ─── Substitution ─────────────────────────────────────────────────────────

  const resetSubDialog = () => {
    setHomePlayersOut([]);
    setAwayPlayersOut([]);
    setHomePlayersIn([]);
    setAwayPlayersIn([]);
    setSubStep('select_out');
  };

  const togglePlayerOut = (player, teamId) => {
    if (teamId === game.home_team_id) {
      setHomePlayersOut(prev =>
        prev.some(p => p.id === player.id) ? prev.filter(p => p.id !== player.id) : [...prev, player]
      );
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

  const handleConfirmSubstitution = async () => {
    if (isSubmittingSubRef.current) return;
    isSubmittingSubRef.current = true;

    const capturedHomeOut = [...homePlayersOut];
    const capturedHomeIn  = [...homePlayersIn];
    const capturedAwayOut = [...awayPlayersOut];
    const capturedAwayIn  = [...awayPlayersIn];

    setShowSubDialog(false);
    resetSubDialog();

    // ── Optimistic update ──────────────────────────────────────────────────────
    // Flip is_starter / is_active in the cache immediately so player cards
    // update without waiting for every sequential DB write to complete.
    // Incoming players that don't yet have a stat row (first-time bench sub)
    // can't be optimistically created here; they'll appear once invalidateQueries
    // triggers a refetch after the server insert.
    const outIds = new Set([
      ...capturedHomeOut.map(p => p.id),
      ...capturedAwayOut.map(p => p.id),
    ]);
    const inIds = new Set([...capturedHomeIn, ...capturedAwayIn]);

    const snapshotBeforeSub = queryClient.getQueryData(['player_stats', gameId]);
    queryClient.setQueryData(['player_stats', gameId], prev =>
      (prev || []).map(s => {
        if (outIds.has(s.player_id)) return { ...s, is_starter: false, is_active: false };
        if (inIds.has(s.player_id))  return { ...s, is_starter: true,  is_active: true  };
        return s;
      })
    );

    const currentTimeLeft = computeTimeLeft(game);

    try {
      // Always fetch fresh stats to avoid > 5 players bug
      const { data: freshStats, error: fetchErr } = await supabase
        .from('player_stats')
        .select('*')
        .eq('game_id', gameId);
      if (fetchErr) throw fetchErr;

      const processTeamSub = async (playersOut, playersIn, teamId) => {
        if (playersOut.length === 0) return;
        const team = teamId === game.home_team_id ? homeTeam : awayTeam;

        for (const playerOut of playersOut) {
          // Accrue minutes if clock is running
          if (game.game_mode === 'timed' && game.clock_running) {
            const cs = playerClockStateRef.current[playerOut.id];
            if (cs && cs.period === game.clock_period) {
              playerMinutesRef.current[playerOut.id] =
                (playerMinutesRef.current[playerOut.id] || 0) + (cs.timeLeft - currentTimeLeft);
            }
          }
          playerClockStateRef.current[playerOut.id] = null;

          const outStat = freshStats.find(s => s.player_id === playerOut.id);
          if (outStat) {
            const totalMin = Math.round(((playerMinutesRef.current[playerOut.id] || 0) / 60) * 100) / 100;
            await supabase
              .from('player_stats')
              .update({ is_starter: false, minutes_played: totalMin })
              .eq('id', outStat.id);
          }
          if (selectedPlayer?.id === playerOut.id) setSelectedPlayer(null);
        }

        for (const playerInId of playersIn) {
          const inStat = freshStats.find(s => s.player_id === playerInId);
          if (inStat) {
            await supabase
              .from('player_stats')
              .update({ is_starter: true })
              .eq('id', inStat.id);
          } else {
            await supabase.from('player_stats').insert({
              game_id:    gameId,
              league_id:  leagueId,
              player_id:  playerInId,
              team_id:    teamId,
              is_starter: true,
              minutes_played: 0,
            });
          }
          playerClockStateRef.current[playerInId] = { timeLeft: currentTimeLeft, period: game.clock_period };
          if (!playerMinutesRef.current[playerInId]) playerMinutesRef.current[playerInId] = 0;
        }

        const outNames = playersOut.map(p => p.name).join(', ');
        const inNames  = playersIn.map(id => players.find(p => p.id === id)?.name || 'Unknown').join(', ');
        const logLabel = `${team?.name}: OUT — ${outNames} | IN — ${inNames}`;
        const logData  = JSON.stringify({ display: logLabel, out_ids: playersOut.map(p => p.id), in_ids: playersIn, team_id: teamId });

        const currentHomeScore = calcTeamScore(game.home_team_id, existingStats);
        const currentAwayScore = calcTeamScore(game.away_team_id, existingStats);

        await supabase.from('game_logs').insert({
          game_id:        gameId,
          league_id:      leagueId,
          player_id:      playersOut[0].id,
          team_id:        teamId,
          stat_type:      'substitution',
          stat_label:     logData,
          stat_points:    0,
          stat_color:     teamId === game.home_team_id ? 'bg-blue-600' : 'bg-red-600',
          old_home_score: currentHomeScore,
          old_away_score: currentAwayScore,
          clock_time:     Math.round(currentTimeLeft),
          period:         currentPeriod,
          logged_by:      currentUser?.email || '',
          device_name:    getDeviceName(),
        });
      };

      await processTeamSub(capturedHomeOut, capturedHomeIn, game.home_team_id);
      await processTeamSub(capturedAwayOut, capturedAwayIn, game.away_team_id);

      // Validate integrity after sub
      const { data: postStats } = await supabase.from('player_stats').select('*').eq('game_id', gameId);
      queryClient.setQueryData(['player_stats', gameId], postStats || []);
      queryClient.invalidateQueries({ queryKey: ['player_stats', gameId] });
      queryClient.invalidateQueries({ queryKey: ['game_logs', gameId] });

      if (postStats) checkAndTriggerRepair(postStats);

    } catch (err) {
      if (snapshotBeforeSub !== undefined) {
        queryClient.setQueryData(['player_stats', gameId], snapshotBeforeSub);
      }
      console.error('[LiveStatTracker:handleConfirmSubstitution]', err);
    } finally {
      isSubmittingSubRef.current = false;
    }
  };

  // ─── End Game ─────────────────────────────────────────────────────────────

  const finalizeMinutes = async () => {
    if (game?.game_mode === 'timed' && game?.clock_running) {
      activePlayers.forEach(stat => {
        const cs = playerClockStateRef.current[stat.player_id];
        if (cs && cs.period === game.clock_period) {
          const elapsed = cs.timeLeft - computeTimeLeft(game);
          playerMinutesRef.current[stat.player_id] = (playerMinutesRef.current[stat.player_id] || 0) + elapsed;
        }
      });
    }
    await Promise.all(
      existingStats.map(stat => {
        const totalMin = Math.round(((playerMinutesRef.current[stat.player_id] || 0) / 60) * 100) / 100;
        return supabase.from('player_stats').update({ minutes_played: totalMin }).eq('id', stat.id);
      })
    );
  };

  const handleEndGameFromModal = async () => {
    await finalizeMinutes();

    const homeScore = calcTeamScore(game.home_team_id, existingStats);
    const awayScore = calcTeamScore(game.away_team_id, existingStats);
    const homeWins  = homeScore > awayScore;

    const { error: gameErr } = await supabase
      .from('games')
      .update({
        status:         'completed',
        player_of_game: findPlayerOfGame(existingStats, game),
        home_score:     homeScore,
        away_score:     awayScore,
      })
      .eq('id', gameId);
    if (gameErr) { console.error('[handleEndGameFromModal]', gameErr); return; }

    // Update team win/loss records
    const [homeTeamRow] = await supabase.from('teams').select('wins,losses').eq('id', game.home_team_id).single().then(r => [r.data]);
    const [awayTeamRow] = await supabase.from('teams').select('wins,losses').eq('id', game.away_team_id).single().then(r => [r.data]);

    await Promise.all([
      homeTeamRow && supabase.from('teams').update({
        wins:   homeWins ? (homeTeamRow.wins || 0) + 1 : (homeTeamRow.wins || 0),
        losses: !homeWins ? (homeTeamRow.losses || 0) + 1 : (homeTeamRow.losses || 0),
      }).eq('id', game.home_team_id),
      awayTeamRow && supabase.from('teams').update({
        wins:   !homeWins ? (awayTeamRow.wins || 0) + 1 : (awayTeamRow.wins || 0),
        losses: homeWins  ? (awayTeamRow.losses || 0) + 1 : (awayTeamRow.losses || 0),
      }).eq('id', game.away_team_id),
    ].filter(Boolean));

    onBack?.();
  };

  const handleEndGame = async () => {
    if (!window.confirm('Are you sure you want to end this game? This cannot be undone.')) return;
    try {
      await handleEndGameFromModal();
    } catch (err) {
      console.error('[handleEndGame]', err);
      window.alert('Failed to end game: ' + err.message);
    }
  };

  // ─── Derived player lists ──────────────────────────────────────────────────

  const homeActivePlayers = players
    .filter(p => p.team_id === game?.home_team_id && activePlayerIds.includes(p.id))
    .sort((a, b) => (a.jersey_number || 0) - (b.jersey_number || 0));

  const awayActivePlayers = players
    .filter(p => p.team_id === game?.away_team_id && activePlayerIds.includes(p.id))
    .sort((a, b) => (a.jersey_number || 0) - (b.jersey_number || 0));

  const homeBenchPlayers = players.filter(
    p => p.team_id === game?.home_team_id && !activePlayerIds.includes(p.id)
  );
  const awayBenchPlayers = players.filter(
    p => p.team_id === game?.away_team_id && !activePlayerIds.includes(p.id)
  );

  // Activity feed: most-recent-first, hide undone entries
  const visibleLogs = gameLogs.filter(l => !l.undone);

  // ─── Sub-components ───────────────────────────────────────────────────────

  const PlayerButton = ({ player, teamColor, onSubClick, isDesktop }) => {
    const pStats     = existingStats.find(s => s.player_id === player.id);
    const totalPts   = ((pStats?.points_2 || 0) * 2) + ((pStats?.points_3 || 0) * 3) + (pStats?.free_throws || 0);
    const isSelected = selectedPlayer?.id === player.id;

    const style = isDesktop
      ? isSelected
        ? { backgroundColor: `${teamColor}0E`, borderColor: teamColor, borderWidth: '3px', boxShadow: `0 4px 12px ${teamColor}30`, transition: 'all 0.15s ease' }
        : pStats?.fouls >= 4
          ? { backgroundColor: '#fff7ed', borderColor: '#d1d5db', borderWidth: '1px', boxShadow: '0 2px 6px rgba(0,0,0,0.10)', transition: 'all 0.15s ease' }
          : { borderColor: '#d1d5db', borderWidth: '1px', boxShadow: '0 2px 6px rgba(0,0,0,0.10)', transition: 'all 0.15s ease' }
      : isSelected
        ? { backgroundColor: `${teamColor}18`, borderColor: teamColor, boxShadow: `0 0 0 2px ${teamColor}30` }
        : pStats?.fouls >= 4
          ? { backgroundColor: '#fff7ed', borderColor: '#e2e8f0' }
          : { borderColor: '#e2e8f0' };

    return (
      <div className="relative">
        <motion.button
          whileTap={{ scale: isDesktop ? 0.98 : 0.92 }}
          onClick={() => setSelectedPlayer(player)}
          className={`w-full rounded-xl border-2 ${isDesktop ? 'p-2 hover:shadow-md' : 'p-1.5'} ${!isDesktop && (isSelected ? 'ring-2 ring-offset-1 hover:bg-slate-100' : 'hover:bg-slate-100')}`}
          style={style}
        >
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md bg-slate-600">
              {player.jersey_number}
            </div>
            <p className="font-semibold text-slate-900 text-[10px] truncate leading-tight w-full text-center">{player.name}</p>
            {pStats && (
              <div className="w-full pt-0.5 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-900 text-center leading-none">
                  {totalPts} <span className="text-[9px] font-normal text-slate-500">PTS</span>
                </p>
                <div className="flex justify-around mt-0.5">
                  {isDesktop && (
                    <>
                      <span className="text-[9px] text-slate-500">{(pStats.offensive_rebounds||0)+(pStats.defensive_rebounds||0)}R</span>
                      <span className="text-[9px] text-slate-500">{pStats.assists||0}A</span>
                    </>
                  )}
                  <span className={`text-[9px] font-semibold ${(pStats.fouls||0) >= 4 ? 'text-red-600' : 'text-slate-500'}`}>{pStats.fouls||0}F</span>
                  <span className="text-[9px] text-slate-500">{pStats.technical_fouls||0}T</span>
                </div>
              </div>
            )}
          </div>
        </motion.button>
        <button
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full p-0 shadow-lg flex items-center justify-center transition-colors bg-slate-200 hover:bg-slate-300"
          onClick={(e) => { e.stopPropagation(); onSubClick(player); }}
        >
          <RefreshCw className="w-2.5 h-2.5 text-slate-600" />
        </button>
      </div>
    );
  };

  const TeamPanel = ({ team, activePlayers: teamPlayers, side }) => {
    const isHome     = side === 'home';
    const accentColor = isHome ? '#3b82f6' : '#ef4444';
    const bgTint     = isHome ? '#3b82f610' : '#ef444410';
    const isSelectedTeam = selectedPlayer && selectedPlayer.team_id === (isHome ? game?.home_team_id : game?.away_team_id);
    const borderWidth = isSelectedTeam ? '4px' : '3px';
    const borderStyle = side === undefined ? {} : isHome
      ? { borderRight: `${borderWidth} solid ${accentColor}`, backgroundColor: bgTint }
      : { borderLeft:  `${borderWidth} solid ${accentColor}`, backgroundColor: bgTint };
    const labelColor = isHome ? 'text-blue-600' : 'text-red-600';

    return (
      <div className="backdrop-blur border border-slate-200 rounded-2xl p-2 flex flex-col h-full overflow-hidden" style={borderStyle}>
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md flex-shrink-0"
            style={{ backgroundColor: team?.color || '#64748b' }}>
            {team?.name?.[0]}
          </div>
          <h2 className={`text-sm font-bold ${labelColor} truncate`}>{team?.name}</h2>
          <span className="ml-auto text-slate-500 text-xs whitespace-nowrap">{teamPlayers.length}/5</span>
        </div>
        <div className="grid grid-cols-5 gap-1 min-[900px]:grid-cols-1 min-[900px]:flex-1 min-[900px]:min-h-0 min-[900px]:gap-0.5 min-[900px]:content-start">
          {teamPlayers.map(player => (
            <div key={player.id}>
              <PlayerButton
                player={player}
                teamColor={team?.color}
                isDesktop={side !== undefined}
                onSubClick={(p) => {
                  resetSubDialog();
                  if (p.team_id === game?.home_team_id) setHomePlayersOut([p]);
                  else setAwayPlayersOut([p]);
                  setSubStep('select_in');
                  setShowSubDialog(true);
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const StatButtons = ({ large, showSub = true }) => {
    const btnH = large ? 'h-[4.5rem]' : 'h-14';
    return (
      <div className={`bg-gradient-to-r from-indigo-100/50 to-purple-100/50 backdrop-blur border-2 border-indigo-300/50 rounded-2xl flex flex-col ${large && !showSub ? 'p-2' : 'p-3 h-full'}`}>
        {/* Selected player header */}
        <div className={`flex items-center justify-center gap-3 ${large ? 'mb-1.5' : 'mb-3'}`}>
          {selectedPlayer ? (
            <>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0"
                style={{ backgroundColor: selectedPlayer.team_id === game?.home_team_id ? homeTeam?.color : awayTeam?.color }}>
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

        {statError && (
          <p className="text-red-500 text-xs text-center mb-1.5 bg-red-50 rounded-lg px-2 py-1">{statError}</p>
        )}

        {/* Row 1: FTM / FTX / 2PT / 3PT */}
        <div className={`grid grid-cols-3 gap-1.5 ${large ? 'mb-1' : 'mb-1.5'}`}>
          <div className="flex rounded-lg overflow-hidden shadow-md">
            <motion.button whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}
              onClick={() => handleStatClick(STAT_TYPES.find(s => s.key === 'free_throws'))}
              disabled={!selectedPlayer}
              className={`flex-1 ${btnH} text-white font-bold text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150`}>
              FTM
            </motion.button>
            <div className="w-px bg-indigo-900/30" />
            <motion.button whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}
              onClick={() => handleStatClick(STAT_TYPES.find(s => s.key === 'free_throws_missed'))}
              disabled={!selectedPlayer}
              className={`flex-1 ${btnH} text-white font-bold text-xs bg-indigo-300 hover:bg-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150`}>
              FTX
            </motion.button>
          </div>
          {['points_2', 'points_3'].map(key => {
            const stat = STAT_TYPES.find(s => s.key === key);
            return (
              <motion.div key={key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                <Button onClick={() => handleStatClick(stat)} disabled={!selectedPlayer}
                  className={`w-full ${btnH} text-white font-bold text-sm ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md transition-all duration-150`}>
                  {stat.label}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Row 2: OREB / DREB / AST */}
        <div className={`grid grid-cols-3 gap-1.5 ${large ? 'mb-1' : 'mb-1.5'}`}>
          {['offensive_rebounds', 'defensive_rebounds', 'assists'].map(key => {
            const stat = STAT_TYPES.find(s => s.key === key);
            return (
              <motion.div key={key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                <Button onClick={() => handleStatClick(stat)} disabled={!selectedPlayer}
                  className={`w-full ${btnH} text-white font-bold text-sm ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md transition-all duration-150`}>
                  {stat.label}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Row 3: STL / BLK / TO / FOUL / TECH / UNSP */}
        <div className={`grid grid-cols-6 gap-1.5 ${large ? 'mb-0' : 'mb-1.5'}`}>
          {['steals', 'blocks', 'turnovers', 'fouls', 'technical_fouls', 'unsportsmanlike_fouls'].map(key => {
            const stat = STAT_TYPES.find(s => s.key === key);
            return (
              <motion.div key={key} whileTap={{ scale: selectedPlayer ? 0.92 : 1 }}>
                <Button onClick={() => handleStatClick(stat)} disabled={!selectedPlayer}
                  className={`w-full ${btnH} text-white font-bold text-xs ${stat.color} disabled:opacity-30 disabled:cursor-not-allowed shadow-md transition-all duration-150`}>
                  {stat.label}
                </Button>
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
        <span className="ml-auto text-xs text-slate-400">{visibleLogs.length} actions</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {visibleLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400 text-xs">No actions yet</p>
          </div>
        ) : (
          visibleLogs.slice(0, 50).map((log, index) => {
            const player     = players.find(p => p.id === log.player_id);
            const isSub      = log.stat_type === 'substitution';
            const isTimeout  = log.stat_type === 'timeout';
            const isEjection = log.stat_type === 'ejection';
            let displayLabel = log.stat_label;
            let subData      = null;
            if (isSub) {
              try { const parsed = JSON.parse(log.stat_label); displayLabel = parsed.display || log.stat_label; subData = parsed; }
              catch { /* keep raw */ }
            }
            const clockLabel = log.clock_time != null
              ? `${Math.floor(log.clock_time / 60)}:${String(log.clock_time % 60).padStart(2, '0')}`
              : log.created_at ? format(new Date(log.created_at), 'HH:mm:ss') : '';

            return (
              <div key={log.id} className={`flex items-center gap-2 px-2 py-1.5 border-b border-slate-100 last:border-0 ${index === 0 ? 'bg-amber-50/60' : 'hover:bg-slate-50/50'}`}>
                {isSub ? (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <RefreshCw className="w-3 h-3 text-cyan-500 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-cyan-600 flex-shrink-0">SUB</span>
                    <span className="text-[10px] text-slate-600 truncate">{displayLabel}</span>
                  </div>
                ) : isTimeout ? (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-amber-600 flex-shrink-0">T/O</span>
                    <span className="text-[10px] text-slate-600 truncate">{log.stat_label}</span>
                  </div>
                ) : isEjection ? (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-red-600 truncate">{displayLabel}</span>
                  </div>
                ) : (
                  <>
                    <p className="font-semibold text-xs truncate w-[30%] flex-shrink-0"
                      style={{ color: player?.team_id === game?.home_team_id ? '#3b82f6' : player?.team_id === game?.away_team_id ? '#ef4444' : '#1e293b' }}>
                      {player?.name ?? '—'}
                    </p>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white font-bold flex-shrink-0 ${log.stat_color}`}>{log.stat_label}</span>
                      {(log.stat_points || 0) > 0 && <span className="text-[10px] text-green-600 font-bold flex-shrink-0">+{log.stat_points}pts</span>}
                    </div>
                  </>
                )}
                <span className="text-[10px] text-slate-400 flex-shrink-0">{clockLabel}</span>

                {/* Undo button — only for the most-recent non-undone action of that type */}
                {isSub && subData ? (
                  <Button size="sm" variant="ghost" onClick={() => handleUndoSubstitution(log)}
                    className="h-5 w-5 p-0 hover:bg-red-100 text-slate-300 hover:text-red-500 flex-shrink-0">
                    <Undo2 className="w-2.5 h-2.5" />
                  </Button>
                ) : isTimeout ? (
                  <Button size="sm" variant="ghost" onClick={() => handleUndoTimeout(log)}
                    className="h-5 w-5 p-0 hover:bg-red-100 text-slate-300 hover:text-red-500 flex-shrink-0">
                    <Undo2 className="w-2.5 h-2.5" />
                  </Button>
                ) : !isEjection && log.player_stat_id ? (
                  <Button size="sm" variant="ghost" onClick={() => handleUndo(log)}
                    className="h-5 w-5 p-0 hover:bg-red-100 text-slate-300 hover:text-red-500 flex-shrink-0">
                    <Undo2 className="w-2.5 h-2.5" />
                  </Button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 min-[900px]:h-screen min-[900px]:overflow-hidden">

      {/* ── MOBILE LAYOUT (< 900px) ── */}
      <div className="min-[900px]:hidden max-w-[1400px] mx-auto px-3 py-3 pb-10">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" onClick={() => setShowExitDialog(true)}
            className="text-slate-600 hover:bg-slate-200/50 h-10 px-3 text-sm">
            <ArrowLeft className="w-4 h-4 mr-1" />Exit
          </Button>
          <Button onClick={handleEndGame}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 h-10 px-3 text-sm text-white">
            <Trophy className="w-4 h-4 mr-1" />End Game
          </Button>
        </div>

        <ScoreHeader
          game={game}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          onGameUpdate={onGameUpdate}
          onEndGame={handleEndGameFromModal}
          lineupBlocked={!!repairMode}
          playerStats={existingStats}
        />

        <div className="mt-3 space-y-3">
          <TeamPanel team={homeTeam} activePlayers={homeActivePlayers} />
          <StatButtons large={false} showSub />
          <TeamPanel team={awayTeam} activePlayers={awayActivePlayers} />
          <div className="bg-white/60 backdrop-blur border border-slate-200 rounded-2xl p-3" style={{ minHeight: '200px' }}>
            <ActivityLog compact={false} />
          </div>
        </div>
      </div>

      {/* ── LARGE SCREEN LAYOUT (≥ 900px) ── */}
      <div className="hidden min-[900px]:flex flex-col h-screen overflow-hidden px-4 py-3">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <Button variant="ghost" onClick={() => setShowExitDialog(true)}
            className="text-slate-600 hover:bg-slate-200/50 h-11 px-5">
            <ArrowLeft className="w-5 h-5 mr-2" />Exit
          </Button>
          <Button onClick={handleEndGame}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 h-11 px-5 text-white">
            <Trophy className="w-5 h-5 mr-2" />End Game
          </Button>
        </div>

        <div className="flex-shrink-0 mb-2">
          <ScoreHeader
            game={game}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            onGameUpdate={onGameUpdate}
            onEndGame={handleEndGameFromModal}
            lineupBlocked={!!repairMode}
            playerStats={existingStats}
          />
        </div>

        <div className="flex gap-3 flex-1 min-h-0">
          <div className="w-[25%] flex-shrink-0 min-h-0">
            <TeamPanel team={homeTeam} activePlayers={homeActivePlayers} side="home" />
          </div>

          <div className="w-[50%] flex-shrink-0 flex flex-col min-h-0">
            <div className="flex-shrink-0">
              <StatButtons large={true} showSub={false} />
            </div>
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
            <div className="flex-1 min-h-0 bg-white/50 backdrop-blur border border-slate-200 rounded-xl overflow-hidden">
              <ActivityLog compact={true} />
            </div>
          </div>

          <div className="w-[25%] flex-shrink-0 min-h-0">
            <TeamPanel team={awayTeam} activePlayers={awayActivePlayers} side="away" />
          </div>
        </div>
      </div>

      {/* ── Emergency Lineup Repair ── */}
      {repairMode && (
        <EmergencyLineupRepair
          repairData={repairMode}
          existingStats={existingStats}
          players={players}
          game={game}
          lastValidLineups={lastValidLineupsRef.current}
          onComplete={async () => {
            setRepairMode(null);
            const { data: freshStats } = await supabase
              .from('player_stats')
              .select('*')
              .eq('game_id', gameId);
            if (freshStats) {
              queryClient.setQueryData(['player_stats', gameId], freshStats);
              updateValidSnapshots(freshStats);
            }
            onEmergencyRepair?.();
          }}
        />
      )}

      {/* ── EndOfPeriodModal ── */}
      <EndOfPeriodModal
        open={showEndOfPeriod}
        game={game}
        periodType={game?.period_type || 'quarters'}
        totalPeriods={totalPeriods}
        onStartNextPeriod={async () => {
          setShowEndOfPeriod(false);
          const nextPeriod = currentPeriod + 1;
          const nextIsOT   = nextPeriod > totalPeriods;
          const nextMins   = nextIsOT ? (game?.overtime_minutes || 5) : (game?.period_minutes || 10);
          await supabase.from('games').update({
            clock_period:    nextPeriod,
            clock_time_left: nextMins * 60,
            clock_running:   false,
            clock_started_at: null,
            period_status:   'active',
          }).eq('id', gameId);
          queryClient.invalidateQueries({ queryKey: ['game', gameId] });
          onEndOfPeriod?.();
        }}
        onStartOvertime={async () => {
          setShowEndOfPeriod(false);
          const otPeriod = totalPeriods + 1;
          const otMins   = game?.overtime_minutes || 5;
          await supabase.from('games').update({
            clock_period:    otPeriod,
            clock_time_left: otMins * 60,
            clock_running:   false,
            clock_started_at: null,
            period_status:   'active',
          }).eq('id', gameId);
          queryClient.invalidateQueries({ queryKey: ['game', gameId] });
          onEndOfPeriod?.();
        }}
        onEndGame={handleEndGameFromModal}
        onCancel={() => setShowEndOfPeriod(false)}
      />

      {/* ── Exit Confirmation ── */}
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
              Click <span className="font-bold text-green-600">End Game</span> if the game is finished. Otherwise you can exit — the game will stay <span className="font-bold text-indigo-600">LIVE</span>.
            </p>
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1 border-slate-300 hover:bg-slate-100" onClick={() => setShowExitDialog(false)}>
              No, stay
            </Button>
            <Button className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              onClick={() => { setShowExitDialog(false); onBack?.(); }}>
              Yes, exit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Ejection Alert ── */}
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
              Ejected for <span className="font-bold text-red-600">{ejectionReason}</span>. A substitution is required.
            </p>
          </div>
          <Button
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white mt-2"
            onClick={() => {
              if (ejectedPlayer) {
                resetSubDialog();
                if (ejectedPlayer.team_id === game?.home_team_id) setHomePlayersOut([ejectedPlayer]);
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

      {/* ── Substitution Dialog ── */}
      <Dialog open={showSubDialog} onOpenChange={(open) => { if (!open) resetSubDialog(); setShowSubDialog(open); }}>
        <DialogContent className="bg-white text-slate-900 border-slate-200 w-[95vw] max-w-xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
            <DialogTitle className="text-xl text-slate-900 font-bold">
              {subStep === 'select_out' ? 'Select Players to Take Out' : 'Select Replacement Players'}
            </DialogTitle>
            {subStep === 'select_out' ? (
              <div className="flex items-center gap-4 mt-1.5">
                {homePlayersOut.length > 0 && <span className="text-sm font-semibold text-blue-600">Home: {homePlayersOut.length} out</span>}
                {awayPlayersOut.length > 0 && <span className="text-sm font-semibold text-red-600">Away: {awayPlayersOut.length} out</span>}
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

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {subStep === 'select_out' ? (
              <>
                {/* HOME on-court */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs text-white font-bold bg-blue-600">{homeTeam?.name?.[0]}</div>
                    <span className="font-bold text-blue-700 text-sm">{homeTeam?.name}</span>
                    <span className="ml-auto text-xs text-blue-500 font-semibold">{homePlayersOut.length} selected</span>
                  </div>
                  <div className="space-y-1.5">
                    {homeActivePlayers.map(player => {
                      const sel = homePlayersOut.some(p => p.id === player.id);
                      return (
                        <button key={player.id} onClick={() => togglePlayerOut(player, game.home_team_id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${sel ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-blue-600">{player.jersey_number}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 text-sm">{player.name}</p>
                            <p className="text-xs text-slate-500">{player.position}</p>
                          </div>
                          {sel && <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">✓</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* AWAY on-court */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs text-white font-bold bg-red-600">{awayTeam?.name?.[0]}</div>
                    <span className="font-bold text-red-700 text-sm">{awayTeam?.name}</span>
                    <span className="ml-auto text-xs text-red-500 font-semibold">{awayPlayersOut.length} selected</span>
                  </div>
                  <div className="space-y-1.5">
                    {awayActivePlayers.map(player => {
                      const sel = awayPlayersOut.some(p => p.id === player.id);
                      return (
                        <button key={player.id} onClick={() => togglePlayerOut(player, game.away_team_id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${sel ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/40'}`}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-red-600">{player.jersey_number}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 text-sm">{player.name}</p>
                            <p className="text-xs text-slate-500">{player.position}</p>
                          </div>
                          {sel && <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">✓</div>}
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
                    <p className="text-xs font-bold text-blue-700 mb-1.5 px-1">
                      Select {homePlayersOut.length} Home replacement{homePlayersOut.length > 1 ? 's' : ''} ({homePlayersIn.length}/{homePlayersOut.length})
                    </p>
                    {homeBenchPlayers.filter(p => !isDisqualified(p.id)).length === 0 ? (
                      <p className="text-center text-red-500 py-3 text-xs font-semibold">No eligible home bench players.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {homeBenchPlayers.map(player => {
                          if (isDisqualified(player.id)) return null;
                          const sel     = homePlayersIn.includes(player.id);
                          const limited = !sel && homePlayersIn.length >= homePlayersOut.length;
                          const pStats  = existingStats.find(s => s.player_id === player.id);
                          return (
                            <button key={player.id} disabled={limited}
                              onClick={() => togglePlayerIn(player.id, game.home_team_id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${limited ? 'opacity-40 cursor-not-allowed border-slate-200 bg-white' : sel ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}>
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-blue-600">{player.jersey_number}</div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-900 text-sm">{player.name}</p>
                                <p className="text-xs text-slate-500">{player.position}{pStats ? ` · ${pStats.fouls||0}F · ${pStats.technical_fouls||0}T` : ''}</p>
                              </div>
                              {sel && <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">✓</div>}
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
                    <p className="text-xs font-bold text-red-700 mb-1.5 px-1">
                      Select {awayPlayersOut.length} Away replacement{awayPlayersOut.length > 1 ? 's' : ''} ({awayPlayersIn.length}/{awayPlayersOut.length})
                    </p>
                    {awayBenchPlayers.filter(p => !isDisqualified(p.id)).length === 0 ? (
                      <p className="text-center text-red-500 py-3 text-xs font-semibold">No eligible away bench players.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {awayBenchPlayers.map(player => {
                          if (isDisqualified(player.id)) return null;
                          const sel     = awayPlayersIn.includes(player.id);
                          const limited = !sel && awayPlayersIn.length >= awayPlayersOut.length;
                          const pStats  = existingStats.find(s => s.player_id === player.id);
                          return (
                            <button key={player.id} disabled={limited}
                              onClick={() => togglePlayerIn(player.id, game.away_team_id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${limited ? 'opacity-40 cursor-not-allowed border-slate-200 bg-white' : sel ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50/40'}`}>
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-red-600">{player.jersey_number}</div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-900 text-sm">{player.name}</p>
                                <p className="text-xs text-slate-500">{player.position}{pStats ? ` · ${pStats.fouls||0}F · ${pStats.technical_fouls||0}T` : ''}</p>
                              </div>
                              {sel && <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">✓</div>}
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

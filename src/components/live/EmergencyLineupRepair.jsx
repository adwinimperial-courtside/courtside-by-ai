import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, RotateCcw, UserMinus, UserPlus, Lock } from "lucide-react";

const LOCK_TIMEOUT_MS = 60_000; // 60 seconds — stale lock threshold

export default function EmergencyLineupRepair({ repairData, existingStats, players, game, lastValidLineups, onComplete }) {
  const queryClient = useQueryClient();
  const gameId = game.id;

  // ─── Lock state ─────────────────────────────────────────────────────────────
  // 'loading' → checking/claiming lock
  // 'locked'  → another admin holds a fresh lock; show waiting UI
  // 'mine'    → this instance holds the lock; show repair UI
  const [lockStatus, setLockStatus] = useState('loading');
  const [lockedByEmail, setLockedByEmail] = useState(null);

  // Stable per-tab identity, generated ONCE at component initialisation time.
  // useRef guarantees the value is fixed before any async work runs — critical
  // so the DB claim write and the Realtime comparison use the same string.
  // If auth is unavailable, the random suffix distinguishes tabs during testing.
  const tabIdentityRef = useRef(null);
  if (!tabIdentityRef.current) {
    tabIdentityRef.current = `admin-${Math.random().toString(36).slice(2, 8)}`;
  }
  const currentUserEmailRef = useRef(null);
  const holdsLockRef = useRef(false); // true when this instance has written a claim to the DB

  // ─── Repair state ────────────────────────────────────────────────────────────
  const [workingActive, setWorkingActive] = useState(() => {
    const map = {};
    repairData.teams.forEach(t => {
      map[t.teamId] = new Set(t.activePlayers.map(p => p.id));
    });
    return map;
  });
  const [error, setError] = useState('');

  // ─── Lock helpers ─────────────────────────────────────────────────────────
  const claimLock = async (userEmail) => {
    await supabase.from('games').update({
      lineup_repair_locked_by: userEmail,
      lineup_repair_locked_at: new Date().toISOString(),
    }).eq('id', gameId);
    holdsLockRef.current = true;
  };

  const releaseLock = () => {
    holdsLockRef.current = false;
    return supabase.from('games')
      .update({ lineup_repair_locked_by: null, lineup_repair_locked_at: null })
      .eq('id', gameId);
  };

  // ─── Lock claim on mount + Realtime watch ─────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    // Subscribe first so we never miss a lock-cleared event while init is running
    const uid = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`repair-lock-${gameId}-${uid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          console.log('[EmergencyLineupRepair] Realtime UPDATE games:', {
            locked_by: payload.new?.lineup_repair_locked_by,
            locked_at: payload.new?.lineup_repair_locked_at,
            myIdentity: currentUserEmailRef.current,
            holdsLock: holdsLockRef.current,
          });
          if (!isMounted) return;
          const newLockedBy = payload.new?.lineup_repair_locked_by;
          const newLockedAt = payload.new?.lineup_repair_locked_at
            ? new Date(payload.new.lineup_repair_locked_at)
            : null;
          const isFresh = newLockedAt && (Date.now() - newLockedAt.getTime() <= LOCK_TIMEOUT_MS);

          if (newLockedBy && isFresh && newLockedBy !== currentUserEmailRef.current) {
            // Someone else claimed — show waiting UI if we don't hold it
            if (!holdsLockRef.current) {
              setLockedByEmail(newLockedBy);
              setLockStatus('locked');
            }
          } else if (!newLockedBy || !isFresh) {
            // Lock was released or went stale — if we were waiting, try to claim.
            // Include the 200ms wait + verify so this path is race-safe too.
            if (!holdsLockRef.current && currentUserEmailRef.current) {
              const identity = currentUserEmailRef.current;
              claimLock(identity)
                .then(() => new Promise(r => setTimeout(r, 200)))
                .then(() => supabase.from('games').select('lineup_repair_locked_by').eq('id', gameId).single())
                .then(({ data: v }) => {
                  if (!isMounted) return;
                  if (v?.lineup_repair_locked_by === identity) {
                    setLockedByEmail(null);
                    setLockStatus('mine');
                  } else {
                    holdsLockRef.current = false;
                    setLockedByEmail(v?.lineup_repair_locked_by ?? null);
                    setLockStatus('locked');
                  }
                });
            }
          }
        }
      )
      .subscribe();

    // Check DB state and claim or wait
    const init = async () => {
      // Resolve identity: prefer real auth email, fall back to the stable per-tab
      // random value frozen in tabIdentityRef before any async work started.
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || tabIdentityRef.current;
      currentUserEmailRef.current = userEmail;

      if (!isMounted) return;

      const { data: gameRow } = await supabase
        .from('games')
        .select('lineup_repair_locked_by, lineup_repair_locked_at')
        .eq('id', gameId)
        .single();

      if (!isMounted) return;

      const lockedBy = gameRow?.lineup_repair_locked_by;
      const lockedAt = gameRow?.lineup_repair_locked_at
        ? new Date(gameRow.lineup_repair_locked_at)
        : null;
      const isStale = !lockedAt || (Date.now() - lockedAt.getTime() > LOCK_TIMEOUT_MS);
      const isMine = lockedBy === userEmail;

      if (lockedBy && !isStale && !isMine) {
        // Fresh lock held by someone else — wait
        setLockedByEmail(lockedBy);
        setLockStatus('locked');
      } else {
        // No lock, stale lock, or already ours — claim it
        await claimLock(userEmail);
        if (!isMounted) return;

        // Wait 200ms so any concurrent tab's claim write has time to propagate
        // through Postgres before we re-read. Without this delay, both tabs may
        // each see their own write and both report 'mine'.
        await new Promise(r => setTimeout(r, 200));
        if (!isMounted) return;

        const { data: verify } = await supabase
          .from('games')
          .select('lineup_repair_locked_by')
          .eq('id', gameId)
          .single();

        if (!isMounted) return;

        if (verify?.lineup_repair_locked_by === userEmail) {
          setLockStatus('mine');
        } else {
          // Lost the race — show as waiting; Realtime will unblock us when lock clears
          holdsLockRef.current = false;
          setLockedByEmail(verify?.lineup_repair_locked_by ?? null);
          setLockStatus('locked');
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      channel.unsubscribe();
      supabase.removeChannel(channel);
      // Release lock on unmount if this instance holds it
      if (holdsLockRef.current) {
        releaseLock();
      }
    };
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Foul eligibility ────────────────────────────────────────────────────
  const limits = {
    personalFoulLimit:        game.game_rules?.personalFoulLimit        ?? 5,
    technicalFoulLimit:       game.game_rules?.technicalFoulLimit       ?? 2,
    unsportsmanlikeFoulLimit: game.game_rules?.unsportsmanlikeFoulLimit ?? 2,
  };

  const isEligible = (playerId) => {
    const s = existingStats.find(st => st.player_id === playerId);
    if (!s) return true;
    return (
      (s.fouls || 0)                 < limits.personalFoulLimit &&
      (s.technical_fouls || 0)       < limits.technicalFoulLimit &&
      (s.unsportsmanlike_fouls || 0) < limits.unsportsmanlikeFoulLimit
    );
  };

  const getActiveCount = (teamId) => {
    const activeSet = workingActive[teamId] || new Set();
    return players.filter(p => p.team_id === teamId && activeSet.has(p.id)).length;
  };

  const isTeamValid = (teamId) => {
    const activeSet  = workingActive[teamId] || new Set();
    const activeCount = getActiveCount(teamId);
    const teamPls    = players.filter(p => p.team_id === teamId);
    const eligibleBench = teamPls.filter(p => !activeSet.has(p.id) && isEligible(p.id));
    return activeCount === 5 || (activeCount < 5 && eligibleBench.length === 0);
  };

  const allValid = repairData.teams.every(t => isTeamValid(t.teamId));

  const removePlayer = (teamId, playerId) => {
    setWorkingActive(prev => {
      const newSet = new Set(prev[teamId] || []);
      newSet.delete(playerId);
      return { ...prev, [teamId]: newSet };
    });
  };

  const addPlayer = (teamId, playerId) => {
    if (getActiveCount(teamId) >= 5) return;
    setWorkingActive(prev => {
      const newSet = new Set(prev[teamId] || []);
      newSet.add(playerId);
      return { ...prev, [teamId]: newSet };
    });
  };

  const restoreLastValid = (teamId) => {
    const snapshot = lastValidLineups[teamId];
    if (!snapshot) return;
    setWorkingActive(prev => ({ ...prev, [teamId]: new Set(snapshot.playerIds) }));
  };

  // ─── Confirm repair ──────────────────────────────────────────────────────
  const { mutate: confirmRepair, isPending: saving } = useMutation({
    mutationFn: async () => {
      // Clear lock first so other admins are unblocked immediately
      await releaseLock();

      for (const teamData of repairData.teams) {
        const { teamId } = teamData;
        const activeSet  = workingActive[teamId] || new Set();
        const teamStats  = existingStats.filter(s => s.team_id === teamId);

        // Update is_starter for rows whose status changed
        for (const stat of teamStats) {
          const shouldBeActive = activeSet.has(stat.player_id);
          if (stat.is_starter !== shouldBeActive) {
            const { error } = await supabase
              .from('player_stats')
              .update({ is_starter: shouldBeActive })
              .eq('id', stat.id);
            if (error) throw error;
          }
        }

        // Insert new player_stats for players in activeSet with no existing row
        const existingPlayerIds = teamStats.map(s => s.player_id);
        const newRecords = [...activeSet]
          .filter(playerId => !existingPlayerIds.includes(playerId))
          .map(playerId => ({
            game_id:    game.id,
            league_id:  game.league_id,
            player_id:  playerId,
            team_id:    teamId,
            is_starter: true,
            minutes_played: 0,
          }));

        if (newRecords.length > 0) {
          const { error } = await supabase.from('player_stats').insert(newRecords);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player_stats', game.id] });
      onComplete();
    },
    onError: () => {
      setError('Failed to save lineup. Please try again.');
    },
  });

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (lockStatus === 'loading') {
    return (
      <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-8 flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500" />
          <p className="text-slate-600 font-medium">Checking repair status…</p>
        </div>
      </div>
    );
  }

  // ─── Locked by another admin ──────────────────────────────────────────────
  if (lockStatus === 'locked') {
    return (
      <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl border-2 border-amber-300 w-full max-w-md p-8 flex flex-col items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <Lock className="w-7 h-7 text-amber-600" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-amber-800 mb-1">Lineup Repair In Progress</h2>
            <p className="text-sm text-amber-700">
              <span className="font-semibold">{lockedByEmail}</span> is handling this repair.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              This screen will update automatically when the repair is complete.
            </p>
          </div>
          <div className="flex items-center gap-2 text-amber-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500" />
            <span className="text-sm font-medium">Waiting…</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Repair UI (lockStatus === 'mine') ────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-red-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-4 pb-3 bg-red-50 border-b border-red-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-700">Emergency Lineup Repair</h2>
              <p className="text-xs text-red-500 font-medium">All game actions are blocked until lineup is valid</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {repairData.teams.map(teamData => {
            const { teamId, teamName, team } = teamData;
            const activeSet     = workingActive[teamId] || new Set();
            const teamPls       = players.filter(p => p.team_id === teamId);
            const activePls     = teamPls.filter(p => activeSet.has(p.id));
            const activeCount   = activePls.length;
            const benchPls      = teamPls.filter(p => !activeSet.has(p.id));
            const eligibleBench = benchPls.filter(p => isEligible(p.id));
            const isValid       = isTeamValid(teamId);
            const snapshot      = lastValidLineups[teamId];
            const tooMany       = activeCount > 5;

            return (
              <div key={teamId} className={`rounded-xl border-2 p-4 transition-all ${isValid ? 'border-green-400 bg-green-50' : 'border-red-300 bg-red-50/30'}`}>

                {/* Team header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: team?.color || '#64748b' }}>
                    {teamName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900">{teamName}</p>
                    <p className={`text-xs font-semibold ${isValid ? 'text-green-600' : 'text-red-600'}`}>
                      {isValid
                        ? `${activeCount} active players — lineup valid ✓`
                        : tooMany
                          ? `${activeCount} active players — remove ${activeCount - 5} to fix`
                          : eligibleBench.length === 0
                            ? `${activeCount} active players — no eligible replacements (allowed)`
                            : `${activeCount} active players — add ${5 - activeCount} to fix`}
                    </p>
                  </div>
                  {isValid && <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />}
                </div>

                {/* Restore last valid lineup */}
                <div className="mb-3">
                  {snapshot ? (
                    <button
                      onClick={() => restoreLastValid(teamId)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore Last Valid Lineup
                      <span className="text-amber-600 font-normal ml-1">
                        ({new Date(snapshot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · P{snapshot.period})
                      </span>
                    </button>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No valid lineup snapshot available yet</p>
                  )}
                </div>

                {/* Active players */}
                <div className="mb-3">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">On Court ({activeCount})</p>
                  <div className="space-y-1.5">
                    {activePls.map(player => {
                      const pStats = existingStats.find(s => s.player_id === player.id);
                      return (
                        <div key={player.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ backgroundColor: team?.color || '#64748b' }}>
                            {player.jersey_number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-slate-900">{player.name}</p>
                            {pStats && <p className="text-xs text-slate-500">{pStats.fouls || 0}F · {pStats.technical_fouls || 0}T · {pStats.unsportsmanlike_fouls || 0}U</p>}
                          </div>
                          {tooMany ? (
                            <button
                              onClick={() => removePlayer(teamId, player.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 transition-all flex-shrink-0"
                            >
                              <UserMinus className="w-3 h-3" />Remove
                            </button>
                          ) : (
                            <span className="text-[10px] text-green-600 font-bold flex-shrink-0">ON COURT</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Eligible bench (too few case) */}
                {activeCount < 5 && eligibleBench.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Eligible Bench</p>
                    <div className="space-y-1.5">
                      {eligibleBench.map(player => {
                        const pStats = existingStats.find(s => s.player_id === player.id);
                        return (
                          <button
                            key={player.id}
                            onClick={() => addPlayer(teamId, player.id)}
                            disabled={activeCount >= 5}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white border border-dashed border-slate-200 hover:border-green-400 hover:bg-green-50/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-200 text-slate-700 font-bold text-xs flex-shrink-0">
                              {player.jersey_number}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="font-semibold text-sm text-slate-900">{player.name}</p>
                              {pStats && <p className="text-xs text-slate-500">{pStats.fouls || 0}F · {pStats.technical_fouls || 0}T · {pStats.unsportsmanlike_fouls || 0}U</p>}
                            </div>
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-green-100 text-green-700 border border-green-200 flex-shrink-0">
                              <UserPlus className="w-3 h-3" />Add
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* No eligible bench */}
                {activeCount < 5 && eligibleBench.length === 0 && benchPls.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-amber-700 font-semibold">
                      No eligible replacement players available. Lineup may remain at {activeCount}.
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {error && <p className="text-red-500 text-sm font-semibold text-center px-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 flex-shrink-0">
          <Button
            onClick={() => confirmRepair()}
            disabled={!allValid || saving}
            className="w-full h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold text-base shadow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving Lineup…' : allValid ? 'Confirm Repaired Lineup' : 'Fix Lineup to Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}

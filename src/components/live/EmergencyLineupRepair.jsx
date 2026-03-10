import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, RotateCcw, UserMinus, UserPlus } from "lucide-react";

export default function EmergencyLineupRepair({ repairData, existingStats, players, game, lastValidLineups, onComplete }) {
  const [workingActive, setWorkingActive] = useState(() => {
    const map = {};
    repairData.teams.forEach(t => {
      map[t.teamId] = new Set(t.activePlayers.map(p => p.id));
    });
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const limits = {
    personalFoulLimit: game.game_rules?.personalFoulLimit ?? 5,
    technicalFoulLimit: game.game_rules?.technicalFoulLimit ?? 2,
    unsportsmanlikeFoulLimit: game.game_rules?.unsportsmanlikeFoulLimit ?? 2,
  };

  const isEligible = (playerId) => {
    const s = existingStats.find(st => st.player_id === playerId);
    if (!s) return true;
    return (
      (s.fouls || 0) < limits.personalFoulLimit &&
      (s.technical_fouls || 0) < limits.technicalFoulLimit &&
      (s.unsportsmanlike_fouls || 0) < limits.unsportsmanlikeFoulLimit
    );
  };

  const getActiveCount = (teamId) => {
    const activeSet = workingActive[teamId] || new Set();
    return players.filter(p => p.team_id === teamId && activeSet.has(p.id)).length;
  };

  const isTeamValid = (teamId) => {
    const activeSet = workingActive[teamId] || new Set();
    const activeCount = getActiveCount(teamId);
    const teamPls = players.filter(p => p.team_id === teamId);
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

  const handleConfirm = async () => {
    setSaving(true);
    setError('');
    try {
      for (const teamData of repairData.teams) {
        const { teamId } = teamData;
        const activeSet = workingActive[teamId] || new Set();
        const teamStats = existingStats.filter(s => s.team_id === teamId);

        for (const stat of teamStats) {
          const shouldBeActive = activeSet.has(stat.player_id);
          if (stat.is_starter !== shouldBeActive) {
            await base44.entities.PlayerStats.update(stat.id, { is_starter: shouldBeActive });
          }
        }

        const existingPlayerIds = teamStats.map(s => s.player_id);
        for (const playerId of [...activeSet]) {
          if (!existingPlayerIds.includes(playerId)) {
            await base44.entities.PlayerStats.create({
              game_id: game.id,
              player_id: playerId,
              team_id: teamId,
              is_starter: true,
              minutes_played: 0,
            });
          }
        }
      }
      onComplete();
    } catch(e) {
      setError('Failed to save lineup. Please try again.');
      setSaving(false);
    }
  };

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
            const activeSet = workingActive[teamId] || new Set();
            const teamPls = players.filter(p => p.team_id === teamId);
            const activePls = teamPls.filter(p => activeSet.has(p.id));
            const activeCount = activePls.length;
            const benchPls = teamPls.filter(p => !activeSet.has(p.id));
            const eligibleBench = benchPls.filter(p => isEligible(p.id));
            const isValid = isTeamValid(teamId);
            const snapshot = lastValidLineups[teamId];
            const tooMany = activeCount > 5;

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
            onClick={handleConfirm}
            disabled={!allValid || saving}
            className="w-full h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold text-base shadow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving Lineup...' : allValid ? 'Confirm Repaired Lineup' : 'Fix Lineup to Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
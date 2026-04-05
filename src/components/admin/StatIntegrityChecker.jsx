import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, RefreshCw, Wrench } from "lucide-react";

const NON_POINT_STATS = [
  'offensive_rebounds', 'defensive_rebounds', 'assists',
  'steals', 'blocks', 'turnovers', 'fouls',
  'technical_fouls', 'unsportsmanlike_fouls'
];

const STAT_LOG_TYPES = new Set([
  'points_2', 'points_3', 'free_throws', 'free_throws_missed',
  'offensive_rebounds', 'defensive_rebounds', 'assists',
  'steals', 'blocks', 'turnovers', 'fouls',
  'technical_fouls', 'unsportsmanlike_fouls'
]);

export default function StatIntegrityChecker({ leagues, teams }) {
  const [selectedLeague, setSelectedLeague] = useState('');
  const [results, setResults] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [repairingGameId, setRepairingGameId] = useState(null);
  const [repairLog, setRepairLog] = useState({});

  const runCheck = async () => {
    if (!selectedLeague) return;
    setIsChecking(true);
    setResults(null);
    setRepairLog({});

    try {
      const games = await base44.entities.Game.filter({
        league_id: selectedLeague,
        status: 'completed',
        entry_type: 'digital',
      });

      const flagged = [];

      for (const game of games) {
        const [stats, logs] = await Promise.all([
          base44.entities.PlayerStats.filter({ game_id: game.id }),
          base44.entities.GameLog.filter({ game_id: game.id }),
        ]);

        const homeScore = stats
          .filter(s => s.team_id === game.home_team_id)
          .reduce((acc, s) => acc + (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0), 0);
        const awayScore = stats
          .filter(s => s.team_id === game.away_team_id)
          .reduce((acc, s) => acc + (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0), 0);

        const hasPoints = homeScore > 0 || awayScore > 0;

        const totalNonPoint = stats.reduce((acc, s) =>
          acc + NON_POINT_STATS.reduce((a, k) => a + (s[k] || 0), 0), 0);

        const nonPointLogs = logs.filter(l => STAT_LOG_TYPES.has(l.stat_type) &&
          NON_POINT_STATS.includes(l.stat_type));

        if (hasPoints && totalNonPoint === 0) {
          const homeTeam = teams.find(t => t.id === game.home_team_id);
          const awayTeam = teams.find(t => t.id === game.away_team_id);
          flagged.push({
            game,
            homeTeam,
            awayTeam,
            homeScore,
            awayScore,
            statsCount: stats.length,
            logsCount: logs.length,
            nonPointLogsCount: nonPointLogs.length,
            hasRepairData: nonPointLogs.length > 0,
            stats,
            logs,
          });
        }
      }

      setResults({ total: games.length, flagged });
    } catch (err) {
      alert('Check failed: ' + err.message);
    } finally {
      setIsChecking(false);
    }
  };

  const repairFromLogs = async (flaggedGame) => {
    const { game, logs, stats } = flaggedGame;
    setRepairingGameId(game.id);

    try {
      // Build per-player stat sums from logs (ground truth)
      const statSums = {}; // { playerId: { stat_key: total } }

      for (const log of logs) {
        if (!STAT_LOG_TYPES.has(log.stat_type)) continue;
        // Each log records old_value + new_value; use new_value as the most recent
        // Instead, reconstruct by tracking increments (each log is +1)
        if (!statSums[log.player_id]) statSums[log.player_id] = {};
        statSums[log.player_id][log.stat_type] =
          (statSums[log.player_id][log.stat_type] || 0) + 1;
      }

      // Account for undos: when a log is deleted (undone), the old_value is restored.
      // Since deleted logs are removed from DB, our sum above already reflects the
      // current (post-undo) state as long as we only count existing logs.

      console.log('[StatIntegrityChecker] Repair sums from logs:', statSums);

      let updatedCount = 0;
      for (const stat of stats) {
        const sums = statSums[stat.player_id];
        if (!sums) continue;

        const patch = {};
        for (const key of NON_POINT_STATS) {
          if (sums[key] && sums[key] > (stat[key] || 0)) {
            patch[key] = sums[key];
          }
        }
        // Also patch scoring fields if logs show higher values
        for (const key of ['points_2', 'points_3', 'free_throws']) {
          if (sums[key] && sums[key] > (stat[key] || 0)) {
            patch[key] = sums[key];
          }
        }

        if (Object.keys(patch).length > 0) {
          console.log(`[StatIntegrityChecker] Patching player ${stat.player_id}:`, patch);
          await base44.entities.PlayerStats.update(stat.id, patch);
          updatedCount++;
        }
      }

      setRepairLog(prev => ({
        ...prev,
        [game.id]: `Repaired ${updatedCount} player row(s) from ${logs.length} log entries.`,
      }));
    } catch (err) {
      setRepairLog(prev => ({
        ...prev,
        [game.id]: `Repair failed: ${err.message}`,
      }));
    } finally {
      setRepairingGameId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Select League</label>
          <select
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={selectedLeague}
            onChange={e => setSelectedLeague(e.target.value)}
          >
            <option value="">Choose league...</option>
            {leagues.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <Button
          onClick={runCheck}
          disabled={!selectedLeague || isChecking}
          className="bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Checking...' : 'Run Integrity Check'}
        </Button>
      </div>

      {results && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              Checked <strong>{results.total}</strong> completed digital games.
            </span>
            {results.flagged.length === 0 ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle2 className="w-3 h-3 mr-1" />All clean
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {results.flagged.length} game{results.flagged.length > 1 ? 's' : ''} flagged
              </Badge>
            )}
          </div>

          {results.flagged.map(fg => (
            <div key={fg.game.id} className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">
                    {fg.homeTeam?.name} vs {fg.awayTeam?.name}
                  </p>
                  <p className="text-sm text-slate-600">
                    Score: {fg.homeScore} – {fg.awayScore} &nbsp;·&nbsp;
                    {new Date(fg.game.game_date).toLocaleDateString()}
                    {fg.game.edited && ' · Edited'}
                  </p>
                </div>
                <Badge className="bg-red-100 text-red-800 flex-shrink-0">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Points exist, all non-point stats = 0
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white border border-slate-200 rounded-lg p-2 text-center">
                  <p className="text-slate-500 text-xs">PlayerStats rows</p>
                  <p className="font-bold text-lg text-slate-900">{fg.statsCount}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-2 text-center">
                  <p className="text-slate-500 text-xs">GameLog entries</p>
                  <p className="font-bold text-lg text-slate-900">{fg.logsCount}</p>
                </div>
                <div className={`border rounded-lg p-2 text-center ${fg.nonPointLogsCount > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-slate-500 text-xs">Non-point logs</p>
                  <p className={`font-bold text-lg ${fg.nonPointLogsCount > 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {fg.nonPointLogsCount}
                  </p>
                </div>
              </div>

              {fg.nonPointLogsCount > 0 ? (
                <div className="flex items-center gap-3">
                  <p className="text-xs text-green-700 flex-1">
                    ✓ GameLogs contain {fg.nonPointLogsCount} non-point entries. Repair will reconstruct PlayerStats from these logs.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => repairFromLogs(fg)}
                    disabled={repairingGameId === fg.game.id}
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white flex-shrink-0"
                  >
                    <Wrench className={`w-3 h-3 mr-1 ${repairingGameId === fg.game.id ? 'animate-spin' : ''}`} />
                    {repairingGameId === fg.game.id ? 'Repairing...' : 'Repair from Logs'}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-red-600">
                  ✗ No non-point GameLog entries found — stats were likely never recorded for this game. Manual entry via Edit Game is required.
                </p>
              )}

              {repairLog[fg.game.id] && (
                <p className="text-xs font-semibold text-slate-700 bg-slate-100 rounded px-3 py-2">
                  {repairLog[fg.game.id]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
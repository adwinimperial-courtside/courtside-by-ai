import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, RefreshCw, Trash2, Trophy, Filter, ShieldAlert } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import ManualGameEntry from "../components/admin/ManualGameEntry";
import EditGameEntry from "../components/admin/EditGameEntry";
import DeleteGameEntry from "../components/admin/DeleteGameEntry";
import { findPlayerOfGame } from "../components/utils/pogCalculator";
import HelpButton from "../components/help/HelpButton";

export default function AdminTools() {
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showEditEntry, setShowEditEntry] = useState(false);
  const [showDeleteEntry, setShowDeleteEntry] = useState(false);
  const [isCalculatingPOG, setIsCalculatingPOG] = useState(false);
  const [isRecalculatingStandings, setIsRecalculatingStandings] = useState(false);
  const [selectedRecalcLeague, setSelectedRecalcLeague] = useState('');
  // COACH_TEAM_BACKFILL_V1 — admin backfill UI state
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);
  const [backfillError, setBackfillError] = useState('');
  // PIN_AWARD_SETTINGS_V1 — one-time pin of pre-change award defaults
  const [pinBusy, setPinBusy] = useState(false);
  const [pinResult, setPinResult] = useState(null);
  const [pinError, setPinError] = useState('');
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    initialData: null,
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
  });

  const { data: myLeagueIdentities = [], isLoading: identitiesLoading } = useQuery({
    queryKey: ['myLeagueIdentities', currentUser?.id],
    queryFn: () => base44.entities.UserLeagueIdentity.filter({ user_id: currentUser.id }),
    enabled: !!currentUser?.id,
    staleTime: 60000,
  });

  const isAppAdmin = currentUser?.user_type === 'app_admin';

  const filteredLeagues = (() => {
    if (isAppAdmin) return leagues;
    if (identitiesLoading) return [];

    const nonAdminLeagueIds = myLeagueIdentities
      .filter(i => i.role !== 'league_admin')
      .map(i => i.league_id);

    const assignedIds = currentUser?.assigned_league_ids || [];
    return leagues.filter(l =>
      assignedIds.includes(l.id) && !nonAdminLeagueIds.includes(l.id)
    );
  })();

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list(),
  });

  const isAdminUser = currentUser?.user_type === 'app_admin' || currentUser?.user_type === 'league_admin';
  const isRecalcAllowed = isAdminUser;

  if (currentUser && !isAdminUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <Settings className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
            <p className="text-slate-600">You don't have permission to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  const calculateMissingPOG = async () => {
    if (!selectedRecalcLeague) return;
    setIsCalculatingPOG(true);
    try {
      const games = await base44.entities.Game.filter({ status: 'completed', league_id: selectedRecalcLeague });
      const stats = await base44.entities.PlayerStats.list();
      const allPlayers = await base44.entities.Player.list();

      let updatedCount = 0;
      let clearedCount = 0;

      for (const game of games) {
        // Get stats for this game
        const gameStats = stats.filter(s => s.game_id === game.id);
        
        // Calculate POG from winning team
        const playerOfGameId = findPlayerOfGame(gameStats, game);
        
        // Verify the player exists
        const playerExists = playerOfGameId ? allPlayers.some(p => p.id === playerOfGameId) : false;
        
        if (playerOfGameId && playerExists) {
          // Update with valid POG
          if (game.player_of_game !== playerOfGameId) {
            await base44.entities.Game.update(game.id, {
              player_of_game: playerOfGameId,
            });
            updatedCount++;
          }
        } else if (game.player_of_game) {
          // Clear invalid POG reference
          await base44.entities.Game.update(game.id, {
            player_of_game: null,
          });
          clearedCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      
      let message = `Updated ${updatedCount} game(s)`;
      if (clearedCount > 0) {
        message += ` and cleared ${clearedCount} invalid reference(s)`;
      }
      alert(message + '!');
    } catch (error) {
      alert('Error calculating Player of the Game: ' + error.message);
    } finally {
      setIsCalculatingPOG(false);
    }
  };

  const recalculateTeamStandings = async () => {
    if (!selectedRecalcLeague) return;
    setIsRecalculatingStandings(true);
    try {
      const allGames = await base44.entities.Game.filter({ status: 'completed', league_id: selectedRecalcLeague });
      const allTeams = await base44.entities.Team.filter({ league_id: selectedRecalcLeague });

      // Group teams by league and calculate wins/losses
      const teamStats = {};
      
      // Initialize all teams with 0 wins/losses
      allTeams.forEach(team => {
        teamStats[team.id] = { wins: 0, losses: 0 };
      });

      // Calculate wins and losses from completed games
      allGames.forEach(game => {
        if (game.home_score > game.away_score) {
          // Home team won
          teamStats[game.home_team_id].wins += 1;
          teamStats[game.away_team_id].losses += 1;
        } else if (game.away_score > game.home_score) {
          // Away team won
          teamStats[game.away_team_id].wins += 1;
          teamStats[game.home_team_id].losses += 1;
        }
        // Ties are not counted
      });

      // Update all teams
      let updatedCount = 0;
      for (const team of allTeams) {
        const stats = teamStats[team.id];
        if (team.wins !== stats.wins || team.losses !== stats.losses) {
          await base44.entities.Team.update(team.id, {
            wins: stats.wins,
            losses: stats.losses,
          });
          updatedCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['teams'] });
      alert(`Successfully recalculated standings for ${updatedCount} team(s)!`);
    } catch (error) {
      alert('Error recalculating standings: ' + error.message);
    } finally {
      setIsRecalculatingStandings(false);
    }
  };

  // PIN_AWARD_SETTINGS_V1 — writes the ORIGINAL default award settings (hardcoded
  // snapshot, July 2026) for every league that has no saved settings record, so
  // existing leagues keep scoring exactly as today when the defaults change.
  const runPinAwardSettings = async (dryRun) => {
    setPinBusy(true);
    setPinError('');
    if (dryRun) setPinResult(null);
    const ORIGINAL_DEFAULTS = {
      mvp_pts_weight: 1.0, mvp_oreb_weight: 1.2, mvp_dreb_weight: 1.0,
      mvp_ast_weight: 1.5, mvp_stl_weight: 2.5, mvp_blk_weight: 2.0,
      mvp_turnover_penalty: 2.0, mvp_foul_penalty: 0.5, mvp_tech_penalty: 3.0,
      mvp_unsportsmanlike_penalty: 4.0, mvp_avg_gis_weight: 0.6,
      mvp_gp_percent_weight: 20.0, mvp_team_win_percent_weight: 20.0,
      mvp_min_games_percent: 60.0, mvp_tech_final_penalty: 3.0, mvp_unsp_final_penalty: 5.0,
      dpoy_stl_weight: 3.0, dpoy_blk_weight: 2.5, dpoy_oreb_weight: 1.5,
      dpoy_dreb_weight: 1.0, dpoy_foul_penalty: 1.5, dpoy_turnover_penalty: 2.0,
      dpoy_tech_penalty: 3.0, dpoy_unsportsmanlike_penalty: 4.0,
      dpoy_gp_percent_weight: 10.0, dpoy_min_games_percent: 60.0,
      dpoy_tech_final_penalty: 2.0, dpoy_unsp_final_penalty: 3.0,
      pog_pts_weight: 1.0, pog_oreb_weight: 1.2, pog_dreb_weight: 1.0,
      pog_ast_weight: 1.5, pog_stl_weight: 2.5, pog_blk_weight: 2.0,
      pog_turnover_penalty: 2.0, pog_foul_penalty: 0.5, pog_tech_penalty: 3.0,
      pog_unsportsmanlike_penalty: 4.0, pog_winning_team_only: true,
      mythical_five_source: 'mvp_rankings', mythical_five_count: 5,
    };
    try {
      const allSettings = await base44.entities.AwardSettings.list();
      const haveIds = new Set((allSettings || []).map(s => s.league_id));
      const missing = (leagues || []).filter(l => !haveIds.has(l.id));
      if (dryRun) {
        setPinResult({ mode: 'preview', count: missing.length, names: missing.map(l => l.name) });
      } else {
        const done = [];
        const errors = [];
        for (const l of missing) {
          try {
            await base44.entities.AwardSettings.create({ ...ORIGINAL_DEFAULTS, league_id: l.id, league_name: l.name });
            done.push(l.name);
          } catch (e) {
            errors.push(`${l.name}: ${e?.message || 'failed'}`);
          }
        }
        setPinResult({ mode: 'committed', count: done.length, names: done, errors });
      }
    } catch (e) {
      setPinError(e?.message || 'Failed to load award settings');
    } finally {
      setPinBusy(false);
    }
  };

  const runCoachBackfill = async (dryRun) => {
    setBackfillBusy(true);
    setBackfillError('');
    if (dryRun) setBackfillResult(null);
    try {
      const res = await base44.functions.invoke('backfillCoachTeams/entry', { dryRun });
      const result = res?.data || res;
      if (result?.error) throw new Error(result.error);
      setBackfillResult(result);
      if (!dryRun) queryClient.invalidateQueries({ queryKey: ['user'] });
    } catch (err) {
      setBackfillError(err?.message || 'Backfill failed');
    } finally {
      setBackfillBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Settings className="w-8 h-8 text-orange-600" />
              Admin Tools
              <HelpButton pageKey="admintools" />
            </h1>
            <p className="text-slate-600 mt-2">Manage and maintain league data</p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Game Management Section */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Game Management</h2>
            <div className="grid gap-4">
              <Card className="border-slate-200 shadow-lg">
                <CardHeader className="border-b border-slate-200 bg-white">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Plus className="w-5 h-5 text-orange-600" />
                    Manual Game Entry
                  </CardTitle>
                  <p className="text-sm text-slate-600 mt-2">
                    Add completed games with full statistics when not using the live tracker
                  </p>
                </CardHeader>
                <CardContent className="pt-6">
                  {!showManualEntry ? (
                    <Button
                      onClick={() => setShowManualEntry(true)}
                      className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add New Game
                    </Button>
                  ) : (
                    <ManualGameEntry
                      leagues={filteredLeagues}
                      teams={teams}
                      players={players}
                      onClose={() => {
                        queryClient.invalidateQueries({ queryKey: ['players'] });
                        setShowManualEntry(false);
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-lg">
                <CardHeader className="border-b border-slate-200 bg-white">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-600" />
                    Edit Game
                  </CardTitle>
                  <p className="text-sm text-slate-600 mt-2">
                    Edit statistics for completed games
                  </p>
                </CardHeader>
                <CardContent className="pt-6">
                  {!showEditEntry ? (
                    <Button
                      onClick={() => setShowEditEntry(true)}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Game
                    </Button>
                  ) : (
                    <EditGameEntry
                      leagues={filteredLeagues}
                      teams={teams}
                      players={players}
                      onClose={() => {
                        queryClient.invalidateQueries({ queryKey: ['players'] });
                        setShowEditEntry(false);
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-lg border-red-200">
                <CardHeader className="border-b border-slate-200 bg-red-50">
                  <CardTitle className="text-xl flex items-center gap-2 text-red-700">
                    <Trash2 className="w-5 h-5" />
                    Delete Game
                  </CardTitle>
                  <p className="text-sm text-red-600 mt-2">
                    Permanently delete games and all associated data
                  </p>
                </CardHeader>
                <CardContent className="pt-6">
                  {!showDeleteEntry ? (
                    <Button
                      onClick={() => setShowDeleteEntry(true)}
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Game
                    </Button>
                  ) : (
                    <DeleteGameEntry
                      leagues={filteredLeagues}
                      teams={teams}
                      onClose={() => setShowDeleteEntry(false)}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Recalculate Section */}
          {currentUser?.user_type === 'app_admin' && (
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Recalculate</h2>

            {/* League selector for recalculations */}
            <Card className="border-slate-200 shadow-sm mb-4">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-700 flex-shrink-0">Select League:</span>
                  <Select value={selectedRecalcLeague} onValueChange={setSelectedRecalcLeague}>
                    <SelectTrigger className="w-72">
                      <SelectValue placeholder="Choose a league to recalculate..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredLeagues.map(league => (
                        <SelectItem key={league.id} value={league.id}>
                          {league.name} ({league.season})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!selectedRecalcLeague && (
                  <p className="text-xs text-amber-600 mt-2 ml-7">A league must be selected before running any recalculation.</p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <Card className="border-slate-200 shadow-lg">
                <CardHeader className="border-b border-slate-200 bg-white">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Calculate Player of the Game
                  </CardTitle>
                  <p className="text-sm text-slate-600 mt-2">
                    Automatically calculate and assign Player of the Game for all completed games
                  </p>
                </CardHeader>
                <CardContent className="pt-6">
                  <Button
                    onClick={calculateMissingPOG}
                    disabled={isCalculatingPOG || !selectedRecalcLeague}
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50"
                  >
                    <Trophy className={`w-4 h-4 mr-2 ${isCalculatingPOG ? 'animate-spin' : ''}`} />
                    {isCalculatingPOG ? 'Calculating...' : 'Calculate Player of the Game'}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-lg">
                <CardHeader className="border-b border-slate-200 bg-white">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-purple-600" />
                    Recalculate Team Standings
                  </CardTitle>
                  <p className="text-sm text-slate-600 mt-2">
                    Recalculate wins, losses, and point differentials for all teams based on completed games
                  </p>
                </CardHeader>
                <CardContent className="pt-6">
                  <Button
                    onClick={recalculateTeamStandings}
                    disabled={isRecalculatingStandings || !selectedRecalcLeague}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRecalculatingStandings ? 'animate-spin' : ''}`} />
                    {isRecalculatingStandings ? 'Recalculating...' : 'Recalculate Team Standings'}
                  </Button>
                </CardContent>
              </Card>

              {/* COACH_TEAM_BACKFILL_V1 — one-time backfill of coach teams (preview then run) */}
              <Card className="border-slate-200 shadow-lg border-emerald-200">
                <CardHeader className="border-b border-slate-200 bg-emerald-50">
                  <CardTitle className="text-xl flex items-center gap-2 text-emerald-800">
                    <RefreshCw className="w-5 h-5" />
                    Coach Team Backfill
                  </CardTitle>
                  <p className="text-sm text-emerald-700 mt-2">
                    Fills in the team for coaches approved before team auto-assignment, read from their original signup. Non-destructive — never changes a team that's already set, and safe to run more than once. Always Preview first, then Run.
                  </p>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => runCoachBackfill(true)}
                      disabled={backfillBusy}
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${backfillBusy ? 'animate-spin' : ''}`} />
                      Preview
                    </Button>
                    <Button
                      onClick={() => runCoachBackfill(false)}
                      disabled={backfillBusy || !backfillResult || backfillResult.mode !== 'preview' || (backfillResult.additionsCount || 0) === 0}
                      variant="outline"
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      Run backfill
                    </Button>
                  </div>

                  {backfillError && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{backfillError}</div>
                  )}

                  {backfillResult && (
                    <div className="text-sm">
                      <div className={`rounded-lg px-3 py-2 mb-3 font-medium ${backfillResult.mode === 'committed' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
                        {backfillResult.mode === 'committed'
                          ? `Done. Set ${backfillResult.additionsCount} team${backfillResult.additionsCount === 1 ? '' : 's'} across ${backfillResult.usersAffected} coach${backfillResult.usersAffected === 1 ? '' : 'es'}.`
                          : `Preview — would set ${backfillResult.additionsCount} team${backfillResult.additionsCount === 1 ? '' : 's'} across ${backfillResult.usersAffected} coach${backfillResult.usersAffected === 1 ? '' : 'es'}. Scanned ${backfillResult.coachApplicationsScanned} coach application${backfillResult.coachApplicationsScanned === 1 ? '' : 's'}.`}
                      </div>

                      {(backfillResult.additions || []).length > 0 && (
                        <div className="mb-3">
                          <div className="font-semibold text-slate-700 mb-1">{backfillResult.mode === 'committed' ? 'Applied' : 'Will set'}:</div>
                          <ul className="space-y-1">
                            {backfillResult.additions.map((a, i) => (
                              <li key={i} className="text-slate-600">• <span className="font-medium">{a.email}</span> → {a.teamName} <span className="text-slate-400">({a.leagueName})</span></li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(backfillResult.skipped || []).length > 0 && (
                        <details className="mb-2">
                          <summary className="cursor-pointer text-slate-500">{backfillResult.skipped.length} skipped</summary>
                          <ul className="mt-1 space-y-1">
                            {backfillResult.skipped.map((s, i) => (
                              <li key={i} className="text-slate-500">• {s.email} <span className="text-slate-400">({s.league})</span> — {s.reason}</li>
                            ))}
                          </ul>
                        </details>
                      )}

                      {(backfillResult.errors || []).length > 0 && (
                        <div className="text-red-600">
                          <div className="font-semibold mb-1">{backfillResult.errors.length} error(s):</div>
                          <ul className="space-y-1">
                            {backfillResult.errors.map((e, i) => (
                              <li key={i}>• {e.email}: {e.error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* PIN_AWARD_SETTINGS_V1 — one-time pin before the default MVP weights change */}
              <Card className="border-slate-200 shadow-lg border-indigo-200">
                <CardHeader className="border-b border-slate-200 bg-indigo-50">
                  <CardTitle className="text-xl flex items-center gap-2 text-indigo-800">
                    <Settings className="w-5 h-5" />
                    Pin Award Settings
                  </CardTitle>
                  <p className="text-sm text-indigo-700 mt-2">
                    One-time step before the new default MVP weights ship: saves today's default award settings as a record for every league that never customized them, so existing leagues keep scoring exactly as they do now. Leagues with saved settings are skipped. Safe to run more than once. Preview first, then Run.
                  </p>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => runPinAwardSettings(true)}
                      disabled={pinBusy}
                      className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${pinBusy ? 'animate-spin' : ''}`} />
                      Preview
                    </Button>
                    <Button
                      onClick={() => runPinAwardSettings(false)}
                      disabled={pinBusy || !pinResult || pinResult.mode !== 'preview' || pinResult.count === 0}
                      variant="outline"
                      className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                    >
                      Run pin
                    </Button>
                  </div>
                  {pinError && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{pinError}</div>
                  )}
                  {pinResult && (
                    <div className="text-sm">
                      <div className={`rounded-lg px-3 py-2 mb-3 font-medium ${pinResult.mode === 'committed' ? 'bg-indigo-50 text-indigo-800 border border-indigo-200' : 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
                        {pinResult.mode === 'committed'
                          ? `Done. Pinned ${pinResult.count} league${pinResult.count === 1 ? '' : 's'}.`
                          : `Preview — would pin ${pinResult.count} league${pinResult.count === 1 ? '' : 's'}.`}
                      </div>
                      {(pinResult.names || []).length > 0 && (
                        <ul className="space-y-1">
                          {pinResult.names.map((n, i) => (
                            <li key={i} className="text-slate-600">• {n}</li>
                          ))}
                        </ul>
                      )}
                      {(pinResult.errors || []).length > 0 && (
                        <div className="text-red-600 mt-2">
                          <div className="font-semibold mb-1">{pinResult.errors.length} error(s):</div>
                          <ul className="space-y-1">
                            {pinResult.errors.map((e, i) => (<li key={i}>• {e}</li>))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
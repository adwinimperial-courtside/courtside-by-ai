import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, RefreshCw, Trash2, Trophy } from "lucide-react";

import ManualGameEntry from "../components/admin/ManualGameEntry";
import EditGameEntry from "../components/admin/EditGameEntry";
import DeleteGameEntry from "../components/admin/DeleteGameEntry";
import { findPlayerOfGame } from "../components/utils/pogCalculator";

export default function AdminTools() {
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showEditEntry, setShowEditEntry] = useState(false);
  const [showDeleteEntry, setShowDeleteEntry] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isCalculatingPOG, setIsCalculatingPOG] = useState(false);
  const [isRecalculatingStandings, setIsRecalculatingStandings] = useState(false);
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

  const filteredLeagues = currentUser?.user_type === 'league_admin' && currentUser?.assigned_league_ids
    ? leagues.filter(league => currentUser.assigned_league_ids.includes(league.id))
    : leagues;

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list(),
  });

  const recalculateGameScores = async () => {
    setIsRecalculating(true);
    try {
      // Get all completed games
      const games = await base44.entities.Game.filter({ status: 'completed' });
      const stats = await base44.entities.PlayerStats.list();

      let updatedCount = 0;

      for (const game of games) {
        // Get stats for this game
        const gameStats = stats.filter(s => s.game_id === game.id);
        
        // Calculate scores
        const homeScore = gameStats
          .filter(s => s.team_id === game.home_team_id)
          .reduce((sum, s) => sum + ((s.points_2 || 0) * 2) + ((s.points_3 || 0) * 3) + (s.free_throws || 0), 0);
        
        const awayScore = gameStats
          .filter(s => s.team_id === game.away_team_id)
          .reduce((sum, s) => sum + ((s.points_2 || 0) * 2) + ((s.points_3 || 0) * 3) + (s.free_throws || 0), 0);

        // Update if scores don't match
        if (game.home_score !== homeScore || game.away_score !== awayScore) {
          await base44.entities.Game.update(game.id, {
            home_score: homeScore,
            away_score: awayScore,
          });
          updatedCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['games'] });
      alert(`Successfully recalculated scores for ${updatedCount} game(s)!`);
    } catch (error) {
      alert('Error recalculating scores: ' + error.message);
    } finally {
      setIsRecalculating(false);
    }
  };

  const calculateMissingPOG = async () => {
    setIsCalculatingPOG(true);
    try {
      // Get all data
      const games = await base44.entities.Game.filter({ status: 'completed' });
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
    setIsRecalculatingStandings(true);
    try {
      // Get all completed games
      const allGames = await base44.entities.Game.filter({ status: 'completed' });
      const allTeams = await base44.entities.Team.list();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Settings className="w-8 h-8 text-orange-600" />
              Admin Tools
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
           <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Recalculate</h2>
            <div className="grid gap-4">
              <Card className="border-slate-200 shadow-lg">
                <CardHeader className="border-b border-slate-200 bg-white">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                    Recalculate Game Scores
                  </CardTitle>
                  <p className="text-sm text-slate-600 mt-2">
                    Fix scores for all completed games by recalculating from player statistics
                  </p>
                </CardHeader>
                <CardContent className="pt-6">
                  <Button
                    onClick={recalculateGameScores}
                    disabled={isRecalculating}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
                    {isRecalculating ? 'Recalculating...' : 'Recalculate All Game Scores'}
                  </Button>
                </CardContent>
              </Card>

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
                    disabled={isCalculatingPOG}
                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                  >
                    <Trophy className={`w-4 h-4 mr-2 ${isCalculatingPOG ? 'animate-spin' : ''}`} />
                    {isCalculatingPOG ? 'Calculating...' : 'Calculate All Player of the Game'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
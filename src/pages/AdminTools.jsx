import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, RefreshCw } from "lucide-react";

import ManualGameEntry from "../components/admin/ManualGameEntry";
import EditGameEntry from "../components/admin/EditGameEntry";

export default function AdminTools() {
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showEditEntry, setShowEditEntry] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const queryClient = useQueryClient();

  const { data: leagues = [] } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
  });

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
                  leagues={leagues}
                  teams={teams}
                  players={players}
                  onClose={() => setShowManualEntry(false)}
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
                  leagues={leagues}
                  teams={teams}
                  players={players}
                  onClose={() => setShowEditEntry(false)}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
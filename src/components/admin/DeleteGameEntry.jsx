import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { X, Trash2, AlertTriangle } from "lucide-react";

export default function DeleteGameEntry({ leagues, teams, onClose }) {
  const queryClient = useQueryClient();
  const [selectedLeague, setSelectedLeague] = useState("");
  const [selectedGame, setSelectedGame] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: completedGames = [] } = useQuery({
    queryKey: ['deletableGames', selectedLeague],
    queryFn: () => selectedLeague ? base44.entities.Game.filter({ league_id: selectedLeague }, '-game_date') : Promise.resolve([]),
    enabled: !!selectedLeague,
  });

  const deleteGameMutation = useMutation({
    mutationFn: async (game) => {
      const user = await base44.auth.me();
      
      // Get all stats for this game
      const gameStats = await base44.entities.PlayerStats.filter({ game_id: game.id });
      
      // Calculate team scores from stats
      const homeScore = gameStats
        .filter(s => s.team_id === game.home_team_id)
        .reduce((sum, s) => sum + ((s.points_2 || 0) * 2) + ((s.points_3 || 0) * 3) + (s.free_throws || 0), 0);
      
      const awayScore = gameStats
        .filter(s => s.team_id === game.away_team_id)
        .reduce((sum, s) => sum + ((s.points_2 || 0) * 2) + ((s.points_3 || 0) * 3) + (s.free_throws || 0), 0);

      const homeWon = homeScore > awayScore;
      
      // Get current team records
      const homeTeam = teams.find(t => t.id === game.home_team_id);
      const awayTeam = teams.find(t => t.id === game.away_team_id);

      // Delete all player stats for this game
      await Promise.all(gameStats.map(stat => base44.entities.PlayerStats.delete(stat.id)));

      // Update team records (subtract the game result)
      if (game.status === 'completed') {
        await base44.entities.Team.update(game.home_team_id, {
          wins: homeWon ? Math.max(0, (homeTeam.wins || 0) - 1) : homeTeam.wins || 0,
          losses: !homeWon ? Math.max(0, (homeTeam.losses || 0) - 1) : homeTeam.losses || 0,
        });

        await base44.entities.Team.update(game.away_team_id, {
          wins: !homeWon ? Math.max(0, (awayTeam.wins || 0) - 1) : awayTeam.wins || 0,
          losses: homeWon ? Math.max(0, (awayTeam.losses || 0) - 1) : awayTeam.losses || 0,
        });
      }

      // Log the deletion
      const homeTeamName = homeTeam?.name || 'Unknown';
      const awayTeamName = awayTeam?.name || 'Unknown';
      const gameDate = new Date(game.game_date).toLocaleString();
      
      await base44.entities.DeletionLog.create({
        entity_type: 'Game',
        entity_id: game.id,
        entity_details: `${homeTeamName} vs ${awayTeamName} - ${gameDate} (Score: ${game.home_score}-${game.away_score})`,
        deleted_by: user.email,
        deletion_date: new Date().toISOString(),
      });

      // Delete the game
      await base44.entities.Game.delete(game.id);
      
      return game;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['playerStats'] });
      queryClient.invalidateQueries({ queryKey: ['allPlayerStats'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['deletableGames'] });
      alert('Game deleted successfully!');
      setSelectedGame(null);
      setSelectedLeague("");
      onClose();
    },
    onError: (error) => {
      alert('Error deleting game: ' + error.message);
    },
  });

  const handleDeleteClick = () => {
    if (selectedGame) {
      setShowConfirmDialog(true);
    }
  };

  const confirmDelete = () => {
    setShowConfirmDialog(false);
    deleteGameMutation.mutate(selectedGame);
  };

  const homeTeam = teams.find(t => t.id === selectedGame?.home_team_id);
  const awayTeam = teams.find(t => t.id === selectedGame?.away_team_id);

  return (
    <>
      <div className="space-y-6">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900 mb-1">Permanent Deletion Warning</h4>
              <p className="text-sm text-red-700">
                Deleting a game will permanently remove all game data, player statistics, and adjust team records. 
                This action cannot be undone.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select League *</Label>
            <Select value={selectedLeague} onValueChange={(value) => {
              setSelectedLeague(value);
              setSelectedGame(null);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select league" />
              </SelectTrigger>
              <SelectContent>
                {leagues.map(league => (
                  <SelectItem key={league.id} value={league.id}>{league.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLeague && completedGames.length > 0 && (
            <div className="space-y-2">
              <Label>Select Game to Delete *</Label>
              <Select value={selectedGame?.id || ""} onValueChange={(value) => {
                const game = completedGames.find(g => g.id === value);
                setSelectedGame(game);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select game to delete" />
                </SelectTrigger>
                <SelectContent>
                  {completedGames.map(game => {
                    const home = teams.find(t => t.id === game.home_team_id);
                    const away = teams.find(t => t.id === game.away_team_id);
                    return (
                      <SelectItem key={game.id} value={game.id}>
                        {home?.name} vs {away?.name} - {new Date(game.game_date).toLocaleDateString()} ({game.home_score}-{game.away_score}) - {game.status}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedLeague && completedGames.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No games found in this league</p>
          )}
        </div>

        {selectedGame && (
          <div className="bg-slate-100 p-4 rounded-lg border-2 border-slate-300">
            <h4 className="font-semibold mb-2">Selected Game:</h4>
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Teams:</span> {homeTeam?.name} vs {awayTeam?.name}</p>
              <p><span className="font-medium">Date:</span> {new Date(selectedGame.game_date).toLocaleString()}</p>
              <p><span className="font-medium">Score:</span> {selectedGame.home_score} - {selectedGame.away_score}</p>
              <p><span className="font-medium">Status:</span> {selectedGame.status}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleDeleteClick}
            disabled={!selectedGame || deleteGameMutation.isPending}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleteGameMutation.isPending ? 'Deleting...' : 'Delete Game'}
          </Button>
        </div>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              Confirm Permanent Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-semibold text-slate-900">
                Are you absolutely sure you want to delete this game?
              </p>
              <div className="bg-slate-100 p-3 rounded-lg text-sm">
                <p><strong>Game:</strong> {homeTeam?.name} vs {awayTeam?.name}</p>
                <p><strong>Date:</strong> {selectedGame && new Date(selectedGame.game_date).toLocaleString()}</p>
                <p><strong>Score:</strong> {selectedGame?.home_score} - {selectedGame?.away_score}</p>
              </div>
              <p className="text-red-600 font-medium">
                This will permanently delete:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1 text-slate-700">
                <li>The game record</li>
                <li>All player statistics for this game</li>
                <li>Team wins/losses will be adjusted</li>
              </ul>
              <p className="font-semibold text-red-700">
                This action cannot be undone!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Key, AlertTriangle } from "lucide-react";

export default function DeleteLeague() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
    enabled: currentUser?.user_type === "app_admin",
  });

  if (currentUser && currentUser.user_type !== "app_admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <Key className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
            <p className="text-slate-600">You don't have permission to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  const selectedLeague = leagues.find((l) => l.id === selectedLeagueId);
  const confirmationPhrase = selectedLeague ? selectedLeague.name : "";
  const canDelete = confirmText === confirmationPhrase && !!selectedLeagueId;

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      // Delete all associated data in parallel batches
      const [games, teams, players] = await Promise.all([
        base44.entities.Game.filter({ league_id: selectedLeagueId }),
        base44.entities.Team.filter({ league_id: selectedLeagueId }),
        base44.entities.Player.list(),
      ]);

      const teamIds = teams.map((t) => t.id);
      const leaguePlayers = players.filter((p) => teamIds.includes(p.team_id));
      const gameIds = games.map((g) => g.id);

      // Delete PlayerStats and GameLogs for all games
      const [allStats, allLogs] = await Promise.all([
        base44.entities.PlayerStats.list(),
        base44.entities.GameLog.list(),
      ]);

      const statsToDelete = allStats.filter((s) => gameIds.includes(s.game_id));
      const logsToDelete = allLogs.filter((l) => gameIds.includes(l.game_id));

      await Promise.all([
        ...statsToDelete.map((s) => base44.entities.PlayerStats.delete(s.id)),
        ...logsToDelete.map((l) => base44.entities.GameLog.delete(l.id)),
      ]);

      await Promise.all(games.map((g) => base44.entities.Game.delete(g.id)));
      await Promise.all(leaguePlayers.map((p) => base44.entities.Player.delete(p.id)));
      await Promise.all(teams.map((t) => base44.entities.Team.delete(t.id)));
      await base44.entities.League.delete(selectedLeagueId);

      queryClient.invalidateQueries({ queryKey: ["leagues"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });

      alert(`League "${confirmationPhrase}" and all associated data have been permanently deleted.`);
      setSelectedLeagueId("");
      setConfirmText("");
    } catch (error) {
      alert("Error deleting league: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Trash2 className="w-8 h-8 text-red-600" />
            <h1 className="text-3xl font-bold text-slate-900">Delete League</h1>
          </div>
          <p className="text-slate-600">Permanently delete a league and all its associated data</p>
        </div>

        <Card className="border-red-200 shadow-lg">
          <CardHeader className="bg-red-50 border-b border-red-200">
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone — This action is irreversible
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 space-y-1">
              <p className="font-semibold">The following data will be permanently deleted:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>The league record</li>
                <li>All teams in the league</li>
                <li>All players on those teams</li>
                <li>All games and their player statistics</li>
                <li>All game logs</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Select League to Delete</label>
              <Select value={selectedLeagueId} onValueChange={(v) => { setSelectedLeagueId(v); setConfirmText(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a league..." />
                </SelectTrigger>
                <SelectContent>
                  {leagues.map((league) => (
                    <SelectItem key={league.id} value={league.id}>
                      {league.name} ({league.season})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedLeague && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Type <span className="font-bold text-red-600">"{confirmationPhrase}"</span> to confirm deletion
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={`Type league name to confirm...`}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            )}

            <Button
              onClick={handleDelete}
              disabled={!canDelete || isDeleting}
              className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeleting ? "Deleting..." : "Permanently Delete League"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
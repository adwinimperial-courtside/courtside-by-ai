import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, CheckCircle, AlertTriangle, Loader2, Filter, Key } from "lucide-react";

export default function FixManualStats() {
  const [selectedLeague, setSelectedLeague] = useState("");
  const [isFixing, setIsFixing] = useState(false);
  const [results, setResults] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  if (currentUser && currentUser.user_type !== "app_admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-red-200 p-8 text-center">
          <Key className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const handleFix = async () => {
    if (!selectedLeague) return;
    setIsFixing(true);
    setResults(null);

    try {
      // Get all manual or edited games for the selected league
      const allGames = await base44.entities.Game.filter({ league_id: selectedLeague, status: 'completed' });
      const targetGames = allGames.filter(g => g.entry_type === 'manual' || g.edited === true);

      let fixedGames = 0;
      let fixedStats = 0;
      const gameResults = [];

      for (const game of targetGames) {
        const isEditedDigital = game.edited && game.entry_type !== 'manual';
        const stats = await base44.entities.PlayerStats.filter({ game_id: game.id });

        let homeScore = 0;
        let awayScore = 0;
        let statsUpdated = 0;

        await Promise.all(stats.map(async (stat) => {
          let totalPoints;

          if (isEditedDigital) {
            // Old edited digital games stored points_2 as floor((total - 3pt*3 - ft)/2)
            // So true total = points_2*2 + 3pt*3 + ft
            totalPoints = ((stat.points_2 || 0) * 2) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0);
          } else {
            // Manual games stored points_2 = total - 3pt*3 - ft, so already correct
            totalPoints = (stat.points_2 || 0) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0);
          }

          // Store using lossless manual format: points_2 = total - 3pt*3 - ft
          const points3pts = (stat.points_3 || 0) * 3;
          const ft = stat.free_throws || 0;
          const newPoints2 = Math.max(0, totalPoints - points3pts - ft);

          if (newPoints2 !== (stat.points_2 || 0)) {
            await base44.entities.PlayerStats.update(stat.id, { points_2: newPoints2 });
            statsUpdated++;
            fixedStats++;
          }

          if (stat.team_id === game.home_team_id) {
            homeScore += totalPoints;
          } else {
            awayScore += totalPoints;
          }
        }));

        // Update game scores and ensure entry_type is 'manual'
        await base44.entities.Game.update(game.id, {
          home_score: homeScore,
          away_score: awayScore,
          entry_type: 'manual',
        });

        fixedGames++;
        gameResults.push({
          id: game.id,
          home_team_id: game.home_team_id,
          away_team_id: game.away_team_id,
          homeScore,
          awayScore,
          statsUpdated,
          wasEditedDigital: isEditedDigital,
        });
      }

      setResults({ success: true, fixedGames, fixedStats, gameResults, totalFound: targetGames.length });
    } catch (err) {
      setResults({ success: false, message: err.message });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-center gap-3">
          <Wrench className="w-8 h-8 text-orange-600" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Fix Manual Game Stats</h1>
            <p className="text-slate-600 mt-1">Recalculates and normalizes player stats for all manual and edited games so the box score always matches what was entered.</p>
          </div>
        </div>

        <Card className="border-slate-200 shadow-lg mb-6">
          <CardHeader className="border-b border-slate-200 bg-slate-50">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Filter className="w-5 h-5 text-orange-600" />
              Select League
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <Select value={selectedLeague} onValueChange={setSelectedLeague}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a league..." />
              </SelectTrigger>
              <SelectContent>
                {leagues.map(league => (
                  <SelectItem key={league.id} value={league.id}>
                    {league.name} ({league.season})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">What this does</p>
                <p>For every <strong>manual entry</strong> or <strong>edited</strong> completed game in the selected league, it re-saves player stats using the correct lossless format and recalculates the game score. This fixes cases where the box score totals didn't match the displayed score.</p>
              </div>
            </div>

            <Button
              onClick={handleFix}
              disabled={isFixing || !selectedLeague}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isFixing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fixing stats...</>
              ) : (
                <><Wrench className="w-4 h-4 mr-2" /> Fix All Manual & Edited Games</>
              )}
            </Button>
          </CardContent>
        </Card>

        {results && (
          <Card className={`border shadow-lg ${results.success ? 'border-green-200' : 'border-red-200'}`}>
            <CardContent className="pt-6">
              {results.success ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-6 h-6" />
                    <span className="text-lg font-semibold">
                      Fixed {results.fixedGames} of {results.totalFound} games — {results.fixedStats} stat records updated
                    </span>
                  </div>
                  <div className="space-y-2">
                    {results.gameResults.map(g => {
                      const home = teams.find(t => t.id === g.home_team_id);
                      const away = teams.find(t => t.id === g.away_team_id);
                      return (
                        <div key={g.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2 text-sm">
                          <span className="text-slate-700">
                            {home?.name} vs {away?.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{g.homeScore} – {g.awayScore}</span>
                            {g.statsUpdated > 0 && (
                              <Badge className="bg-green-100 text-green-800 text-xs">{g.statsUpdated} fixed</Badge>
                            )}
                            {g.wasEditedDigital && (
                              <Badge className="bg-amber-100 text-amber-800 text-xs">was edited</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold">Error: {results.message}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
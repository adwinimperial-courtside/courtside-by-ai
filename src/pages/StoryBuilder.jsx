import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Copy, RefreshCw, AlertCircle, CheckCircle, Newspaper } from "lucide-react";

export default function StoryBuilder() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");
  const [story, setStory] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
    enabled: !!currentUser,
  });

  const { data: allGames = [] } = useQuery({
    queryKey: ["games", selectedLeagueId],
    queryFn: () => base44.entities.Game.filter({ league_id: selectedLeagueId, status: "completed" }, "-game_date"),
    enabled: !!selectedLeagueId,
  });

  const { data: gameLogs = [] } = useQuery({
    queryKey: ["gameLogs", selectedGameId],
    queryFn: () => base44.entities.GameLog.filter({ game_id: selectedGameId }, "created_date"),
    enabled: !!selectedGameId,
  });

  const { data: playerStats = [] } = useQuery({
    queryKey: ["playerStats", selectedGameId],
    queryFn: () => base44.entities.PlayerStats.filter({ game_id: selectedGameId }),
    enabled: !!selectedGameId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const visibleLeagues = leagues.filter(l => {
    if (!currentUser) return false;
    if (currentUser.user_type === "app_admin") return true;
    if (currentUser.user_type === "league_admin") {
      return l.created_by === currentUser.email;
    }
    return false;
  });

  // Only completed digital games with logs
  const eligibleGames = allGames.filter(g =>
    g.status === "completed" &&
    g.entry_type === "digital" &&
    !g.is_default_result
  );

  const gamesWithLogs = eligibleGames.filter(g => {
    // We show all eligible but validate log presence at generation time
    return true;
  });

  const selectedGame = allGames.find(g => g.id === selectedGameId);
  const homeTeam = teams.find(t => t.id === selectedGame?.home_team_id);
  const awayTeam = teams.find(t => t.id === selectedGame?.away_team_id);

  const handleGenerate = async () => {
    setError("");
    setStory("");
    setIsGenerating(true);

    try {
      // --- Eligibility checks ---
      if (!selectedGame) throw new Error("no_game");
      if (selectedGame.entry_type !== "digital") throw new Error("not_digital");
      if (selectedGame.status !== "completed") throw new Error("not_completed");
      if (selectedGame.is_default_result) throw new Error("default_result");
      if (gameLogs.length === 0) throw new Error("no_logs");
      if (playerStats.length === 0) throw new Error("no_stats");

      // --- Build stats summary ---
      const buildPlayerStatsSummary = () => {
        return playerStats
          .filter(ps => ps.did_play)
          .map(ps => {
            const player = players.find(p => p.id === ps.player_id);
            const team = teams.find(t => t.id === ps.team_id);
            const pts = (ps.points_2 || 0) * 2 + (ps.points_3 || 0) * 3 + (ps.free_throws || 0);
            return {
              name: player?.name || "Unknown",
              team: team?.name || "Unknown",
              team_id: ps.team_id,
              pts,
              reb: (ps.offensive_rebounds || 0) + (ps.defensive_rebounds || 0),
              ast: ps.assists || 0,
              stl: ps.steals || 0,
              blk: ps.blocks || 0,
              to: ps.turnovers || 0,
              fouls: ps.fouls || 0,
              tech: ps.technical_fouls || 0,
              unsp: ps.unsportsmanlike_fouls || 0,
              three: ps.points_3 || 0,
              ft: ps.free_throws || 0,
              ftm: ps.free_throws_missed || 0,
              oreb: ps.offensive_rebounds || 0,
              dreb: ps.defensive_rebounds || 0,
            };
          });
      };

      const statsSummary = buildPlayerStatsSummary();

      // --- Validate: game score vs summed player stats ---
      const homeStatsPts = statsSummary
        .filter(s => s.team_id === selectedGame.home_team_id)
        .reduce((sum, s) => sum + s.pts, 0);
      const awayStatsPts = statsSummary
        .filter(s => s.team_id === selectedGame.away_team_id)
        .reduce((sum, s) => sum + s.pts, 0);

      const homeScore = selectedGame.home_score || 0;
      const awayScore = selectedGame.away_score || 0;

      // Tolerance check: allow small rounding diff
      const homeDiff = Math.abs(homeStatsPts - homeScore);
      const awayDiff = Math.abs(awayStatsPts - awayScore);

      if (homeDiff > 5 || awayDiff > 5) {
        throw new Error("stats_mismatch");
      }

      // Determine winner/loser
      const homeWon = homeScore > awayScore;
      const winnerTeam = homeWon ? homeTeam : awayTeam;
      const loserTeam = homeWon ? awayTeam : homeTeam;
      const winnerScore = homeWon ? homeScore : awayScore;
      const loserScore = homeWon ? awayScore : homeScore;
      const winnerTeamId = homeWon ? selectedGame.home_team_id : selectedGame.away_team_id;
      const loserTeamId = homeWon ? selectedGame.away_team_id : selectedGame.home_team_id;

      // --- Build activity log narrative text ---
      const buildLogNarrative = () => {
        const pointEvents = gameLogs.filter(l =>
          ["points_2", "points_3", "free_throws"].includes(l.stat_type) &&
          l.new_value > l.old_value
        );

        // Score progression snapshots
        let homeRunning = 0;
        let awayRunning = 0;
        const snapshots = [];
        gameLogs.forEach(l => {
          const pts = l.stat_points ?? 0;
          const added = l.new_value > l.old_value;
          if (added && ["points_2", "points_3", "free_throws"].includes(l.stat_type)) {
            if (l.team_id === selectedGame.home_team_id) homeRunning += pts;
            else awayRunning += pts;
          }
          snapshots.push({ home: homeRunning, away: awayRunning, team: l.team_id, stat: l.stat_type });
        });

        // Detect lead changes
        let leadChanges = 0;
        let prevLead = null;
        snapshots.forEach(s => {
          const lead = s.home > s.away ? "home" : s.away > s.home ? "away" : "tied";
          if (prevLead && lead !== prevLead && lead !== "tied") leadChanges++;
          prevLead = lead;
        });

        // Fouls & physicality
        const totalFouls = gameLogs.filter(l => l.stat_type === "fouls" && l.new_value > l.old_value).length;
        const totalTechs = gameLogs.filter(l => l.stat_type === "technical_fouls" && l.new_value > l.old_value).length;
        const totalUnsp = gameLogs.filter(l => l.stat_type === "unsportsmanlike_fouls" && l.new_value > l.old_value).length;
        const totalThrees = gameLogs.filter(l => l.stat_type === "points_3" && l.new_value > l.old_value).length;

        return {
          leadChanges,
          totalFoulsLogged: totalFouls,
          totalTechsLogged: totalTechs,
          totalUnspLogged: totalUnsp,
          totalThreesLogged: totalThrees,
          totalScoringEvents: pointEvents.length,
          wasClose: Math.abs(homeScore - awayScore) <= 8,
          wasLopsided: Math.abs(homeScore - awayScore) >= 20,
        };
      };

      const logInsights = buildLogNarrative();

      // --- Build top performers ---
      const winnerStats = statsSummary.filter(s => s.team_id === winnerTeamId).sort((a, b) => b.pts - a.pts);
      const loserStats = statsSummary.filter(s => s.team_id === loserTeamId).sort((a, b) => b.pts - a.pts);

      const formatPlayerLine = (p) => {
        const parts = [`${p.pts} pts`];
        if (p.reb >= 5) parts.push(`${p.reb} reb`);
        if (p.ast >= 3) parts.push(`${p.ast} ast`);
        if (p.stl >= 2) parts.push(`${p.stl} stl`);
        if (p.blk >= 2) parts.push(`${p.blk} blk`);
        if (p.three >= 2) parts.push(`${p.three}x3PT`);
        return `${p.name}: ${parts.join(", ")}`;
      };

      const winnerTopPlayers = winnerStats.slice(0, 3).map(formatPlayerLine).join("\n");
      const loserTopPlayers = loserStats.slice(0, 3).map(formatPlayerLine).join("\n");

      const winnerTeamTotals = {
        pts: winnerStats.reduce((s, p) => s + p.pts, 0),
        reb: winnerStats.reduce((s, p) => s + p.reb, 0),
        ast: winnerStats.reduce((s, p) => s + p.ast, 0),
        stl: winnerStats.reduce((s, p) => s + p.stl, 0),
        blk: winnerStats.reduce((s, p) => s + p.blk, 0),
        to: winnerStats.reduce((s, p) => s + p.to, 0),
        three: winnerStats.reduce((s, p) => s + p.three, 0),
        fouls: winnerStats.reduce((s, p) => s + p.fouls, 0),
        techs: winnerStats.reduce((s, p) => s + p.tech, 0),
        unsp: winnerStats.reduce((s, p) => s + p.unsp, 0),
      };

      const loserTeamTotals = {
        pts: loserStats.reduce((s, p) => s + p.pts, 0),
        reb: loserStats.reduce((s, p) => s + p.reb, 0),
        ast: loserStats.reduce((s, p) => s + p.ast, 0),
        stl: loserStats.reduce((s, p) => s + p.stl, 0),
        blk: loserStats.reduce((s, p) => s + p.blk, 0),
        to: loserStats.reduce((s, p) => s + p.to, 0),
        three: loserStats.reduce((s, p) => s + p.three, 0),
        fouls: loserStats.reduce((s, p) => s + p.fouls, 0),
        techs: loserStats.reduce((s, p) => s + p.techs, 0),
        unsp: loserStats.reduce((s, p) => s + p.unsp, 0),
      };

      const prompt = `You are a lively, upbeat grassroots basketball reporter writing a Facebook post-game story for a local league page.

GAME DATA:
League Game — ${format(new Date(selectedGame.game_date), "MMMM d, yyyy")}
Final Score: ${winnerTeam?.name} ${winnerScore} – ${loserTeam?.name} ${loserScore}
Winner: ${winnerTeam?.name}
Loser: ${loserTeam?.name}

ACTIVITY LOG INSIGHTS (from the live digital tracking):
- Total scoring events logged: ${logInsights.totalScoringEvents}
- Lead changes detected: ${logInsights.leadChanges}
- Three-point makes tracked: ${logInsights.totalThreesLogged}
- Personal fouls logged: ${logInsights.totalFoulsLogged}
- Technical fouls: ${logInsights.totalTechsLogged}
- Unsportsmanlike fouls: ${logInsights.totalUnspLogged}
- Game feel: ${logInsights.wasLopsided ? "Winner dominated — this was not close" : logInsights.wasClose ? "Back-and-forth tight contest, decided in the closing stretch" : "Winner pulled away and controlled the second half"}

OFFICIAL VERIFIED PLAYER STATS (source of truth — use these for all numbers):
${winnerTeam?.name} TOP PERFORMERS:
${winnerTopPlayers}

${loserTeam?.name} TOP PERFORMERS:
${loserTopPlayers}

TEAM TOTALS:
${winnerTeam?.name}: ${winnerTeamTotals.pts} pts | ${winnerTeamTotals.reb} reb | ${winnerTeamTotals.ast} ast | ${winnerTeamTotals.stl} stl | ${winnerTeamTotals.blk} blk | ${winnerTeamTotals.three} 3PT | ${winnerTeamTotals.to} TO | ${winnerTeamTotals.fouls} fouls${winnerTeamTotals.techs > 0 ? ` | ${winnerTeamTotals.techs} tech fouls` : ""}${winnerTeamTotals.unsp > 0 ? ` | ${winnerTeamTotals.unsp} unsportsmanlike` : ""}
${loserTeam?.name}: ${loserTeamTotals.pts} pts | ${loserTeamTotals.reb} reb | ${loserTeamTotals.ast} ast | ${loserTeamTotals.stl} stl | ${loserTeamTotals.blk} blk | ${loserTeamTotals.three} 3PT | ${loserTeamTotals.to} TO | ${loserTeamTotals.fouls} fouls${loserTeamTotals.techs > 0 ? ` | ${loserTeamTotals.techs} tech fouls` : ""}${loserTeamTotals.unsp > 0 ? ` | ${loserTeamTotals.unsp} unsportsmanlike` : ""}

INSTRUCTIONS:
Write a Facebook post-game story that:
1. Starts EXACTLY with this line: 🎙️ COURTSIDE BY AI REPORT
2. Second line EXACTLY: 🏁 Final Score: ${winnerTeam?.name} ${winnerScore} – ${loserTeam?.name} ${loserScore}
3. Then the story body (150–280 words) — exciting, natural, human, Facebook-ready with emojis
4. Never invent exact stats — only use the numbers given above
5. Never swap winner/loser or their scores
6. Tell the story using the activity log insights to understand the game flow, but use the official stats for all numbers
7. Mention key standout players naturally with their real stats
8. Make it feel like a proud league organizer is sharing this on their Facebook page
9. End EXACTLY with this line: 👉 Full box score & stats: https://courtside-by-ai.com/schedule

DO NOT include any meta-commentary. Start directly with 🎙️ COURTSIDE BY AI REPORT.
Each generated story should feel fresh and unique — vary the language, phrasing, and story angle each time.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: "claude_sonnet_4_6",
      });

      setStory(typeof result === "string" ? result : JSON.stringify(result));
    } catch (err) {
      if (err.message === "stats_mismatch") {
        setError("Story cannot be generated because the digital game log and saved stats do not align for this game.");
      } else if (["not_digital", "not_completed", "no_logs", "no_stats", "default_result"].includes(err.message)) {
        setError("Story cannot be generated because this game is not a completed digital game with a valid activity log and verified stats.");
      } else {
        setError("Story cannot be generated because this game is not a completed digital game with a valid activity log and verified stats.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(story).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (currentUser && currentUser.user_type !== "app_admin" && currentUser.user_type !== "league_admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">You don't have permission to view this page.</p>
      </div>
    );
  }

  const getGameLabel = (g) => {
    const home = teams.find(t => t.id === g.home_team_id);
    const away = teams.find(t => t.id === g.away_team_id);
    return `${home?.name || "?"} vs ${away?.name || "?"} — ${format(new Date(g.game_date), "MMM d, yyyy")}`;
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Newspaper className="w-6 h-6 text-orange-500" />
          Story Builder
        </h1>
        <p className="text-slate-500 text-sm mt-1">Generate a Facebook-ready post-game story powered by AI.</p>
      </div>

      {/* Selectors */}
      <Card className="border-slate-200 mb-6">
        <CardContent className="pt-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">League</label>
            <Select value={selectedLeagueId} onValueChange={(v) => { setSelectedLeagueId(v); setSelectedGameId(""); setStory(""); setError(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a league…" />
              </SelectTrigger>
              <SelectContent>
                {visibleLeagues.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name} — {l.season}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Game</label>
            <Select
              value={selectedGameId}
              onValueChange={(v) => { setSelectedGameId(v); setStory(""); setError(""); }}
              disabled={!selectedLeagueId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a game…" />
              </SelectTrigger>
              <SelectContent>
                {eligibleGames.length === 0 && (
                  <SelectItem value="__none__" disabled>No eligible games found</SelectItem>
                )}
                {eligibleGames.map(g => (
                  <SelectItem key={g.id} value={g.id}>{getGameLabel(g)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Only completed digital games with activity logs are eligible for Story Builder.
          </p>
        </CardContent>
      </Card>

      {/* Generate button */}
      <div className="flex gap-3 mb-6">
        <Button
          onClick={handleGenerate}
          disabled={!selectedGameId || isGenerating}
          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Generating…
            </>
          ) : story ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate Story
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Story
            </>
          )}
        </Button>

        {story && (
          <Button variant="outline" onClick={handleCopy} className="border-slate-300">
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy to Clipboard
              </>
            )}
          </Button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-red-200 bg-red-50 mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Story output */}
      {story && (
        <Card className="border-orange-200 shadow-lg">
          <CardHeader className="border-b border-orange-100 pb-3">
            <CardTitle className="text-base text-slate-700 flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-orange-500" />
              Generated Story
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
              <pre className="whitespace-pre-wrap font-sans text-slate-800 leading-relaxed text-sm">
                {story}
              </pre>
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="outline" size="sm" onClick={handleCopy} className="border-slate-300">
                {copied ? (
                  <><CheckCircle className="w-4 h-4 mr-1.5 text-green-600" />Copied!</>
                ) : (
                  <><Copy className="w-4 h-4 mr-1.5" />Copy to Clipboard</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
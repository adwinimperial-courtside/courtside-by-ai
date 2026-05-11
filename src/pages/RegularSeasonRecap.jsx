import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Copy, RefreshCw, AlertCircle, CheckCircle, Newspaper } from "lucide-react";
import { DEFAULT_AWARD_SETTINGS } from "@/utils/awardDefaults";

function didPlay(stat) {
  if (stat.did_play) return true;
  if ((stat.minutes_played || 0) > 0) return true;
  return (
    (stat.points_2 || 0) + (stat.points_3 || 0) + (stat.free_throws || 0) +
    (stat.assists || 0) + (stat.steals || 0) + (stat.blocks || 0) +
    (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0) +
    (stat.fouls || 0) + (stat.technical_fouls || 0) + (stat.unsportsmanlike_fouls || 0) > 0
  );
}

function isActualGame(g) {
  return g.status === "completed" && !g.is_default_result && g.result_type !== "default" && !g.exclude_from_awards;
}

function calcPts(stat, game) {
  const isDigital = game && game.entry_type === "digital" && !game.edited;
  return (isDigital ? (stat.points_2 || 0) * 2 : (stat.points_2 || 0)) +
    (stat.points_3 || 0) * 3 + (stat.free_throws || 0);
}

function calculateStandings(teams, games) {
  return teams
    .map(team => {
      const teamGames = games.filter(g =>
        g.status === "completed" && (g.home_team_id === team.id || g.away_team_id === team.id)
      );
      let wins = 0, losses = 0, pf = 0, pa = 0;
      teamGames.forEach(g => {
        if (g.is_default_result) {
          if (g.default_winner_team_id === team.id) wins++;
          else if (g.default_loser_team_id === team.id) losses++;
          return;
        }
        const isHome = g.home_team_id === team.id;
        const ts = isHome ? (g.home_score || 0) : (g.away_score || 0);
        const os = isHome ? (g.away_score || 0) : (g.home_score || 0);
        if (ts > os) wins++; else losses++;
        pf += ts; pa += os;
      });
      const total = wins + losses;
      return { id: team.id, name: team.name, wins, losses, winPct: total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0", pointsDiff: pf - pa };
    })
    .sort((a, b) => parseFloat(b.winPct) - parseFloat(a.winPct));
}

function computeAwards(leagueGames, leagueTeams, players, stats, cfg = DEFAULT_AWARD_SETTINGS) {
  const actualGames = leagueGames.filter(isActualGame);

  // Team stats for eligibility
  const teamStats = {};
  leagueTeams.forEach(team => {
    const tg = actualGames.filter(g => g.home_team_id === team.id || g.away_team_id === team.id);
    const wins = tg.filter(g => (g.home_team_id === team.id ? g.home_score > g.away_score : g.away_score > g.home_score)).length;
    teamStats[team.id] = { gamesPlayed: tg.length, wins, winPct: tg.length > 0 ? wins / tg.length : 0 };
  });

  const mvpMap = {};
  const dpoyMap = {};

  actualGames.forEach(game => {
    const gs = stats.filter(s => s.game_id === game.id);
    gs.forEach(s => {
      if (!didPlay(s)) return;
      const pid = s.player_id;

      // MVP
      if (!mvpMap[pid]) mvpMap[pid] = { gp: 0, sumGis: 0, sumTech: 0, sumUnsp: 0, teamId: s.team_id };
      const pts = cfg.mvp_pts_weight * calcPts(s, game);
      const gis = pts +
        cfg.mvp_oreb_weight * (s.offensive_rebounds || 0) +
        cfg.mvp_dreb_weight * (s.defensive_rebounds || 0) +
        cfg.mvp_ast_weight * (s.assists || 0) +
        cfg.mvp_stl_weight * (s.steals || 0) +
        cfg.mvp_blk_weight * (s.blocks || 0) -
        cfg.mvp_turnover_penalty * (s.turnovers || 0) -
        cfg.mvp_foul_penalty * (s.fouls || 0) -
        cfg.mvp_tech_penalty * (s.technical_fouls || 0) -
        cfg.mvp_unsportsmanlike_penalty * (s.unsportsmanlike_fouls || 0);
      mvpMap[pid].gp += 1;
      mvpMap[pid].sumGis += gis;
      mvpMap[pid].sumTech += s.technical_fouls || 0;
      mvpMap[pid].sumUnsp += s.unsportsmanlike_fouls || 0;

      // DPOY
      if (!dpoyMap[pid]) dpoyMap[pid] = { gp: 0, sumDefGis: 0, sumTech: 0, sumUnsp: 0, teamId: s.team_id };
      const defGis = cfg.dpoy_stl_weight * (s.steals || 0) +
        cfg.dpoy_blk_weight * (s.blocks || 0) +
        cfg.dpoy_oreb_weight * (s.offensive_rebounds || 0) +
        cfg.dpoy_dreb_weight * (s.defensive_rebounds || 0) -
        cfg.dpoy_foul_penalty * (s.fouls || 0) -
        cfg.dpoy_turnover_penalty * (s.turnovers || 0) -
        cfg.dpoy_tech_penalty * (s.technical_fouls || 0) -
        cfg.dpoy_unsportsmanlike_penalty * (s.unsportsmanlike_fouls || 0);
      dpoyMap[pid].gp += 1;
      dpoyMap[pid].sumDefGis += defGis;
      dpoyMap[pid].sumTech += s.technical_fouls || 0;
      dpoyMap[pid].sumUnsp += s.unsportsmanlike_fouls || 0;
    });
  });

  const mvpRanked = Object.entries(mvpMap).map(([pid, d]) => {
    const player = players.find(p => p.id === pid);
    const td = teamStats[d.teamId];
    if (!player || !td || td.gamesPlayed === 0) return null;
    const effectiveGp = Math.min(d.gp, td.gamesPlayed);
    const gpPct = effectiveGp / td.gamesPlayed;
    if (gpPct < cfg.mvp_min_games_percent / 100) return null;
    const avgGis = d.sumGis / effectiveGp;
    const score = cfg.mvp_avg_gis_weight * avgGis + cfg.mvp_gp_percent_weight * gpPct +
      cfg.mvp_team_win_percent_weight * td.winPct -
      cfg.mvp_tech_final_penalty * d.sumTech - cfg.mvp_unsp_final_penalty * d.sumUnsp;
    return { player, score, gp: effectiveGp, avgGis: avgGis.toFixed(1), teamId: d.teamId };
  }).filter(Boolean).sort((a, b) => b.score - a.score);

  const dpoyRanked = Object.entries(dpoyMap).map(([pid, d]) => {
    const player = players.find(p => p.id === pid);
    const tg = teamStats[d.teamId]?.gamesPlayed || 0;
    if (!player || tg === 0) return null;
    const effectiveGp = Math.min(d.gp, tg);
    const gpPct = effectiveGp / tg;
    if (gpPct < cfg.dpoy_min_games_percent / 100) return null;
    const avgDefGis = d.sumDefGis / effectiveGp;
    const score = avgDefGis + cfg.dpoy_gp_percent_weight * gpPct -
      cfg.dpoy_tech_final_penalty * d.sumTech - cfg.dpoy_unsp_final_penalty * d.sumUnsp;
    return { player, score, gp: effectiveGp };
  }).filter(Boolean).sort((a, b) => b.score - a.score);

  return {
    mvp: mvpRanked[0] || null,
    dpoy: dpoyRanked[0] || null,
    mythical5: mvpRanked.slice(0, 5),
  };
}

export default function RegularSeasonRecap() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [recap, setRecap] = useState("");
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

  const { data: completedGames = [] } = useQuery({
    queryKey: ["recapGames", selectedLeagueId],
    queryFn: () => base44.entities.Game.filter({ league_id: selectedLeagueId, status: "completed" }, "-game_date"),
    enabled: !!selectedLeagueId,
  });

  const { data: leagueTeams = [] } = useQuery({
    queryKey: ["recapTeams", selectedLeagueId],
    queryFn: () => base44.entities.Team.filter({ league_id: selectedLeagueId }),
    enabled: !!selectedLeagueId,
  });

  const { data: leaguePlayers = [] } = useQuery({
    queryKey: ["recapPlayers", selectedLeagueId],
    queryFn: async () => {
      const teams = await base44.entities.Team.filter({ league_id: selectedLeagueId });
      const teamIds = teams.map(t => t.id);
      if (!teamIds.length) return [];
      return base44.entities.Player.filter({ team_id: { $in: teamIds } }, null, 1000);
    },
    enabled: !!selectedLeagueId,
  });

  const { data: leagueStats = [] } = useQuery({
    queryKey: ["recapStats", selectedLeagueId],
    queryFn: async () => {
      const games = await base44.entities.Game.filter({ league_id: selectedLeagueId, status: "completed" }, null, 500);
      const gameIds = games.map(g => g.id);
      if (!gameIds.length) return [];
      return base44.entities.PlayerStats.filter({ game_id: { $in: gameIds } }, null, 5000);
    },
    enabled: !!selectedLeagueId,
  });

  const { data: awardSettings = null } = useQuery({
    queryKey: ["recapAwardSettings", selectedLeagueId],
    queryFn: () => base44.entities.AwardSettings.filter({ league_id: selectedLeagueId }),
    enabled: !!selectedLeagueId,
    select: (data) => data[0] || null,
  });

  const selectedLeague = useMemo(() => leagues.find(l => l.id === selectedLeagueId), [leagues, selectedLeagueId]);
  const standings = useMemo(() => calculateStandings(leagueTeams, completedGames), [leagueTeams, completedGames]);

  const awards = useMemo(() => {
    if (!leagueTeams.length || !completedGames.length || !leaguePlayers.length || !leagueStats.length) return null;
    const cfg = awardSettings ? { ...DEFAULT_AWARD_SETTINGS, ...awardSettings } : DEFAULT_AWARD_SETTINGS;
    return computeAwards(completedGames, leagueTeams, leaguePlayers, leagueStats, cfg);
  }, [completedGames, leagueTeams, leaguePlayers, leagueStats, awardSettings]);

  // Championship game = completed game with game_stage === "championship"
  const championshipGame = useMemo(() =>
    completedGames.find(g => g.game_stage === "championship" && !g.is_default_result),
    [completedGames]
  );

  const championTeam = useMemo(() => {
    if (!championshipGame) return null;
    const winnerId = (championshipGame.home_score || 0) >= (championshipGame.away_score || 0)
      ? championshipGame.home_team_id
      : championshipGame.away_team_id;
    return leagueTeams.find(t => t.id === winnerId) || null;
  }, [championshipGame, leagueTeams]);

  const runnerUpTeam = useMemo(() => {
    if (!championshipGame || !championTeam) return null;
    const loserId = championTeam.id === championshipGame.home_team_id
      ? championshipGame.away_team_id
      : championshipGame.home_team_id;
    return leagueTeams.find(t => t.id === loserId) || null;
  }, [championshipGame, championTeam, leagueTeams]);

  const handleGenerate = async () => {
    setError("");
    setRecap("");
    setIsGenerating(true);
    try {
      if (!selectedLeagueId) throw new Error("Please select a league.");
      if (completedGames.length < 3) throw new Error("not_enough_games");

      const fmt = (v) => v != null ? Number(v).toFixed(1) : "N/A";

      const champScore = championshipGame
        ? `${championTeam?.name || "?"} ${Math.max(championshipGame.home_score || 0, championshipGame.away_score || 0)} – ${runnerUpTeam?.name || "?"} ${Math.min(championshipGame.home_score || 0, championshipGame.away_score || 0)}`
        : "No championship game found";

      const mythical5Names = awards?.mythical5?.map((e, i) => `${i + 1}. ${e.player.name} (${leagueTeams.find(t => t.id === e.teamId)?.name || "?"})`).join(", ") || "N/A";

      const prompt = `You are an elite grassroots basketball reporter creating the OFFICIAL END-OF-SEASON recap for a local basketball league. Your job is to write a short, punchy, cinematic Facebook post — emotional, hype, memorable, shareable.

LEAGUE: ${selectedLeague?.name} (${selectedLeague?.season || ""})
TOTAL GAMES PLAYED: ${completedGames.length}

FINAL STANDINGS:
${standings.map((s, i) => `${i + 1}. ${s.name}: ${s.wins}W-${s.losses}L (${s.winPct}% win rate)`).join("\n")}

CHAMPIONSHIP FINAL:
${champScore}
🏆 CHAMPIONS: ${championTeam?.name || "Unknown"}
Runner-up: ${runnerUpTeam?.name || "Unknown"}

SEASON AWARDS:
🏆 MVP: ${awards?.mvp ? `${awards.mvp.player.name} (${fmt(awards.mvp.avgGis)} Avg GIS, ${awards.mvp.gp} games)` : "N/A"}
🛡️ DPOY: ${awards?.dpoy ? `${awards.dpoy.player.name} (${awards.dpoy.gp} games)` : "N/A"}
⭐ MYTHICAL FIVE: ${mythical5Names}

---

WRITE THE RECAP NOW. Follow this structure exactly:

1. Start EXACTLY with:
🎙️ COURTSIDE BY AI REPORT - ${selectedLeague?.name} - OFFICIAL SEASON RECAP

2. ONE powerful opening line that captures the soul of the season. Short. Punchy. Cinematic.

3. THE CHAMPIONS — how did ${championTeam?.name || "the champions"} earn it? Describe their journey through the season — their record, their dominance or grind, how they showed up when it mattered. Make it feel earned. Make the reader feel the weight of the trophy.

4. THE MVP SPOTLIGHT — this is the CENTERPIECE of the recap. Write a full dedicated paragraph exclusively about the MVP (${awards?.mvp?.player?.name || "the MVP"}). Make it feel like a documentary spotlight. Describe their presence, their impact, what they meant to this season. This should be the most emotionally charged part of the recap. No stats listing — pure storytelling.

5. SEASON STORYLINES — pick 2 storylines from the standings that feel interesting (a dominant team, a surprise run, a close race, a heartbreaking finish). Keep it narrative, not stats. One paragraph max each.

6. AWARDS SHOUTOUT — briefly mention the DPOY and the Mythical Five by name in a single natural sentence or two. No bullet points. Just a proud recognition.

7. CLOSING — celebrate the champions, honor every team that competed, and close with something that makes players want to screenshot this post. Mention that every stat and memory is permanently recorded inside Courtside by AI.

8. End EXACTLY with:
👉 Full stats, standings & season records: https://courtside-by-ai.com/schedule

RULES:
- Target 350–500 words total
- Use emojis naturally — not on every line, but where they punch
- NEVER use bullet points
- NEVER invent stats or players
- NEVER sound like a template or an AI
- SHORT punchy sentences mixed with longer flowing ones
- Make it feel like a real sports media post people actually stop scrolling for

Start immediately with 🎙️ COURTSIDE BY AI REPORT`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: "claude_sonnet_4_6",
      });

      setRecap(typeof result === "string" ? result : JSON.stringify(result));
    } catch (err) {
      if (err.message === "not_enough_games") {
        setError("Not enough completed games to generate a recap.");
      } else {
        setError(err.message || "Failed to generate recap. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(recap).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (currentUser && currentUser.user_type !== "app_admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">You don't have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Newspaper className="w-6 h-6 text-purple-600" />
          Season Recap
        </h1>
        <p className="text-slate-500 text-sm mt-1">Generate a Facebook-ready official season recap for a completed league.</p>
      </div>

      <Card className="border-slate-200 mb-6">
        <CardContent className="pt-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">League</label>
            <Select value={selectedLeagueId} onValueChange={(v) => { setSelectedLeagueId(v); setRecap(""); setError(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a league…" />
              </SelectTrigger>
              <SelectContent>
                {leagues.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name} — {l.season}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLeagueId && (
            <div className="text-xs text-slate-500 space-y-1">
              <p>🏆 Champions: <span className="font-semibold text-slate-700">{championTeam?.name || "No championship game found"}</span></p>
              <p>🥇 MVP: <span className="font-semibold text-slate-700">{awards?.mvp?.player?.name || "Calculating…"}</span></p>
              <p>🛡️ DPOY: <span className="font-semibold text-slate-700">{awards?.dpoy?.player?.name || "Calculating…"}</span></p>
            </div>
          )}

          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Requires a completed championship game and sufficient player stats.
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-3 mb-6">
        <Button
          onClick={handleGenerate}
          disabled={!selectedLeagueId || isGenerating}
          className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
        >
          {isGenerating ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating…</>
          ) : recap ? (
            <><RefreshCw className="w-4 h-4 mr-2" />Regenerate Recap</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />Generate Recap</>
          )}
        </Button>
        {recap && (
          <Button variant="outline" onClick={handleCopy} className="border-slate-300">
            {copied ? (
              <><CheckCircle className="w-4 h-4 mr-2 text-green-600" />Copied!</>
            ) : (
              <><Copy className="w-4 h-4 mr-2" />Copy to Clipboard</>
            )}
          </Button>
        )}
      </div>

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

      {recap && (
        <Card className="border-purple-200 shadow-lg">
          <CardHeader className="border-b border-purple-100 pb-3">
            <CardTitle className="text-base text-slate-700 flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-purple-600" />
              Generated Recap
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
              <pre className="whitespace-pre-wrap font-sans text-slate-800 leading-relaxed text-sm">{recap}</pre>
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
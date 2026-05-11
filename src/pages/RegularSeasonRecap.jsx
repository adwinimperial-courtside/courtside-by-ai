import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Copy, RefreshCw, AlertCircle, CheckCircle, Newspaper } from "lucide-react";

function didPlayerParticipate(stat) {
  if (stat.did_play) return true;
  if ((stat.minutes_played || 0) > 0) return true;
  const hasStats = (stat.points_2 || 0) + (stat.points_3 || 0) + (stat.free_throws || 0) +
    (stat.assists || 0) + (stat.steals || 0) + (stat.blocks || 0) +
    (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0) +
    (stat.fouls || 0) + (stat.technical_fouls || 0) + (stat.unsportsmanlike_fouls || 0) > 0;
  return hasStats;
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
      return { name: team.name, wins, losses, winPct: total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0", pointsDiff: pf - pa };
    })
    .sort((a, b) => parseFloat(b.winPct) - parseFloat(a.winPct));
}

// Mirrors the exact League Leaders tab calculation logic (per-game averages)
function calcPoints(stat, games) {
  const game = games.find(g => g.id === stat.game_id);
  const isDigital = game && game.entry_type === 'digital' && !game.edited;
  return (isDigital ? (stat.points_2 || 0) * 2 : (stat.points_2 || 0)) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0);
}

function calculateLeagueLeaderAverages(playerStats, players, games) {
  // Count completed games per team (same logic as LeagueLeaders component)
  const teamGameCounts = {};
  games.forEach(g => {
    teamGameCounts[g.home_team_id] = (teamGameCounts[g.home_team_id] || 0) + 1;
    teamGameCounts[g.away_team_id] = (teamGameCounts[g.away_team_id] || 0) + 1;
  });

  const aggregates = players.map(player => {
    const ps = playerStats.filter(s => s.player_id === player.id);
    const participated = ps.filter(didPlayerParticipate);
    const gp = participated.length;
    if (gp === 0) return null;
    const teamGames = teamGameCounts[player.team_id] || 0;
    if (teamGames === 0 || (gp / teamGames) < 0.4) return null;
    const totals = participated.reduce((acc, s) => ({
      pts: acc.pts + calcPoints(s, games),
      threes: acc.threes + (s.points_3 || 0),
      reb: acc.reb + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0),
      ast: acc.ast + (s.assists || 0),
      stl: acc.stl + (s.steals || 0),
      blk: acc.blk + (s.blocks || 0),
    }), { pts: 0, threes: 0, reb: 0, ast: 0, stl: 0, blk: 0 });
    return {
      name: player.name,
      gp,
      ppg: totals.pts / gp,
      tpm: totals.threes / gp,
      rpg: totals.reb / gp,
      apg: totals.ast / gp,
      spg: totals.stl / gp,
      bpg: totals.blk / gp,
    };
  }).filter(Boolean);

  const top = (cat) => [...aggregates].sort((a, b) => b[cat] - a[cat])[0];
  return {
    ppg: top("ppg"),
    tpm: top("tpm"),
    rpg: top("rpg"),
    apg: top("apg"),
    spg: top("spg"),
    bpg: top("bpg"),
    entries: aggregates,
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
    queryKey: ["completedGames", selectedLeagueId],
    queryFn: () => base44.entities.Game.filter({ league_id: selectedLeagueId, status: "completed" }, "-game_date"),
    enabled: !!selectedLeagueId,
  });

  const { data: leagueTeams = [] } = useQuery({
    queryKey: ["leagueTeams", selectedLeagueId],
    queryFn: () => base44.entities.Team.filter({ league_id: selectedLeagueId }),
    enabled: !!selectedLeagueId,
  });

  const { data: allPlayers = [] } = useQuery({
    queryKey: ["allPlayers"],
    queryFn: () => base44.entities.Player.list(),
    enabled: !!selectedLeagueId,
  });

  const { data: allPlayerStats = [] } = useQuery({
    queryKey: ["allPlayerStats"],
    queryFn: () => base44.entities.PlayerStats.list(),
    enabled: !!selectedLeagueId,
  });

  const selectedLeague = useMemo(() => leagues.find(l => l.id === selectedLeagueId), [leagues, selectedLeagueId]);

  const leaguePlayerStats = useMemo(() => {
    const completedGameIds = new Set(completedGames.map(g => g.id));
    const teamIds = new Set(leagueTeams.map(t => t.id));
    return allPlayerStats.filter(ps => completedGameIds.has(ps.game_id) && teamIds.has(ps.team_id));
  }, [allPlayerStats, completedGames, leagueTeams]);

  const standings = useMemo(() => calculateStandings(leagueTeams, completedGames), [leagueTeams, completedGames]);
  const leaders = useMemo(() => calculateLeagueLeaderAverages(leaguePlayerStats, allPlayers, completedGames), [leaguePlayerStats, allPlayers, completedGames]);

  const handleGenerate = async () => {
    setError("");
    setRecap("");
    setIsGenerating(true);
    try {
      if (!selectedLeagueId) throw new Error("Please select a league.");
      if (completedGames.length < 3) throw new Error("not_enough_games");

      const fmt = (v) => v != null ? v.toFixed(1) : "N/A";

      const topPlayers = [...(leaders.entries || [])]
        .sort((a, b) => b.ppg - a.ppg)
        .slice(0, 10)
        .map(p => `${p.name} (${p.gp} GP): ${fmt(p.ppg)} PPG, ${fmt(p.tpm)} 3PM, ${fmt(p.rpg)} RPG, ${fmt(p.apg)} APG, ${fmt(p.spg)} SPG, ${fmt(p.bpg)} BPG`)
        .join("\n");

      const awardWinners = [
        leaders.ppg ? `PPG Leader: ${leaders.ppg.name} — ${fmt(leaders.ppg.ppg)} PPG` : null,
        leaders.tpm ? `3PM Leader: ${leaders.tpm.name} — ${fmt(leaders.tpm.tpm)} 3PM` : null,
        leaders.rpg ? `RPG Leader: ${leaders.rpg.name} — ${fmt(leaders.rpg.rpg)} RPG` : null,
        leaders.apg ? `APG Leader: ${leaders.apg.name} — ${fmt(leaders.apg.apg)} APG` : null,
        leaders.spg ? `SPG Leader: ${leaders.spg.name} — ${fmt(leaders.spg.spg)} SPG` : null,
        leaders.bpg ? `BPG Leader: ${leaders.bpg.name} — ${fmt(leaders.bpg.bpg)} BPG` : null,
      ].filter(Boolean).join("\n");

      const prompt = `You are an elite grassroots basketball reporter and storyteller creating the OFFICIAL END-OF-SEASON Facebook recap for a competitive local basketball league using real statistics and standings data.

This is NOT a generic sports summary.

This should feel like:
- an emotional season-ending broadcast recap
- a celebration of the league's journey
- a dramatic retelling of the season
- a memorable social media post league organizers and players would proudly share

The tone must be:
🔥 energetic
🏀 emotional
⚔️ competitive
😂 occasionally funny when appropriate
🏆 championship-level dramatic
📣 Facebook-ready and highly shareable

This season is OFFICIALLY COMPLETE because a CHAMPIONSHIP-tagged game has already concluded.

LEAGUE:
${selectedLeague?.name} (${selectedLeague?.season || ""})

TOTAL COMPLETED GAMES:
${completedGames.length}

FINAL STANDINGS:
${standings.map((s, i) => `${i + 1}. ${s.name}: ${s.wins}W-${s.losses}L (${s.winPct}% win rate, Diff: ${s.pointsDiff > 0 ? "+" : ""}${s.pointsDiff})`).join("\n")}

OFFICIAL LEAGUE LEADERS
(These come directly from the Statistics Page League Leaders tab and MUST be treated as authoritative):

PPG Leader:
${leaders.ppg ? `${leaders.ppg.name} — ${fmt(leaders.ppg.ppg)} PPG` : "N/A"}

3PM Leader:
${leaders.tpm ? `${leaders.tpm.name} — ${fmt(leaders.tpm.tpm)} 3PM` : "N/A"}

RPG Leader:
${leaders.rpg ? `${leaders.rpg.name} — ${fmt(leaders.rpg.rpg)} RPG` : "N/A"}

APG Leader:
${leaders.apg ? `${leaders.apg.name} — ${fmt(leaders.apg.apg)} APG` : "N/A"}

SPG Leader:
${leaders.spg ? `${leaders.spg.name} — ${fmt(leaders.spg.spg)} SPG` : "N/A"}

BPG Leader:
${leaders.bpg ? `${leaders.bpg.name} — ${fmt(leaders.bpg.bpg)} BPG` : "N/A"}

TOP PLAYERS BY PER-GAME AVERAGES:
${topPlayers || "No player stats available."}

OFFICIAL AWARD WINNERS:
${awardWinners || "No awards available."}

IMPORTANT CONTEXT:
- The championship game has already ended
- The season is officially over
- The recap should feel conclusive and celebratory
- Do NOT write like playoffs are still coming
- Do NOT preview future rounds
- This is the FINAL OFFICIAL SEASON RECAP

IMPORTANT — THIS RECAP ACCOMPANIES A VISUAL SEASON POSTER:
The poster already contains the full standings table, all league leader stats, award winners, and detailed statistics. DO NOT repeat or list those details here. The recap is the emotional narrative — the poster is the data.

INSTRUCTIONS:

Write a Facebook-ready season recap that reads like the closing narration of a basketball season documentary. It should feel cinematic, emotional, and human — NOT a stats summary.

FOCUS ONLY ON:
1. The emotional identity of the season — what KIND of season was it? Gritty? Explosive? Dominant? Unpredictable?
2. The championship team — how did they earn it? What was their journey?
3. The Season MVP (PPG Leader) — give them a full dedicated cinematic paragraph. Make them the centerpiece. Describe their impact, their presence, what they meant to the season. This paragraph should feel like a sports documentary spotlight moment.
4. 2–3 major season storylines drawn from the standings (e.g. a dominant team, a surprise run, a close race, a heartbreaking finish) — do NOT list stats, tell stories.
5. An emotional closing that congratulates the champions, honors all competitors, and reinforces that the season's memories are now permanently preserved inside Courtside by AI.

DO NOT:
- list league leaders or award categories
- repeat standings numbers beyond what's needed for storytelling
- name-drop many players — focus on 1–2 key figures maximum beyond the MVP
- use bullet points anywhere
- sound robotic, templated, or like an AI summary
- invent stats, players, or storylines not supported by the data

TONE AND STYLE:
- passionate grassroots basketball commentator
- championship broadcast closing narration
- Facebook post people actually stop scrolling for
- occasionally funny when the data supports it (blowouts, dominant runs, unlikely heroes)
- emotional and hype — "this team refused to die", "the scoreboard looked disrespectful", "every possession felt personal"

STRUCTURE:
1. Start EXACTLY with:
🎙️ COURTSIDE BY AI REPORT - ${selectedLeague?.name} - OFFICIAL SEASON RECAP

2. Powerful opening hook — the season's emotional identity

3. The championship team's story

4. The Season MVP cinematic spotlight paragraph (PPG Leader)

5. 2–3 major season storylines (narrative, not stats)

6. Emotional closing — champions, competitors, and Courtside legacy

7. End EXACTLY with:
👉 Full stats, standings & season records: https://courtside-by-ai.com/schedule

RULES:
- Use emojis naturally throughout
- Target 350–550 words
- Vary sentence rhythm — short punchy lines mixed with flowing narrative
- NEVER use bullet points
- NEVER break character
- NEVER sound like a template

Start immediately with:
🎙️ COURTSIDE BY AI REPORT`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: "claude_opus_4_6",
      });

      setRecap(typeof result === "string" ? result : JSON.stringify(result));
    } catch (err) {
      if (err.message === "not_enough_games") {
        setError("Regular season recap cannot be generated because there is not enough completed league data available yet.");
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
          Regular Season Recap
        </h1>
        <p className="text-slate-500 text-sm mt-1">Generate a Facebook-ready recap for a selected league's regular season.</p>
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
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            This generates a regular season recap using all completed games currently available in the selected league.
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
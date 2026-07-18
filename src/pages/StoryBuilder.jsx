import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Copy, RefreshCw, AlertCircle, CheckCircle, Newspaper } from "lucide-react";
import { useEffectiveRole } from "@/hooks/useEffectiveRole";
import { calcPoints, groupStatsByGameAndPlayer } from "@/components/stats/statEngine";
import HelpButton from "../components/help/HelpButton";

// STORY_ENGINE_V1 — Story Builder wired to the stat engine (single source of
// truth: duplicate rows merged per player, points via calcPoints) + clutch
// detection from the play-by-play log (game-winners, late tying shots,
// clutch defense, comebacks, overtime). POG stats matched by player_id.

export default function StoryBuilder() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");
  const [story, setStory] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const MONTHLY_LIMIT = 10;
  const currentMonthYear = format(new Date(), "yyyy-MM");
  const userEmail = currentUser?.email;

  const { data: usageCounters = [], refetch: refetchUsage } = useQuery({
    queryKey: ["aiUsageCounter", userEmail, currentMonthYear],
    queryFn: () => base44.entities.AIUsageCounter.filter({ created_by: userEmail, month_year: currentMonthYear }),
    enabled: !!userEmail,
  });

  const usageCounter = usageCounters[0];
  const briefingsUsed = usageCounter?.briefings_generated || 0;
  const briefingsRemaining = MONTHLY_LIMIT - briefingsUsed;
  const { isAppAdmin: storyIsAppAdmin, isLeagueAdmin: storyIsLeagueAdmin } = useEffectiveRole(currentUser, selectedLeagueId || null);
  const hasReachedLimit = storyIsLeagueAdmin && !storyIsAppAdmin && briefingsUsed >= MONTHLY_LIMIT;

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
    enabled: !!currentUser,
  });

  const { data: allGames = [] } = useQuery({
    queryKey: ["story_games", selectedLeagueId],
    queryFn: () => base44.entities.Game.filter({ league_id: selectedLeagueId, status: "completed" }, "-game_date", 500),
    enabled: !!selectedLeagueId,
  });

  // STORY_ENGINE_V1 — cap-agnostic log fetch: base44 caps rows per response
  // (~1,500), so very long games need paging or the narrative is built on
  // partial logs. Advance by returned length; break only on empty/short page.
  const { data: gameLogs = [] } = useQuery({
    queryKey: ["gameLogs", selectedGameId],
    queryFn: async () => {
      const PAGE = 1000;
      let all = [];
      let skip = 0;
      while (true) {
        const page = await base44.entities.GameLog.filter({ game_id: selectedGameId }, "created_date", PAGE, skip);
        if (!page || page.length === 0) break;
        all = all.concat(page);
        skip += page.length;
        if (page.length < PAGE) break;
      }
      return all;
    },
    enabled: !!selectedGameId,
  });

  const { data: playerStats = [] } = useQuery({
    queryKey: ["playerStats", selectedGameId],
    queryFn: () => base44.entities.PlayerStats.filter({ game_id: selectedGameId }),
    enabled: !!selectedGameId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["story_teams", selectedLeagueId],
    queryFn: () => base44.entities.Team.filter({ league_id: selectedLeagueId }, null, 500),
    enabled: !!selectedLeagueId,
    staleTime: 60000,
  });

  const { data: players = [] } = useQuery({
    queryKey: ["story_players", selectedLeagueId],
    queryFn: async () => {
      const leagueTeams = await base44.entities.Team.filter({ league_id: selectedLeagueId }, null, 500);
      const teamIds = leagueTeams.map(t => t.id);
      if (teamIds.length === 0) return [];
      return base44.entities.Player.filter({ team_id: { $in: teamIds } }, null, 1000);
    },
    enabled: !!selectedLeagueId,
    staleTime: 60000,
  });

  const { data: myLeagueIdentities = [], isLoading: identitiesLoading } = useQuery({
    queryKey: ['myLeagueIdentities', currentUser?.id],
    queryFn: () => base44.entities.UserLeagueIdentity.filter({ user_id: currentUser.id }),
    enabled: !!currentUser?.id,
    staleTime: 60000,
  });

  const visibleLeagues = (() => {
    if (!currentUser) return [];
    if (currentUser.user_type === "app_admin") return leagues;
    if (identitiesLoading) return [];
    const nonAdminLeagueIds = myLeagueIdentities
      .filter(i => i.role !== 'league_admin')
      .map(i => i.league_id);
    const assignedIds = currentUser.assigned_league_ids || [];
    return leagues.filter(l =>
      assignedIds.includes(l.id) && !nonAdminLeagueIds.includes(l.id)
    );
  })();

  const eligibleGames = allGames.filter(g =>
    g.status === "completed" &&
    g.entry_type === "digital" &&
    !g.is_default_result
  );

  const selectedGame = allGames.find(g => g.id === selectedGameId);
  const homeTeam = teams.find(t => t.id === selectedGame?.home_team_id);
  const awayTeam = teams.find(t => t.id === selectedGame?.away_team_id);

  const safeFormatDate = (dateVal, fmt) => {
    if (!dateVal) return "Unknown date";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "Unknown date";
    return format(d, fmt);
  };

  const handleGenerate = async () => {
    setError("");
    setStory("");
    setIsGenerating(true);

    try {
      // --- Usage limit check (league_admin only) ---
      if (storyIsLeagueAdmin && !storyIsAppAdmin && briefingsUsed >= MONTHLY_LIMIT) {
        setError(`Monthly limit of ${MONTHLY_LIMIT} story generations reached. Limit resets next month.`);
        setIsGenerating(false);
        return;
      }

      // --- Eligibility checks ---
      if (!selectedGame) throw new Error("no_game");
      if (selectedGame.entry_type !== "digital") throw new Error("not_digital");
      if (selectedGame.status !== "completed") throw new Error("not_completed");
      if (selectedGame.is_default_result) throw new Error("default_result");
      if (gameLogs.length === 0) throw new Error("no_logs");
      if (playerStats.length === 0) throw new Error("no_stats");

      const homeScore = selectedGame.home_score || 0;
      const awayScore = selectedGame.away_score || 0;
      if (homeScore === 0 && awayScore === 0) throw new Error("no_stats");

      // --- Build stats summary (STORY_ENGINE_V1) ---
      // Duplicate-row safety: substitution-era bugs left some players with
      // more than one stat row per game, splitting their numbers across rows.
      // groupStatsByGameAndPlayer merges them into ONE line per player, and
      // calcPoints applies the correct points formula (digital vs edited) —
      // identical to the official Statistics / Award Leaders pages.
      const buildPlayerStatsSummary = () => {
        const byGame = groupStatsByGameAndPlayer(playerStats);
        const playerMap = byGame.get(selectedGame.id) || new Map();
        return Array.from(playerMap.values()).map(ps => {
          const player = players.find(p => p.id === ps.player_id);
          const team = teams.find(t => t.id === ps.team_id);
          const pts = calcPoints(ps, selectedGame);
          return {
            player_id: ps.player_id,
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
            oreb: ps.offensive_rebounds || 0,
            dreb: ps.defensive_rebounds || 0,
          };
        });
      };

      const statsSummary = buildPlayerStatsSummary();

      const homeWon = homeScore > awayScore;
      const winnerTeam = homeWon ? homeTeam : awayTeam;
      const loserTeam = homeWon ? awayTeam : homeTeam;
      const winnerScore = homeWon ? homeScore : awayScore;
      const loserScore = homeWon ? awayScore : homeScore;
      const winnerTeamId = homeWon ? selectedGame.home_team_id : selectedGame.away_team_id;
      const loserTeamId = homeWon ? selectedGame.away_team_id : selectedGame.home_team_id;

      // --- Build activity log narrative ---
      const buildLogNarrative = () => {
        const pointEvents = gameLogs.filter(l =>
          ["points_2", "points_3", "free_throws"].includes(l.stat_type) &&
          l.new_value > l.old_value
        );

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

        let leadChanges = 0;
        let prevLead = null;
        snapshots.forEach(s => {
          const lead = s.home > s.away ? "home" : s.away > s.home ? "away" : "tied";
          if (prevLead && lead !== prevLead && lead !== "tied") leadChanges++;
          prevLead = lead;
        });

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

      // --- Clutch detection (STORY_ENGINE_V1) ---
      // Reconstructs the running score from the play-by-play and detects the
      // moments that decided the game: the unanswered go-ahead score, late
      // game-tying shots, clutch blocks/steals while the game was within 5,
      // the winner's biggest deficit, final-period lead changes, overtime.
      // Logs carry no game-clock seconds, so "late" = final period (logs
      // after June 11, 2026 carry `period`) or, for legacy games, the last
      // 25% of events — sharpened by a wall-clock window (events within
      // ~3 real minutes of the final log).
      const buildClutchInsights = () => {
        const SCORING = ["points_2", "points_3", "free_throws"];
        const homeId = selectedGame.home_team_id;
        const regulationPeriods = selectedGame.period_count || (selectedGame.period_type === "halves" ? 2 : 4);

        const periodsSeen = gameLogs.map(l => l.period).filter(p => typeof p === "number");
        const hasPeriods = periodsSeen.length > 0;
        const finalPeriod = hasPeriods ? Math.max(...periodsSeen) : null;
        const isOvertime = hasPeriods && finalPeriod > regulationPeriods;

        const lastLogTime = gameLogs.length
          ? new Date(gameLogs[gameLogs.length - 1].created_date).getTime()
          : 0;
        const CLOSING_MS = 3 * 60 * 1000;
        const legacyCutoff = Math.floor(gameLogs.length * 0.75);

        const inClosingStretch = (log, index) => {
          if (hasPeriods && typeof log.period === "number") return log.period === finalPeriod;
          return index >= legacyCutoff;
        };
        const isLateWallClock = (log) =>
          lastLogTime - new Date(log.created_date).getTime() <= CLOSING_MS;

        const playerName = (id) => players.find(p => p.id === id)?.name || "Unknown";
        const teamName = (id) => teams.find(t => t.id === id)?.name || "Unknown";

        const winnerIsHome = homeWon;
        let home = 0, away = 0;
        let prevLead = null;
        let finalPeriodLeadChanges = 0;
        let winnerMaxDeficit = 0;
        let lastGoAhead = null;
        let lastScoringEvent = null;
        const tyingShotsLate = [];
        const clutchDefense = [];

        gameLogs.forEach((l, idx) => {
          const added = l.new_value > l.old_value;
          const isScore = added && SCORING.includes(l.stat_type);
          const marginBefore = Math.abs(home - away);
          const late = inClosingStretch(l, idx);
          const wallLate = isLateWallClock(l);

          if (isScore) {
            const pts = l.stat_points ?? (l.stat_type === "points_3" ? 3 : l.stat_type === "points_2" ? 2 : 1);
            const winnerScoreBefore = winnerIsHome ? home : away;
            const loserScoreBefore = winnerIsHome ? away : home;
            if (l.team_id === homeId) home += pts; else away += pts;

            const shotLabel = l.stat_type === "points_3" ? "three-pointer"
              : l.stat_type === "free_throws" ? "free throw"
              : "two-point basket";
            const event = {
              playerName: playerName(l.player_id),
              teamName: teamName(l.team_id),
              shotLabel,
              home,
              away,
              late: late || wallLate,
            };
            lastScoringEvent = event;

            const scorerIsWinner = (l.team_id === homeId) === winnerIsHome;
            const winnerNowLeads = winnerIsHome ? home > away : away > home;
            if (scorerIsWinner && winnerScoreBefore <= loserScoreBefore && winnerNowLeads) {
              lastGoAhead = event;
            } else if (!scorerIsWinner && !winnerNowLeads) {
              lastGoAhead = null;
            }

            if (home === away && event.late) tyingShotsLate.push(event);
          } else if (added && (l.stat_type === "steals" || l.stat_type === "blocks")) {
            if ((late || wallLate) && marginBefore <= 5) {
              clutchDefense.push({
                playerName: playerName(l.player_id),
                teamName: teamName(l.team_id),
                type: l.stat_type === "steals" ? "steal" : "block",
                home,
                away,
              });
            }
          }

          const lead = home > away ? "home" : away > home ? "away" : "tied";
          if (prevLead && lead !== prevLead && lead !== "tied" && late) finalPeriodLeadChanges++;
          prevLead = lead;

          const deficit = winnerIsHome ? away - home : home - away;
          if (deficit > winnerMaxDeficit) winnerMaxDeficit = deficit;
        });

        const finalMargin = Math.abs(homeScore - awayScore);
        const decisive = (lastGoAhead && lastGoAhead.late && finalMargin <= 5) ? lastGoAhead : null;
        const finalPossessionWinner = !!(decisive && lastScoringEvent && decisive === lastScoringEvent && finalMargin <= 3);

        return {
          isOvertime,
          finalPeriodLeadChanges,
          winnerMaxDeficit,
          decisive,
          finalPossessionWinner,
          tyingShotsLate: tyingShotsLate.slice(-2),
          clutchDefense: clutchDefense.slice(-3),
          finalMargin,
        };
      };

      const clutch = buildClutchInsights();
      const hasClutch = !!(clutch.decisive || clutch.tyingShotsLate.length > 0 || clutch.clutchDefense.length > 0 || clutch.isOvertime || clutch.winnerMaxDeficit >= 10);

      const clutchSection = hasClutch ? `
CLUTCH MOMENTS DETECTED (reconstructed from the verified play-by-play log — these REALLY happened; build the story around them):
${clutch.isOvertime ? `- This game went to OVERTIME.\n` : ""}${clutch.winnerMaxDeficit >= 10 ? `- COMEBACK: ${winnerTeam?.name} trailed by as many as ${clutch.winnerMaxDeficit} points and came all the way back to win.\n` : ""}${clutch.finalPeriodLeadChanges >= 2 ? `- The lead changed hands ${clutch.finalPeriodLeadChanges} times in the closing stretch alone.\n` : ""}${clutch.tyingShotsLate.map(t => `- LATE GAME-TYING SHOT: ${t.playerName}'s ${t.shotLabel} levelled the game at ${t.home}–${t.away} for ${t.teamName}.\n`).join("")}${clutch.clutchDefense.map(d => `- CLUTCH DEFENSE: ${d.playerName} (${d.teamName}) came up with a huge ${d.type} with the score at ${d.home}–${d.away}.\n`).join("")}${clutch.decisive ? `- GAME-DECIDING PLAY: ${clutch.decisive.playerName}'s ${clutch.decisive.shotLabel} put ${clutch.decisive.teamName} ahead ${clutch.decisive.home}–${clutch.decisive.away} in the closing stretch — and the lead never changed hands again.${clutch.finalPossessionWinner ? " This was the FINAL scoring play of the game — a true game-winner on the last possession." : ""}\n` : ""}` : `
CLUTCH MOMENTS: none detected — the game was not decided by a single late play. Build the story around momentum, runs, and the standout performances instead.
`;

      const winnerStats = statsSummary.filter(s => s.team_id === winnerTeamId).sort((a, b) => b.pts - a.pts);
      const loserStats = statsSummary.filter(s => s.team_id === loserTeamId).sort((a, b) => b.pts - a.pts);

      const formatPlayerLine = (p) => {
        const parts = [`${p.pts} pts`];
        if (p.reb >= 3) parts.push(`${p.reb} reb`);
        if (p.ast >= 2) parts.push(`${p.ast} ast`);
        if (p.stl >= 1) parts.push(`${p.stl} stl`);
        if (p.blk >= 1) parts.push(`${p.blk} blk`);
        if (p.three >= 1) parts.push(`${p.three}x3PT`);
        if (p.fouls >= 4) parts.push(`${p.fouls} fouls`);
        if (p.tech >= 1) parts.push(`${p.tech} tech`);
        if (p.unsp >= 1) parts.push(`${p.unsp} unsp`);
        return `${p.name}: ${parts.join(", ")}`;
      };

      const scoreImpact = (p) => {
        let score = p.pts * 1.0;
        score += p.reb * 1.2;
        score += p.ast * 1.5;
        score += p.stl * 2.5;
        score += p.blk * 2.0;
        score -= p.to * 1.5;
        return score;
      };

      const winnerSorted = [...winnerStats].sort((a, b) => scoreImpact(b) - scoreImpact(a));
      const loserSorted = [...loserStats].sort((a, b) => scoreImpact(b) - scoreImpact(a));
      const winnerTopPlayers = winnerSorted.slice(0, 4).map(formatPlayerLine).join("\n");
      const loserTopPlayers = loserSorted.slice(0, 3).map(formatPlayerLine).join("\n");

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
        techs: loserStats.reduce((s, p) => s + p.tech, 0),
        unsp: loserStats.reduce((s, p) => s + p.unsp, 0),
      };

      const pogPlayer = players.find(p => p.id === selectedGame.player_of_game);
      const pogStat = statsSummary.find(s => s.player_id === selectedGame.player_of_game);
      const pogTeam = teams.find(t => t.id === pogPlayer?.team_id);
      const pogLine = pogPlayer
        ? `${pogPlayer.name} (#${pogPlayer.jersey_number}, ${pogTeam?.name})${pogStat ? ` — ${pogStat.pts} pts${pogStat.reb >= 1 ? ` · ${pogStat.reb} reb` : ""}${pogStat.ast >= 1 ? ` · ${pogStat.ast} ast` : ""}${pogStat.stl >= 1 ? ` · ${pogStat.stl} stl` : ""}${pogStat.blk >= 1 ? ` · ${pogStat.blk} blk` : ""}` : ""}`
        : "Not designated";

      const prompt = `You are a lively grassroots basketball reporter writing a Facebook post-game story for a local league page. You write with energy, drama, and narrative flair — like a sportswriter who watched every possession and wants the reader to feel like they were courtside.

GAME DATA:
League Game — ${safeFormatDate(selectedGame.game_date, "MMMM d, yyyy")}
Final Score: ${winnerTeam?.name} ${winnerScore} – ${loserTeam?.name} ${loserScore}
Winner: ${winnerTeam?.name}
Loser: ${loserTeam?.name}

ACTIVITY LOG INSIGHTS (use for game flow, momentum, deciding moments, and tone — NOT for player stats or score):
- Total scoring events logged: ${logInsights.totalScoringEvents}
- Lead changes detected: ${logInsights.leadChanges}
- Three-point makes tracked: ${logInsights.totalThreesLogged}
- Personal fouls logged: ${logInsights.totalFoulsLogged}
- Technical fouls: ${logInsights.totalTechsLogged}
- Unsportsmanlike fouls: ${logInsights.totalUnspLogged}
- Game feel: ${logInsights.wasLopsided ? "Winner dominated from start to finish — not a close game" : logInsights.wasClose ? "Back-and-forth contest, decided in the closing stretch" : "Winner pulled away in the second half"}
${clutchSection}
OFFICIAL VERIFIED PLAYER STATS — SOURCE OF TRUTH FOR ALL NUMBERS:
${winnerTeam?.name} TOP PERFORMERS (sorted by impact):
${winnerTopPlayers}

${loserTeam?.name} TOP PERFORMERS (sorted by impact):
${loserTopPlayers}

TEAM TOTALS:
${winnerTeam?.name}: ${winnerTeamTotals.pts} pts | ${winnerTeamTotals.reb} reb | ${winnerTeamTotals.ast} ast | ${winnerTeamTotals.stl} stl | ${winnerTeamTotals.blk} blk | ${winnerTeamTotals.three} 3PT | ${winnerTeamTotals.fouls} fouls${winnerTeamTotals.techs > 0 ? ` | ${winnerTeamTotals.techs} tech fouls` : ""}${winnerTeamTotals.unsp > 0 ? ` | ${winnerTeamTotals.unsp} unsportsmanlike` : ""}
${loserTeam?.name}: ${loserTeamTotals.pts} pts | ${loserTeamTotals.reb} reb | ${loserTeamTotals.ast} ast | ${loserTeamTotals.stl} stl | ${loserTeamTotals.blk} blk | ${loserTeamTotals.three} 3PT | ${loserTeamTotals.fouls} fouls${loserTeamTotals.techs > 0 ? ` | ${loserTeamTotals.techs} tech fouls` : ""}${loserTeamTotals.unsp > 0 ? ` | ${loserTeamTotals.unsp} unsportsmanlike` : ""}

INSTRUCTIONS — READ CAREFULLY:

Write a Facebook post-game story following this structure:

1. Start EXACTLY with: 🎙️ COURTSIDE BY AI REPORT
2. Second line: a bold one-line headline summarizing the game's story (e.g. "Mercado's 27-Point Masterclass Survives a Furious NewGen Comeback"). If a GAME-DECIDING PLAY is listed in the clutch moments, the headline MUST be built around that play and its hero.
3. Third line EXACTLY: 🏁 Final Score: ${winnerTeam?.name} ${winnerScore} – ${loserTeam?.name} ${loserScore}
4. The story (3–5 paragraphs):
   - Open with a compelling hook that drops the reader into the game's narrative — set the scene, the tension, or the turning point. Never open with a generic summary.
   - Tell the game as a STORY with momentum shifts. Use the activity log insights (lead changes, game feel) to build drama. Describe runs, swings, and sequences — not just final stat lines.
   - CLUTCH RULE: If clutch moments are listed above, they are the heart of the story. The game-deciding play gets its own dramatic build-up — set the score, the pressure, then the play itself. Commend the hero by name. Late tying shots and clutch defensive plays (blocks, steals) must be mentioned and credited by name — a block or steal that protects a 2-point lead deserves as much glory as the basket that created it. If overtime is listed, the story must convey the extra-period drama. If a comeback is listed, trace the arc from the deficit to the triumph.
   - Name the winning team's top performers (at least 2) with their real stats woven naturally into the narrative. Don't just list stats — describe HOW they scored, WHEN their plays mattered, and what role they played in the story.
   - Name the losing team's best performer(s) (at least 1) with real stats. Give them credit — describe what they did to keep their team in it and make the game competitive.
   - Identify the deciding moment or stretch — the run, the stop, the individual play that tilted the outcome. Make the reader feel the pressure.
   - If relevant, weave in non-scoring factors (rebounding edge, steals creating transition, foul trouble) as part of the story, not as a separate section.
   - BLOWOUT RULE: The margin of victory is ${Math.abs(winnerScore - loserScore)} points. ${Math.abs(winnerScore - loserScore) >= 40 ? `This is a HUMILIATING blowout of 40+ points. You MUST dedicate at least one full paragraph to hilariously roasting the losing team. Be savage, funny, and relentless — think trash talk from a friend who just watched the game. Use jokes, sarcasm, and vivid comedy to describe how badly they got destroyed. Examples of tone: "They didn't just lose — they got erased from existence," "The scoreboard ran out of sympathy long before the final buzzer," "Somewhere, their jerseys are filing a missing persons report." Keep it fun and never mean-spirited about individuals, but absolutely savage about the team performance as a whole.` : `Normal margin — no blowout roast needed.`}
   - Close with a punchy final line — something that captures the emotion of the result and sticks with the reader.
5. After the story, add: 🏆 PLAYER OF THE GAME: [Name] (#[Jersey], [Team]) — [Key stats in format: PTS · REB · AST or whatever stats define their impact]
   IMPORTANT: The Player of the Game has already been officially designated. You MUST use: ${pogLine}. Do NOT choose a different player.
6. End EXACTLY with: 👉 Full box score & stats: https://courtside-by-ai.com/schedule

WRITING STYLE:
- Write like a sportswriter, not a stats bot. Use vivid, active language: "drilled," "ripped away," "erupted," "buried the dagger."
- Use metaphors and energy: "turned sniper," "heart of a lion," "the script got torn up."
- Vary sentence length — short punchy lines for impact, longer flowing ones for narrative buildup.
- Emojis should feel natural and sparing (2–4 total in the body, not on every line).
- Tone: upbeat, exciting, and respectful of both teams. Grassroots basketball deserves big-stage storytelling.
- 200–350 words in the body (between the final score line and the Player of the Game).
- NEVER use filler phrases like "if you weren't there, you missed something special" or "both teams fought hard" without specifics backing it up.
- Vary the story angle, phrasing, and structure every time so no two recaps feel like templates.

MANDATORY RULES:
- ONLY use numbers from the OFFICIAL VERIFIED PLAYER STATS above — never invent or estimate stats
- ONLY describe clutch moments that are explicitly listed in the CLUTCH MOMENTS section — never invent a buzzer-beater, game-winner, or clutch play that is not listed
- NEVER state an exact clock time (like "with 4 seconds left") — the game clock is not tracked in the log. Say "in the closing stretch," "on the final possession," or "in the dying moments" instead
- NEVER mention free throw percentage, free throw accuracy, or "perfect from the line" — free throw misses are not tracked in this league
- NEVER swap winner and loser or reverse the score
- Mention at least 2 winning team players and at least 1 losing team player BY NAME with REAL stats
- Select players based on actual impact (points, rebounds, assists, steals, double-doubles, or clutch context)
- When a player has a notable double-double or near-double-double, call it out
- DO NOT include any meta-commentary, preamble, or explanation — start directly with 🎙️ COURTSIDE BY AI REPORT`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: "claude_sonnet_4_6",
      });

      setStory(typeof result === "string" ? result : JSON.stringify(result));

      // --- Track usage (league_admin only) ---
      if (storyIsLeagueAdmin && !storyIsAppAdmin) {
        if (usageCounter) {
          await base44.entities.AIUsageCounter.update(usageCounter.id, {
            briefings_generated: briefingsUsed + 1
          });
        } else {
          await base44.entities.AIUsageCounter.create({
            league_id: selectedLeagueId,
            month_year: currentMonthYear,
            briefings_generated: 1,
            monthly_limit: MONTHLY_LIMIT
          });
        }
        refetchUsage();
      }
    } catch (err) {
      setError("Story cannot be generated because the required digital game log or verified saved stats are missing for this game.");
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

  if (currentUser && !storyIsAppAdmin && !storyIsLeagueAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">You don't have permission to view this page.</p>
      </div>
    );
  }

  const getGameLabel = (g) => {
    const home = teams.find(t => t.id === g.home_team_id);
    const away = teams.find(t => t.id === g.away_team_id);
    return `${home?.name || "?"} vs ${away?.name || "?"} — ${safeFormatDate(g.game_date, "MMM d, yyyy")}`;
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Newspaper className="w-6 h-6 text-orange-500" />
              Story Builder
              <HelpButton pageKey="storybuilder" />
            </h1>
            <p className="text-slate-500 text-sm mt-1">Generate a Facebook-ready post-game story powered by AI.</p>
          </div>
          {storyIsLeagueAdmin && !storyIsAppAdmin && (
            <div className={`flex flex-col items-end gap-1 px-4 py-3 rounded-xl border-2 ${
              hasReachedLimit ? "border-red-200 bg-red-50" : briefingsRemaining <= 5 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"
            }`}>
              <p className={`text-2xl font-bold ${
                hasReachedLimit ? "text-red-600" : briefingsRemaining <= 5 ? "text-amber-600" : "text-green-600"
              }`}>{briefingsRemaining}</p>
              <p className="text-xs font-semibold text-slate-500 whitespace-nowrap">of {MONTHLY_LIMIT} left this month</p>
            </div>
          )}
        </div>
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
                {[...visibleLeagues].sort((a, b) => a.name.localeCompare(b.name)).map(l => (
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
          disabled={!selectedGameId || isGenerating || hasReachedLimit}
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
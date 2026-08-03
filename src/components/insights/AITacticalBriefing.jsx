import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sparkles, RefreshCw, Calendar, Shield, Target, AlertCircle, X, Copy, Check } from "lucide-react";
import BriefingRenderer from "@/components/insights/BriefingRenderer";
import { format } from "date-fns";

// COACH_BRIEF_V2 — rewritten briefing prompt, explicit model, on-page error
// banner (window.alert is blocked inside the base44 iframe), and a much wider
// data set: both rosters, points allowed, three-point volume, head-to-head,
// recent form and venue.
export default function AITacticalBriefing({
  selectedLeague,
  selectedTeam,
  selectedOpponent,
  selectedTeamName,
  selectedOpponentName,
  winLossComparison,
  opponentSnapshot,
  last3GamesTrend,
  currentUser,
  excludeTurnovers = false,
  teamSeasonAverages = null,
  playerRankings = [],
  keyInsight = null,
  headToHead = [],
  recentResults = [],
  nextMeeting = null,
  leagueName = "",
}) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const userEmail = currentUser?.email;

  // Fetch existing briefing
  const { data: existingBriefings = [] } = useQuery({
    queryKey: ['tacticalBriefing', selectedTeam, selectedOpponent],
    queryFn: () => base44.entities.TacticalBriefing.filter({
      team_id: selectedTeam,
      opponent_id: selectedOpponent
    }),
    enabled: !!selectedTeam && !!selectedOpponent,
  });

  // Fetch usage counter (per user per month)
  const currentMonthYear = format(new Date(), 'yyyy-MM');
  const { data: usageCounters = [] } = useQuery({
    queryKey: ['aiUsageCounter', userEmail, currentMonthYear],
    queryFn: () => base44.entities.AIUsageCounter.filter({
      created_by: userEmail,
      month_year: currentMonthYear
    }),
    enabled: !!userEmail,
  });

  const usageCounter = usageCounters[0];
  const briefingsUsed = usageCounter?.briefings_generated || 0;
  const monthlyLimit = 10;
  const briefingsRemaining = monthlyLimit - briefingsUsed;
  const hasReachedLimit = briefingsUsed >= monthlyLimit;

  const latestBriefing = existingBriefings.sort((a, b) =>
    new Date(b.generated_date) - new Date(a.generated_date)
  )[0];

  // Generate briefing mutation
  const generateBriefingMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      setErrorMsg("");
      setLoadingStep(0);

      // Staged loading messages
      const loadingMessages = [
        "🧠 Analyzing win/loss performance patterns…",
        "📊 Reviewing opponent statistical trends…",
        "🎯 Building tactical recommendations…"
      ];

      for (let i = 0; i < loadingMessages.length; i++) {
        setLoadingStep(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // ------------------------------------------------------------------
      // COACH_BRIEF_V2 — data assembly
      // ------------------------------------------------------------------
      const n1 = (v) => (v === null || v === undefined || Number.isNaN(Number(v)))
        ? "n/a"
        : Number(v).toFixed(1);

      const fmtRoster = (list, limit = 12) => {
        const rows = (list || []).slice(0, limit);
        if (rows.length === 0) return "No player data available for this team.";
        return rows.map(p =>
          `${p.name}${p.jerseyNumber ? ` #${p.jerseyNumber}` : ""} | ${p.ppg} pts | ${p.rpg} reb | ${p.apg} ast | ${p.spg} stl | ${p.bpg} blk | ${p.tpg} threes | ${p.fpg} fouls | ${p.gamesPlayed} games`
        ).join("\n");
      };

      const ourRoster = [...(playerRankings || [])]
        .sort((a, b) => parseFloat(b.ppg) - parseFloat(a.ppg));

      const winsCount = winLossComparison?.wins.count || 0;
      const lossesCount = winLossComparison?.losses.count || 0;
      const totalGames = winsCount + lossesCount;

      const teamData = {
        teamName: selectedTeamName,
        winsCount,
        lossesCount,
        avgPointsWins: winLossComparison?.wins.stats.points || 0,
        avgPointsLosses: winLossComparison?.losses.stats.points || 0,
        avgAssistsWins: winLossComparison?.wins.stats.assists || 0,
        avgAssistsLosses: winLossComparison?.losses.stats.assists || 0,
        reboundMarginWins: winLossComparison?.wins.stats.reboundMargin || 0,
        reboundMarginLosses: winLossComparison?.losses.stats.reboundMargin || 0,
        ...(excludeTurnovers ? {} : {
          avgTurnoversWins: winLossComparison?.wins.stats.turnovers || 0,
          avgTurnoversLosses: winLossComparison?.losses.stats.turnovers || 0,
        }),
        last3Points: last3GamesTrend?.points || 0,
        last3Assists: last3GamesTrend?.assists || 0,
        last3ReboundMargin: last3GamesTrend?.reboundMargin || 0,
        ...(excludeTurnovers ? {} : { last3Turnovers: last3GamesTrend?.turnovers || 0 }),
      };

      const opponentData = {
        opponentName: selectedOpponentName,
        avgPoints: opponentSnapshot?.avgPoints || 0,
        avgPointsAllowed: opponentSnapshot?.avgPointsAllowed || 0,
        avgRebounds: opponentSnapshot?.avgRebounds || 0,
        avgThrees: opponentSnapshot?.avgThrees || 0,
        ...(excludeTurnovers ? {} : { avgTurnovers: opponentSnapshot?.avgTurnovers || 0 }),
        topScorerName: opponentSnapshot?.topScorer?.name || 'N/A',
        topScorerPPG: opponentSnapshot?.topScorer?.ppg || 0,
        topDefenderName: opponentSnapshot?.topDefender?.name || 'N/A',
        topDefenderDefense: opponentSnapshot?.topDefender?.defensiveScore || 0,
        record: opponentSnapshot?.record || 'unknown',
        gamesPlayed: opponentSnapshot?.gamesPlayed || 0,
      };

      const venueLine = nextMeeting?.venue
        ? `We are ${nextMeeting.venue === 'Home' ? 'at home' : 'away'} for this one.`
        : "Venue not scheduled yet — do not refer to home or away advantage.";

      const h2hBlock = (headToHead && headToHead.length > 0)
        ? headToHead.join("\n")
        : "No previous meetings on record.";

      const formBlock = (recentResults && recentResults.length > 0)
        ? recentResults.join(", ")
        : "No completed games on record.";

      const oppFormBlock = (opponentSnapshot?.recentForm && opponentSnapshot.recentForm.length > 0)
        ? opponentSnapshot.recentForm.join(", ")
        : "No recent games on record.";

      const momentum = last3GamesTrend?.momentum || {};

      // ------------------------------------------------------------------
      // COACH_BRIEF_V2 — the prompt
      // ------------------------------------------------------------------
      const prompt = `You are an experienced assistant coach preparing a scouting report for an amateur, community-level basketball team. Your reader is a volunteer head coach reading this on a phone in the twenty minutes before tip-off. Write like a coach talking to a coach: direct, specific, immediately usable. Not like an analyst writing a report.

===============================================================
GAME
===============================================================
US: ${teamData.teamName}
THEM: ${opponentData.opponentName}
Competition: ${leagueName || 'league season'}
${venueLine}

===============================================================
OUR SEASON — ${teamData.winsCount}W-${teamData.lossesCount}L across ${totalGames} games
===============================================================
Scored per game: ${n1(teamSeasonAverages?.points)}
Allowed per game: ${n1(teamSeasonAverages?.pointsAllowed)}
Assists per game: ${n1(teamSeasonAverages?.assists)}
Rebound margin: ${n1(teamSeasonAverages?.reboundMargin)}
Threes made per game: ${n1(teamSeasonAverages?.threes)}${excludeTurnovers ? '' : `
Turnovers per game: ${n1(teamSeasonAverages?.turnovers)}`}

WHAT CHANGES BETWEEN OUR WINS AND OUR LOSSES
This is the most important block below. Every number here is a real pattern from our own games.
                     IN WINS (${teamData.winsCount})   IN LOSSES (${teamData.lossesCount})
Points scored        ${teamData.avgPointsWins}   ${teamData.avgPointsLosses}
Assists              ${teamData.avgAssistsWins}   ${teamData.avgAssistsLosses}
Rebound margin       ${teamData.reboundMarginWins}   ${teamData.reboundMarginLosses}${excludeTurnovers ? '' : `
Turnovers            ${teamData.avgTurnoversWins}   ${teamData.avgTurnoversLosses}`}
Statistically the widest gap, adjusted for how much each stat naturally varies game to game: ${keyInsight?.metric || 'not enough data to tell'}

OUR RECENT FORM
Last ${last3GamesTrend?.gamesCount || 0} games: ${teamData.last3Points} points (trend ${momentum.points || 'unknown'}), ${teamData.last3Assists} assists, ${teamData.last3ReboundMargin} rebound margin (trend ${momentum.rebounds || 'unknown'})${excludeTurnovers ? '' : `, ${teamData.last3Turnovers} turnovers (trend ${momentum.turnovers || 'unknown'})`}
Recent results, newest first: ${formBlock}

===============================================================
OUR ROSTER — season averages
===============================================================
Name | points | rebounds | assists | steals | blocks | threes made | fouls | games played
${fmtRoster(ourRoster)}

===============================================================
THEM — ${opponentData.opponentName}, ${opponentData.record} across ${opponentData.gamesPlayed} games
===============================================================
Scored per game: ${opponentData.avgPoints}
Allowed per game: ${opponentData.avgPointsAllowed}
Rebounds per game: ${opponentData.avgRebounds}
Threes made per game: ${opponentData.avgThrees}${excludeTurnovers ? '' : `
Turnovers per game: ${opponentData.avgTurnovers}`}
Their leading scorer: ${opponentData.topScorerName} (${opponentData.topScorerPPG} per game)
Their most disruptive defender: ${opponentData.topDefenderName} (${opponentData.topDefenderDefense} steals plus blocks per game)
Their recent results, newest first: ${oppFormBlock}

THEIR ROSTER — season averages
Name | points | rebounds | assists | steals | blocks | threes made | fouls | games played
${fmtRoster(opponentSnapshot?.roster)}

===============================================================
HEAD-TO-HEAD
===============================================================
${h2hBlock}

===============================================================
HARD RULES — breaking any of these makes the briefing worthless
===============================================================
1. Use ONLY the numbers and names listed above. If a player is not on a roster list above, that player does not exist. Never invent a name, a result or a number.
2. This league does not record shot attempts. NEVER mention field goal percentage, three-point percentage, free throw percentage, shooting efficiency or any percentage statistic. Talk in makes and volume instead.
3. Never state a game clock time, a quarter, or a score situation you were not given. You did not watch these games.
4. Never describe a playing style you cannot see in the numbers. You may say a team shoots a lot of threes if the threes number supports it. You may NOT say they run a zone, press, or push in transition — none of that is in the data.
5. Sample size honesty. If we have played fewer than four games, or have fewer than two wins, or fewer than two losses, treat the win/loss split as a weak signal and say so plainly. If the opponent has played fewer than three games, say their profile is thin. Never present a small-sample pattern as a certainty.
6. Every tactical instruction must be tied to a specific number from above. "Control the glass" is banned. "Control the glass — we are plus 6.4 on the boards in wins and minus 2.3 in losses" is what we want.
7. No motivational language. No "leave it all on the floor", no "execute with discipline", no closing pep talk of any kind.
8. Instructions must be things an amateur team can actually do: who guards who, who gets the ball, what to crash, when to foul, when to slow the game down. No professional scheme jargon.
9. If a section genuinely has no data behind it, say so in one short line rather than filling it with guesses.
10. A whole-team average of exactly 0.0 for any statistic means that statistic is not being recorded in this league. It does NOT mean the team is perfect at it. Never present a 0.0 team average as a strength, a weakness, a concern or a talking point — leave it out of the briefing entirely.${excludeTurnovers ? `
11. This league does NOT track turnovers. Never mention turnovers, ball security, giveaways, or taking care of the ball anywhere in the briefing, and never refer to a turnover number even to say it is missing.` : ''}

===============================================================
OUTPUT — use this exact structure and these exact headings
===============================================================

🎯 THE GAME IN ONE LINE
One sentence describing how we win this specific game. It must contain a number.

🔑 HOW WE WIN THIS ONE
Three bullets. Each one gives the instruction first, then the number that justifies it. Order them by how strongly the numbers support them.

🕵️ WHO THEY ARE
Three bullets describing this opponent as a team: how they score, where they are strong, where they are soft. Numbers only, no invented style.

🥊 MATCHUPS
Two or three lines, each in this shape:
[Our player name] on [Their player name] — [one line reason built on their numbers]
Choose our defenders using steals, blocks and foul averages. Flag any of our players averaging 3.5 or more fouls per game as a foul-trouble risk and name the backup. If we have no suitable defender for their leading scorer, say so honestly and suggest a team solution instead.

⏱️ FIRST FIVE MINUTES
Three specific things to do from the opening tip. Concrete actions, not goals.

⚠️ WHAT COULD LOSE THIS
Two bullets. Write each one on a single line in exactly this shape, including the two capitalised labels:
IF: [the warning sign to watch for during the game] THEN: [what to change the moment it appears]

📋 CONFIDENCE
One or two sentences stating plainly how much data this briefing rests on and which part of it is least reliable. A coach who knows a read is weak is better off than one who trusts it blindly.

Total length under 500 words. No preamble, no sign-off. Start directly with 🎯.`;

      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        model: "claude_sonnet_4_6",
      });

      // Save briefing to database
      const briefingData = {
        league_id: selectedLeague,
        team_id: selectedTeam,
        opponent_id: selectedOpponent,
        briefing_content: typeof llmResponse === "string" ? llmResponse : JSON.stringify(llmResponse),
        generated_date: new Date().toISOString(),
        team_data: teamData,
        opponent_data: opponentData,
      };

      await base44.entities.TacticalBriefing.create(briefingData);

      // BRIEFING_COUNTER_FIX_V1: counter failure must not fail a successful briefing
      try {
        if (usageCounter) {
          await base44.entities.AIUsageCounter.update(usageCounter.id, {
            briefings_generated: briefingsUsed + 1
          });
        } else {
          await base44.entities.AIUsageCounter.create({
            league_id: selectedLeague,
            month_year: currentMonthYear,
            briefings_generated: 1,
            monthly_limit: 10
          });
        }
      } catch (counterError) {
        console.warn('BRIEFING_COUNTER_FIX_V1: usage counter write failed', counterError);
      }

      return briefingData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tacticalBriefing'] });
      queryClient.invalidateQueries({ queryKey: ['aiUsageCounter'] });
      setIsGenerating(false);
      setShowConfirmDialog(false);
    },
    onError: (error) => {
      console.error('Error generating briefing:', error);
      // COACH_BRIEF_V2 — window.alert is blocked in the base44 iframe, so the
      // old alert() calls silently showed the user nothing at all.
      setErrorMsg('Could not generate the briefing: ' + (error?.message || 'unknown error') + '. Please try again.');
      setIsGenerating(false);
      setShowConfirmDialog(false);
    }
  });

  const handleGenerate = () => {
    if (hasReachedLimit) {
      setErrorMsg(`Monthly limit of ${monthlyLimit} AI briefings reached. The limit resets next month.`);
      return;
    }
    setErrorMsg("");
    setShowConfirmDialog(true);
  };

  const handleConfirmGenerate = () => {
    generateBriefingMutation.mutate();
  };

  // BRIEF_VISUAL_V1 — copy the plain text so a coach can paste it into a team
  // chat. Clipboard is used elsewhere in the app and works inside base44.
  const handleCopy = () => {
    const content = latestBriefing?.briefing_content || "";
    if (!content) return;
    navigator.clipboard.writeText(content).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setErrorMsg("Could not copy to the clipboard. Please select the text manually.")
    );
  };

  const loadingMessages = [
    "🧠 Analyzing win/loss performance patterns…",
    "📊 Reviewing opponent statistical trends…",
    "🎯 Building tactical recommendations…"
  ];

  // Don't show if no opponent selected
  if (!selectedOpponent) return null;

  return (
    <Card className="border-2 border-purple-300 shadow-xl bg-gradient-to-br from-purple-50 to-indigo-50">
      <CardHeader className="border-b border-purple-200">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-purple-900">
              <Sparkles className="w-6 h-6 text-purple-600" />
              AI Tactical Briefing — Premium Feature
            </CardTitle>
            <p className="text-sm text-purple-700 mt-1">Powered by advanced AI analysis</p>
          </div>
          {!hasReachedLimit && (
            <Badge className="bg-purple-100 text-purple-800">
              {briefingsRemaining} remaining this month
            </Badge>
          )}
          {hasReachedLimit && (
            <Badge className="bg-red-100 text-red-800">
              Limit reached
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* COACH_BRIEF_V2 — on-page error banner replaces the blocked alert() */}
        {errorMsg && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border-2 border-red-300 bg-red-50 p-4">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800 flex-1">{errorMsg}</p>
            <button
              type="button"
              onClick={() => setErrorMsg("")}
              className="text-red-600 hover:text-red-800"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {isGenerating ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <p className="text-lg font-semibold text-purple-900 mb-2">{loadingMessages[loadingStep]}</p>
            <p className="text-sm text-slate-600">Please wait...</p>
          </div>
        ) : latestBriefing ? (
          <div className="space-y-6">
            {/* Briefing Header */}
            <div className="bg-white rounded-lg p-4 border-2 border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-600" />
                  <span className="font-bold text-lg text-slate-900">vs {selectedOpponentName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4" />
                  Generated: {format(new Date(latestBriefing.generated_date), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
            </div>

            {/* BRIEF_VISUAL_V1 — cards and charts instead of raw text. Every
                chart is drawn from data already on this page, so the display
                change costs nothing extra in AI usage. */}
            <BriefingRenderer
              text={latestBriefing.briefing_content}
              generatedDate={format(new Date(latestBriefing.generated_date), 'd MMM yyyy, HH:mm')}
              selectedTeamName={selectedTeamName}
              selectedOpponentName={selectedOpponentName}
              winLossComparison={winLossComparison}
              opponentSnapshot={opponentSnapshot}
              teamSeasonAverages={teamSeasonAverages}
              playerRankings={playerRankings}
              excludeTurnovers={excludeTurnovers}
            />

            {/* Actions */}
            <div className="flex justify-center gap-3">
              <Button
                onClick={handleCopy}
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied' : 'Copy text'}
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={hasReachedLimit}
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate Briefing
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              <Target className="w-10 h-10 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Generate AI Tactical Briefing
              </h3>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                Get advanced tactical insights and strategic recommendations for your upcoming matchup against <span className="font-semibold text-purple-700">{selectedOpponentName}</span>
              </p>
              <Button
                onClick={handleGenerate}
                disabled={hasReachedLimit}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8 py-6 text-lg shadow-lg"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Generate AI Tactical Briefing
              </Button>
              {hasReachedLimit && (
                <p className="text-sm text-red-600 mt-4">Monthly limit reached. Resets next month.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Generate AI Tactical Briefing?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-4">
              <p>This will analyze win/loss patterns, both rosters, opponent trends and recent form to generate a tactical briefing for your matchup against <span className="font-semibold">{selectedOpponentName}</span>.</p>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-purple-900 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {briefingsRemaining - 1} of {monthlyLimit} AI briefings will remain this month
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isGenerating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmGenerate}
              disabled={isGenerating}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {isGenerating ? 'Generating...' : 'Generate Briefing'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
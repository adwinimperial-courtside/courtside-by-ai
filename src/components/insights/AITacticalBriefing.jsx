import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sparkles, RefreshCw, Calendar, Shield, Target, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function AITacticalBriefing({ 
  selectedLeague, 
  selectedTeam, 
  selectedOpponent,
  selectedTeamName,
  selectedOpponentName,
  winLossComparison,
  opponentSnapshot,
  last3GamesTrend
}) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const queryClient = useQueryClient();

  // Fetch existing briefing
  const { data: existingBriefings = [] } = useQuery({
    queryKey: ['tacticalBriefing', selectedTeam, selectedOpponent],
    queryFn: () => base44.entities.TacticalBriefing.filter({
      team_id: selectedTeam,
      opponent_id: selectedOpponent
    }),
    enabled: !!selectedTeam && !!selectedOpponent,
  });

  // Fetch usage counter
  const currentMonthYear = format(new Date(), 'yyyy-MM');
  const { data: usageCounters = [] } = useQuery({
    queryKey: ['aiUsageCounter', selectedLeague, currentMonthYear],
    queryFn: () => base44.entities.AIUsageCounter.filter({
      league_id: selectedLeague,
      month_year: currentMonthYear
    }),
    enabled: !!selectedLeague,
  });

  const usageCounter = usageCounters[0];
  const briefingsUsed = usageCounter?.briefings_generated || 0;
  const monthlyLimit = usageCounter?.monthly_limit || 10;
  const briefingsRemaining = monthlyLimit - briefingsUsed;
  const hasReachedLimit = briefingsUsed >= monthlyLimit;

  const latestBriefing = existingBriefings.sort((a, b) => 
    new Date(b.generated_date) - new Date(a.generated_date)
  )[0];

  // Generate briefing mutation
  const generateBriefingMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
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

      // Prepare data for LLM
      const teamData = {
        teamName: selectedTeamName,
        winsCount: winLossComparison?.wins.count || 0,
        lossesCount: winLossComparison?.losses.count || 0,
        avgPointsWins: winLossComparison?.wins.stats.points || 0,
        avgPointsLosses: winLossComparison?.losses.stats.points || 0,
        avgAssistsWins: winLossComparison?.wins.stats.assists || 0,
        avgAssistsLosses: winLossComparison?.losses.stats.assists || 0,
        reboundMarginWins: winLossComparison?.wins.stats.reboundMargin || 0,
        reboundMarginLosses: winLossComparison?.losses.stats.reboundMargin || 0,
        avgTurnoversWins: winLossComparison?.wins.stats.turnovers || 0,
        avgTurnoversLosses: winLossComparison?.losses.stats.turnovers || 0,
        last3Points: last3GamesTrend?.points || 0,
        last3Assists: last3GamesTrend?.assists || 0,
        last3ReboundMargin: last3GamesTrend?.reboundMargin || 0,
        last3Turnovers: last3GamesTrend?.turnovers || 0,
      };

      const opponentData = {
        opponentName: selectedOpponentName,
        avgPoints: opponentSnapshot?.avgPoints || 0,
        avgRebounds: opponentSnapshot?.avgRebounds || 0,
        avgTurnovers: opponentSnapshot?.avgTurnovers || 0,
        topScorerName: opponentSnapshot?.topScorer?.name || 'N/A',
        topScorerPPG: opponentSnapshot?.topScorer?.ppg || 0,
        topDefenderName: opponentSnapshot?.topDefender?.name || 'N/A',
        topDefenderDefense: opponentSnapshot?.topDefender?.defensiveScore || 0,
      };

      // Call LLM
      const prompt = `You are a professional basketball tactical analyst. Generate a concise tactical briefing for an upcoming game.

TEAM DATA (${teamData.teamName}):
- Record: ${teamData.winsCount}W - ${teamData.lossesCount}L
- In Wins: ${teamData.avgPointsWins} PPG, ${teamData.avgAssistsWins} APG, ${teamData.reboundMarginWins} REB Margin, ${teamData.avgTurnoversWins} TO
- In Losses: ${teamData.avgPointsLosses} PPG, ${teamData.avgAssistsLosses} APG, ${teamData.reboundMarginLosses} REB Margin, ${teamData.avgTurnoversLosses} TO
- Last 3 Games: ${teamData.last3Points} PPG, ${teamData.last3Assists} APG, ${teamData.last3ReboundMargin} REB Margin, ${teamData.last3Turnovers} TO

OPPONENT DATA (${opponentData.opponentName}):
- Avg Points: ${opponentData.avgPoints}
- Avg Rebounds: ${opponentData.avgRebounds}
- Avg Turnovers: ${opponentData.avgTurnovers}
- Top Scorer: ${opponentData.topScorerName} (${opponentData.topScorerPPG} PPG)
- Top Defender: ${opponentData.topDefenderName} (${opponentData.topDefenderDefense} STL+BLK)

Generate a tactical briefing in this EXACT format:

🎯 Key Strategic Priorities

• [Priority 1 based on largest statistical gap]
• [Priority 2]
• [Priority 3]

⚠️ Risk Indicators

• [Statistical weakness warning]
• [Opponent threat warning]

🏆 Winning Identity Reminder

When you win, you average:
• ${teamData.avgPointsWins} points
• ${teamData.reboundMarginWins} rebound margin
• ${teamData.avgAssistsWins} assists
• ${teamData.avgTurnoversWins} turnovers

Keep output:
- Tactical and professional
- Concise bullet points
- No fluff or generic motivational language
- Maximum 8 total bullet points`;

      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
      });

      // Save briefing to database
      const briefingData = {
        league_id: selectedLeague,
        team_id: selectedTeam,
        opponent_id: selectedOpponent,
        briefing_content: llmResponse,
        generated_date: new Date().toISOString(),
        team_data: teamData,
        opponent_data: opponentData,
      };

      await base44.entities.TacticalBriefing.create(briefingData);

      // Update or create usage counter
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
      alert('Failed to generate briefing. Please try again.');
      setIsGenerating(false);
      setShowConfirmDialog(false);
    }
  });

  const handleGenerate = () => {
    if (hasReachedLimit) {
      alert(`Monthly limit of ${monthlyLimit} AI briefings reached. Limit resets next month.`);
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmGenerate = () => {
    generateBriefingMutation.mutate();
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

            {/* Briefing Content */}
            <div className="bg-white rounded-lg p-6 border-2 border-purple-200">
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-slate-800 leading-relaxed">
                  {latestBriefing.briefing_content}
                </div>
              </div>
            </div>

            {/* Regenerate Button */}
            <div className="flex justify-center">
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
              <p>This will analyze win/loss patterns, opponent trends, and recent performance to generate a tactical briefing for your matchup against <span className="font-semibold">{selectedOpponentName}</span>.</p>
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
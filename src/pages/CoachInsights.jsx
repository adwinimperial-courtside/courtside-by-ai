import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, Users, Trophy, Shield, ArrowUpDown, AlertCircle, Lightbulb, Minus, Plus } from "lucide-react";
import AITacticalBriefing from "../components/insights/AITacticalBriefing";

// Leagues where turnovers are not tracked / should be excluded
const LEAGUES_NO_TURNOVERS = ['698c39d164c376418918321d', '698b4d0c05fbeef938b93720'];

export default function CoachInsights() {
  const [selectedLeague, setSelectedLeague] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedOpponent, setSelectedOpponent] = useState("");
  const [sortBy, setSortBy] = useState("impact");

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

  const { data: games = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => base44.entities.Game.list(),
  });

  const { data: playerStats = [] } = useQuery({
    queryKey: ['playerStats'],
    queryFn: () => base44.entities.PlayerStats.list(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list(),
  });

  if (currentUser && currentUser.user_type === 'viewer') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="text-center">
          <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Access Restricted</h2>
          <p className="text-slate-500">Coach Insights is not available for viewers.</p>
        </div>
      </div>
    );
  }

  const filteredLeagues = currentUser?.user_type !== 'app_admin' && currentUser?.assigned_league_ids?.length
    ? leagues.filter(league => currentUser.assigned_league_ids.includes(league.id))
    : leagues;

  React.useEffect(() => {
    if (!selectedLeague && currentUser?.default_league_id) {
      setSelectedLeague(currentUser.default_league_id);
    }
  }, [currentUser, selectedLeague]);

  // Whether turnovers should be excluded for the selected league
  const excludeTurnovers = LEAGUES_NO_TURNOVERS.includes(selectedLeague);

  const leagueTeams = useMemo(() => 
    teams.filter(t => t.league_id === selectedLeague),
    [teams, selectedLeague]
  );

  const teamGames = useMemo(() => {
    if (!selectedTeam) return [];
    return games.filter(g => 
      g.status === 'completed' && 
      (g.home_team_id === selectedTeam || g.away_team_id === selectedTeam)
    );
  }, [games, selectedTeam]);

  // Win vs Loss Comparison
  const winLossComparison = useMemo(() => {
    if (!selectedTeam || teamGames.length === 0) return null;

    const wins = teamGames.filter(g => 
      (g.home_team_id === selectedTeam && g.home_score > g.away_score) ||
      (g.away_team_id === selectedTeam && g.away_score > g.home_score)
    );

    const losses = teamGames.filter(g => 
      (g.home_team_id === selectedTeam && g.home_score < g.away_score) ||
      (g.away_team_id === selectedTeam && g.away_score < g.home_score)
    );

    const calculateGameStats = (gameList) => {
      if (gameList.length === 0) return { points: 0, assists: 0, reboundMargin: 0, turnovers: 0 };

      let totalPoints = 0, totalAssists = 0, totalRebounds = 0, totalOppRebounds = 0, totalTurnovers = 0;

      gameList.forEach(game => {
        const isHome = game.home_team_id === selectedTeam;
        const teamScore = isHome ? game.home_score : game.away_score;
        const gameStats = playerStats.filter(s => s.game_id === game.id && s.team_id === selectedTeam);
        const oppStats = playerStats.filter(s => s.game_id === game.id && s.team_id !== selectedTeam);

        totalPoints += teamScore;
        totalAssists += gameStats.reduce((sum, s) => sum + (s.assists || 0), 0);
        totalRebounds += gameStats.reduce((sum, s) => sum + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0);
        totalOppRebounds += oppStats.reduce((sum, s) => sum + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0);
        if (!excludeTurnovers) {
          totalTurnovers += gameStats.reduce((sum, s) => sum + (s.turnovers || 0), 0);
        }
      });

      return {
        points: (totalPoints / gameList.length).toFixed(1),
        assists: (totalAssists / gameList.length).toFixed(1),
        reboundMargin: ((totalRebounds - totalOppRebounds) / gameList.length).toFixed(1),
        turnovers: excludeTurnovers ? null : (totalTurnovers / gameList.length).toFixed(1),
      };
    };

    return {
      wins: { count: wins.length, stats: calculateGameStats(wins) },
      losses: { count: losses.length, stats: calculateGameStats(losses) }
    };
  }, [selectedTeam, teamGames, playerStats, excludeTurnovers]);

  // Rebounding Differential
  const reboundDifferential = useMemo(() => {
    if (!selectedTeam || teamGames.length === 0) return null;

    let totalMargin = 0;
    teamGames.forEach(game => {
      const teamRebounds = playerStats
        .filter(s => s.game_id === game.id && s.team_id === selectedTeam)
        .reduce((sum, s) => sum + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0);
      
      const oppRebounds = playerStats
        .filter(s => s.game_id === game.id && s.team_id !== selectedTeam)
        .reduce((sum, s) => sum + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0);

      totalMargin += (teamRebounds - oppRebounds);
    });

    const avgMargin = (totalMargin / teamGames.length).toFixed(1);
    return { margin: avgMargin, isPositive: avgMargin > 0 };
  }, [selectedTeam, teamGames, playerStats]);

  // Opponent Snapshot
  const opponentSnapshot = useMemo(() => {
    if (!selectedOpponent) return null;

    const oppGames = games.filter(g => 
      g.status === 'completed' && 
      (g.home_team_id === selectedOpponent || g.away_team_id === selectedOpponent)
    );

    if (oppGames.length === 0) return null;

    let totalPoints = 0, totalRebounds = 0, totalTurnovers = 0;

    oppGames.forEach(game => {
      const isHome = game.home_team_id === selectedOpponent;
      totalPoints += isHome ? game.home_score : game.away_score;

      const gameStats = playerStats.filter(s => s.game_id === game.id && s.team_id === selectedOpponent);
      totalRebounds += gameStats.reduce((sum, s) => sum + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0);
      if (!excludeTurnovers) {
        totalTurnovers += gameStats.reduce((sum, s) => sum + (s.turnovers || 0), 0);
      }
    });

    const oppPlayers = players.filter(p => p.team_id === selectedOpponent);
    const playerAverages = oppPlayers.map(player => {
      const pStats = playerStats.filter(s => s.player_id === player.id);
      const gamesPlayed = pStats.length;
      
      if (gamesPlayed === 0) return null;

      const totalPts = pStats.reduce((sum, s) => sum + ((s.points_2 || 0) * 2) + ((s.points_3 || 0) * 3) + (s.free_throws || 0), 0);
      const defensiveScore = pStats.reduce((sum, s) => sum + (s.steals || 0) + (s.blocks || 0), 0);

      return {
        id: player.id,
        name: player.name,
        ppg: (totalPts / gamesPlayed).toFixed(1),
        defensiveScore: (defensiveScore / gamesPlayed).toFixed(1),
      };
    }).filter(Boolean);

    const topScorer = playerAverages.sort((a, b) => parseFloat(b.ppg) - parseFloat(a.ppg))[0];
    const topDefender = playerAverages.sort((a, b) => parseFloat(b.defensiveScore) - parseFloat(a.defensiveScore))[0];

    return {
      avgPoints: (totalPoints / oppGames.length).toFixed(1),
      avgRebounds: (totalRebounds / oppGames.length).toFixed(1),
      avgTurnovers: excludeTurnovers ? null : (totalTurnovers / oppGames.length).toFixed(1),
      topScorer: topScorer || null,
      topDefender: topDefender || null,
    };
  }, [selectedOpponent, games, playerStats, players, excludeTurnovers]);

  // Player Impact Rankings
  const playerRankings = useMemo(() => {
    if (!selectedTeam) return [];

    const teamPlayers = players.filter(p => p.team_id === selectedTeam);

    return teamPlayers.map(player => {
      const pStats = playerStats.filter(s => s.player_id === player.id);
      const gamesPlayed = pStats.length;

      if (gamesPlayed === 0) return null;

      const totalPts = pStats.reduce((sum, s) => sum + ((s.points_2 || 0) * 2) + ((s.points_3 || 0) * 3) + (s.free_throws || 0), 0);
      const totalReb = pStats.reduce((sum, s) => sum + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0);
      const totalAst = pStats.reduce((sum, s) => sum + (s.assists || 0), 0);
      const totalStl = pStats.reduce((sum, s) => sum + (s.steals || 0), 0);
      const totalBlk = pStats.reduce((sum, s) => sum + (s.blocks || 0), 0);
      const totalFouls = pStats.reduce((sum, s) => sum + (s.fouls || 0), 0);

      const ppg = totalPts / gamesPlayed;
      const rpg = totalReb / gamesPlayed;
      const apg = totalAst / gamesPlayed;
      const spg = totalStl / gamesPlayed;
      const bpg = totalBlk / gamesPlayed;
      const fpg = totalFouls / gamesPlayed;
      const impact = ppg + (rpg * 1.2) + (apg * 1.5) + spg + bpg;
      const defensiveImpact = (totalStl + totalBlk - totalFouls) / gamesPlayed;

      return {
        id: player.id,
        name: player.name,
        jerseyNumber: player.jersey_number,
        impact: impact.toFixed(1),
        defensiveImpact: defensiveImpact.toFixed(1),
        ppg: ppg.toFixed(1),
        rpg: rpg.toFixed(1),
        apg: apg.toFixed(1),
        spg: spg.toFixed(1),
        bpg: bpg.toFixed(1),
        fpg: fpg.toFixed(1),
      };
    }).filter(Boolean);
  }, [selectedTeam, players, playerStats]);

  const sortedPlayers = useMemo(() => {
    const sorted = [...playerRankings];
    switch(sortBy) {
      case 'impact': return sorted.sort((a, b) => parseFloat(b.impact) - parseFloat(a.impact));
      case 'defensive': return sorted.sort((a, b) => parseFloat(b.defensiveImpact) - parseFloat(a.defensiveImpact));
      case 'assists': return sorted.sort((a, b) => parseFloat(b.apg) - parseFloat(a.apg));
      case 'rebounds': return sorted.sort((a, b) => parseFloat(b.rpg) - parseFloat(a.rpg));
      default: return sorted;
    }
  }, [playerRankings, sortBy]);

  // Team Season Averages
  const teamSeasonAverages = useMemo(() => {
    if (!selectedTeam || teamGames.length === 0) return null;

    let totalPoints = 0, totalAssists = 0, totalReboundMargin = 0, totalTurnovers = 0, totalRebounds = 0;

    teamGames.forEach(game => {
      const isHome = game.home_team_id === selectedTeam;
      totalPoints += isHome ? game.home_score : game.away_score;

      const teamStats = playerStats.filter(s => s.game_id === game.id && s.team_id === selectedTeam);
      const oppStats = playerStats.filter(s => s.game_id === game.id && s.team_id !== selectedTeam);

      totalAssists += teamStats.reduce((sum, s) => sum + (s.assists || 0), 0);
      
      const teamReb = teamStats.reduce((sum, s) => sum + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0);
      const oppReb = oppStats.reduce((sum, s) => sum + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0);
      totalRebounds += teamReb;
      totalReboundMargin += (teamReb - oppReb);
      
      if (!excludeTurnovers) {
        totalTurnovers += teamStats.reduce((sum, s) => sum + (s.turnovers || 0), 0);
      }
    });

    return {
      points: totalPoints / teamGames.length,
      assists: totalAssists / teamGames.length,
      rebounds: totalRebounds / teamGames.length,
      reboundMargin: totalReboundMargin / teamGames.length,
      turnovers: excludeTurnovers ? null : totalTurnovers / teamGames.length,
    };
  }, [selectedTeam, teamGames, playerStats, excludeTurnovers]);

  // Last 3 Games Trend
  const last3GamesTrend = useMemo(() => {
    if (!selectedTeam || teamGames.length === 0 || !teamSeasonAverages) return null;

    const recentGames = teamGames
      .sort((a, b) => new Date(b.game_date) - new Date(a.game_date))
      .slice(0, 3);

    if (recentGames.length === 0) return null;

    let totalPoints = 0, totalAssists = 0, totalReboundMargin = 0, totalTurnovers = 0;

    recentGames.forEach(game => {
      const isHome = game.home_team_id === selectedTeam;
      totalPoints += isHome ? game.home_score : game.away_score;

      const teamStats = playerStats.filter(s => s.game_id === game.id && s.team_id === selectedTeam);
      const oppStats = playerStats.filter(s => s.game_id === game.id && s.team_id !== selectedTeam);

      totalAssists += teamStats.reduce((sum, s) => sum + (s.assists || 0), 0);
      
      const teamReb = teamStats.reduce((sum, s) => sum + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0);
      const oppReb = oppStats.reduce((sum, s) => sum + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0);
      totalReboundMargin += (teamReb - oppReb);
      
      if (!excludeTurnovers) {
        totalTurnovers += teamStats.reduce((sum, s) => sum + (s.turnovers || 0), 0);
      }
    });

    const recent = {
      points: totalPoints / recentGames.length,
      assists: totalAssists / recentGames.length,
      reboundMargin: totalReboundMargin / recentGames.length,
      turnovers: excludeTurnovers ? null : totalTurnovers / recentGames.length,
    };

    return {
      points: recent.points.toFixed(1),
      assists: recent.assists.toFixed(1),
      reboundMargin: recent.reboundMargin.toFixed(1),
      turnovers: excludeTurnovers ? null : recent.turnovers.toFixed(1),
      gamesCount: recentGames.length,
      momentum: {
        points: recent.points > teamSeasonAverages.points ? 'up' : recent.points < teamSeasonAverages.points ? 'down' : 'stable',
        rebounds: recent.reboundMargin > teamSeasonAverages.reboundMargin ? 'up' : recent.reboundMargin < teamSeasonAverages.reboundMargin ? 'down' : 'stable',
        turnovers: excludeTurnovers ? 'stable' : (recent.turnovers > teamSeasonAverages.turnovers ? 'up' : recent.turnovers < teamSeasonAverages.turnovers ? 'down' : 'stable'),
      }
    };
  }, [selectedTeam, teamGames, playerStats, teamSeasonAverages, excludeTurnovers]);

  // Key Insight - Identify strongest correlation with winning
  const keyInsight = useMemo(() => {
    if (!winLossComparison || winLossComparison.wins.count === 0 || winLossComparison.losses.count === 0) return null;

    const wins = winLossComparison.wins.stats;
    const losses = winLossComparison.losses.stats;

    const differences = {
      points: Math.abs(parseFloat(wins.points) - parseFloat(losses.points)),
      assists: Math.abs(parseFloat(wins.assists) - parseFloat(losses.assists)),
      reboundMargin: Math.abs(parseFloat(wins.reboundMargin) - parseFloat(losses.reboundMargin)),
      ...(excludeTurnovers ? {} : { turnovers: Math.abs(parseFloat(wins.turnovers) - parseFloat(losses.turnovers)) }),
    };

    const maxDiff = Math.max(...Object.values(differences));
    let message = "";
    let metric = "";

    if (differences.reboundMargin === maxDiff) {
      message = "Rebounding margin shows the strongest correlation with winning.";
      metric = "Rebound Margin";
    } else if (!excludeTurnovers && differences.turnovers === maxDiff) {
      message = "Turnover control is the biggest factor separating wins and losses.";
      metric = "Turnovers";
    } else if (differences.points === maxDiff) {
      message = "Scoring production significantly impacts game outcomes.";
      metric = "Points";
    } else if (differences.assists === maxDiff) {
      message = "Ball movement strongly influences winning results.";
      metric = "Assists";
    }

    return { message, metric, maxDiff: maxDiff.toFixed(1) };
  }, [winLossComparison, excludeTurnovers]);

  // Identify largest gap stat in Win vs Loss
  const largestGapStat = useMemo(() => {
    if (!winLossComparison) return null;

    const wins = winLossComparison.wins.stats;
    const losses = winLossComparison.losses.stats;

    const differences = {
      points: Math.abs(parseFloat(wins.points) - parseFloat(losses.points)),
      assists: Math.abs(parseFloat(wins.assists) - parseFloat(losses.assists)),
      reboundMargin: Math.abs(parseFloat(wins.reboundMargin) - parseFloat(losses.reboundMargin)),
      ...(excludeTurnovers ? {} : { turnovers: Math.abs(parseFloat(wins.turnovers) - parseFloat(losses.turnovers)) }),
    };

    const maxDiff = Math.max(...Object.values(differences));
    
    if (differences.points === maxDiff) return 'points';
    if (differences.assists === maxDiff) return 'assists';
    if (differences.reboundMargin === maxDiff) return 'reboundMargin';
    if (!excludeTurnovers && differences.turnovers === maxDiff) return 'turnovers';
    
    return null;
  }, [winLossComparison, excludeTurnovers]);

  // Suggested Game Focus
  const suggestedFocus = useMemo(() => {
    if (!selectedOpponent || !opponentSnapshot || !teamSeasonAverages || !winLossComparison) return [];

    const suggestions = [];
    const wins = winLossComparison.wins.stats;
    const losses = winLossComparison.losses.stats;

    if (parseFloat(opponentSnapshot.avgRebounds) > teamSeasonAverages.rebounds) {
      suggestions.push("Focus on defensive rebounding.");
    }

    // Only suggest turnover-based pressure if turnovers are tracked
    if (!excludeTurnovers && opponentSnapshot.avgTurnovers !== null && parseFloat(opponentSnapshot.avgTurnovers) < 10) {
      suggestions.push("Increase defensive pressure.");
    }

    if (opponentSnapshot.topScorer && parseFloat(opponentSnapshot.topScorer.ppg) > 20) {
      suggestions.push(`Contain ${opponentSnapshot.topScorer.name}.`);
    }

    if (teamSeasonAverages.reboundMargin < 0) {
      suggestions.push("Prioritize rebounding discipline.");
    }

    // Only factor turnovers into suggestions if tracked
    if (!excludeTurnovers && wins.turnovers !== null && losses.turnovers !== null) {
      const turnoverGap = Math.abs(parseFloat(wins.turnovers) - parseFloat(losses.turnovers));
      if (turnoverGap > 3 && parseFloat(losses.turnovers) > parseFloat(wins.turnovers)) {
        suggestions.push("Ball security must improve.");
      }
    }

    return suggestions;
  }, [selectedOpponent, opponentSnapshot, teamSeasonAverages, winLossComparison, excludeTurnovers]);

  const selectedTeamName = teams.find(t => t.id === selectedTeam)?.name || "";
  const selectedOpponentName = teams.find(t => t.id === selectedOpponent)?.name || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Coach Insights</h1>
            <p className="text-slate-600">Tactical game preparation and team analysis</p>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">League</label>
            <Select value={selectedLeague} onValueChange={setSelectedLeague}>
              <SelectTrigger>
                <SelectValue placeholder="Select league" />
              </SelectTrigger>
              <SelectContent>
                {filteredLeagues.map(league => (
                  <SelectItem key={league.id} value={league.id}>{league.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Your Team</label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger>
                <SelectValue placeholder="Select your team" />
              </SelectTrigger>
              <SelectContent>
                {leagueTeams.map(team => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!selectedTeam ? (
          <Card className="border-slate-200 shadow-lg">
            <CardContent className="py-12 text-center">
              <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">Select a league and team to view coach insights</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Key Insight */}
            {keyInsight && (
              <Card className="border-2 border-blue-300 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardHeader className="border-b border-blue-200">
                  <CardTitle className="flex items-center gap-2 text-blue-900">
                    <Lightbulb className="w-6 h-6 text-blue-600" />
                    Key Insight
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-900 mb-2">{keyInsight.message}</p>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-800">{keyInsight.metric}</Badge>
                        <span className="text-sm text-slate-600">Difference: {keyInsight.maxDiff}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 1. Win vs Loss Comparison */}
            {winLossComparison && (
              <Card className="border-slate-200 shadow-lg">
                <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-green-50 to-red-50">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-blue-600" />
                    Win vs Loss Comparison
                    <Badge variant="outline" className="ml-auto">{winLossComparison.wins.count}W - {winLossComparison.losses.count}L</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-green-50 rounded-xl p-6 border-2 border-green-200">
                      <h3 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        In Wins ({winLossComparison.wins.count} games)
                      </h3>
                      <div className="space-y-3">
                        <div className={`flex justify-between ${largestGapStat === 'points' ? 'bg-green-100 -mx-2 px-2 py-1 rounded-lg' : ''}`}>
                          <span className={`${largestGapStat === 'points' ? 'font-bold text-green-900' : 'text-slate-700'}`}>Avg Points:</span>
                          <span className={`font-bold ${largestGapStat === 'points' ? 'text-green-900 text-lg' : 'text-green-700'} flex items-center gap-1`}>
                            {largestGapStat === 'points' && <TrendingUp className="w-4 h-4" />}
                            {winLossComparison.wins.stats.points}
                          </span>
                        </div>
                        <div className={`flex justify-between ${largestGapStat === 'assists' ? 'bg-green-100 -mx-2 px-2 py-1 rounded-lg' : ''}`}>
                          <span className={`${largestGapStat === 'assists' ? 'font-bold text-green-900' : 'text-slate-700'}`}>Avg Assists:</span>
                          <span className={`font-bold ${largestGapStat === 'assists' ? 'text-green-900 text-lg' : 'text-green-700'} flex items-center gap-1`}>
                            {largestGapStat === 'assists' && <TrendingUp className="w-4 h-4" />}
                            {winLossComparison.wins.stats.assists}
                          </span>
                        </div>
                        <div className={`flex justify-between ${largestGapStat === 'reboundMargin' ? 'bg-green-100 -mx-2 px-2 py-1 rounded-lg' : ''}`}>
                          <span className={`${largestGapStat === 'reboundMargin' ? 'font-bold text-green-900' : 'text-slate-700'}`}>Rebound Margin:</span>
                          <span className={`font-bold ${largestGapStat === 'reboundMargin' ? 'text-green-900 text-lg' : 'text-green-700'} flex items-center gap-1`}>
                            {largestGapStat === 'reboundMargin' && <TrendingUp className="w-4 h-4" />}
                            {winLossComparison.wins.stats.reboundMargin > 0 ? '+' : ''}{winLossComparison.wins.stats.reboundMargin}
                          </span>
                        </div>
                        {!excludeTurnovers && (
                          <div className={`flex justify-between ${largestGapStat === 'turnovers' ? 'bg-green-100 -mx-2 px-2 py-1 rounded-lg' : ''}`}>
                            <span className={`${largestGapStat === 'turnovers' ? 'font-bold text-green-900' : 'text-slate-700'}`}>Avg Turnovers:</span>
                            <span className={`font-bold ${largestGapStat === 'turnovers' ? 'text-green-900 text-lg' : 'text-green-700'} flex items-center gap-1`}>
                              {largestGapStat === 'turnovers' && <TrendingDown className="w-4 h-4" />}
                              {winLossComparison.wins.stats.turnovers}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-red-50 rounded-xl p-6 border-2 border-red-200">
                      <h3 className="font-bold text-red-900 mb-4 flex items-center gap-2">
                        <TrendingDown className="w-5 h-5" />
                        In Losses ({winLossComparison.losses.count} games)
                      </h3>
                      <div className="space-y-3">
                        <div className={`flex justify-between ${largestGapStat === 'points' ? 'bg-red-100 -mx-2 px-2 py-1 rounded-lg' : ''}`}>
                          <span className={`${largestGapStat === 'points' ? 'font-bold text-red-900' : 'text-slate-700'}`}>Avg Points:</span>
                          <span className={`font-bold ${largestGapStat === 'points' ? 'text-red-900 text-lg' : 'text-red-700'} flex items-center gap-1`}>
                            {largestGapStat === 'points' && <TrendingDown className="w-4 h-4" />}
                            {winLossComparison.losses.stats.points}
                          </span>
                        </div>
                        <div className={`flex justify-between ${largestGapStat === 'assists' ? 'bg-red-100 -mx-2 px-2 py-1 rounded-lg' : ''}`}>
                          <span className={`${largestGapStat === 'assists' ? 'font-bold text-red-900' : 'text-slate-700'}`}>Avg Assists:</span>
                          <span className={`font-bold ${largestGapStat === 'assists' ? 'text-red-900 text-lg' : 'text-red-700'} flex items-center gap-1`}>
                            {largestGapStat === 'assists' && <TrendingDown className="w-4 h-4" />}
                            {winLossComparison.losses.stats.assists}
                          </span>
                        </div>
                        <div className={`flex justify-between ${largestGapStat === 'reboundMargin' ? 'bg-red-100 -mx-2 px-2 py-1 rounded-lg' : ''}`}>
                          <span className={`${largestGapStat === 'reboundMargin' ? 'font-bold text-red-900' : 'text-slate-700'}`}>Rebound Margin:</span>
                          <span className={`font-bold ${largestGapStat === 'reboundMargin' ? 'text-red-900 text-lg' : 'text-red-700'} flex items-center gap-1`}>
                            {largestGapStat === 'reboundMargin' && <TrendingDown className="w-4 h-4" />}
                            {winLossComparison.losses.stats.reboundMargin > 0 ? '+' : ''}{winLossComparison.losses.stats.reboundMargin}
                          </span>
                        </div>
                        {!excludeTurnovers && (
                          <div className={`flex justify-between ${largestGapStat === 'turnovers' ? 'bg-red-100 -mx-2 px-2 py-1 rounded-lg' : ''}`}>
                            <span className={`${largestGapStat === 'turnovers' ? 'font-bold text-red-900' : 'text-slate-700'}`}>Avg Turnovers:</span>
                            <span className={`font-bold ${largestGapStat === 'turnovers' ? 'text-red-900 text-lg' : 'text-red-700'} flex items-center gap-1`}>
                              {largestGapStat === 'turnovers' && <TrendingUp className="w-4 h-4" />}
                              {winLossComparison.losses.stats.turnovers}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Win Identity Snapshot */}
            {winLossComparison && winLossComparison.wins.count > 0 && (
              <Card className="border-slate-200 shadow-lg bg-gradient-to-br from-emerald-50 to-green-50">
                <CardHeader className="border-b border-green-200">
                  <CardTitle className="flex items-center gap-2 text-green-900">
                    <Trophy className="w-5 h-5 text-green-600" />
                    When We Win, We Average
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className={`grid grid-cols-2 ${excludeTurnovers ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-4`}>
                    <div className="bg-white rounded-lg p-4 border-2 border-green-200 text-center">
                      <div className="text-3xl font-bold text-green-700">{winLossComparison.wins.stats.points}</div>
                      <div className="text-sm text-slate-600 mt-1">Points</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border-2 border-green-200 text-center">
                      <div className="text-3xl font-bold text-green-700">{winLossComparison.wins.stats.assists}</div>
                      <div className="text-sm text-slate-600 mt-1">Assists</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border-2 border-green-200 text-center">
                      <div className="text-3xl font-bold text-green-700">
                        {winLossComparison.wins.stats.reboundMargin > 0 ? '+' : ''}{winLossComparison.wins.stats.reboundMargin}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">Rebound Margin</div>
                    </div>
                    {!excludeTurnovers && (
                      <div className="bg-white rounded-lg p-4 border-2 border-green-200 text-center">
                        <div className="text-3xl font-bold text-green-700">{winLossComparison.wins.stats.turnovers}</div>
                        <div className="text-sm text-slate-600 mt-1">Turnovers</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 2. Rebounding Differential */}
            {reboundDifferential && (
              <Card className="border-slate-200 shadow-lg">
                <CardHeader className={`border-b ${reboundDifferential.isPositive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <CardTitle className="flex items-center gap-2">
                    {reboundDifferential.isPositive ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
                    Rebounding Differential
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className={`text-6xl font-bold mb-2 ${reboundDifferential.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {reboundDifferential.margin > 0 ? '+' : ''}{reboundDifferential.margin}
                    </div>
                    <p className="text-slate-600">Average Rebound Margin per Game</p>
                    <Badge className={`mt-4 ${reboundDifferential.isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {reboundDifferential.isPositive ? 'Winning the boards' : 'Losing the boards'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 3. Opponent Snapshot */}
            <Card className="border-slate-200 shadow-lg">
              <CardHeader className="border-b border-slate-200 bg-orange-50">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-600" />
                  Opponent Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="mb-4">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Select Opponent</label>
                  <Select value={selectedOpponent} onValueChange={setSelectedOpponent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose upcoming opponent" />
                    </SelectTrigger>
                    <SelectContent>
                      {leagueTeams.filter(t => t.id !== selectedTeam).map(team => (
                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {opponentSnapshot ? (
                  <div className={`grid grid-cols-2 ${excludeTurnovers ? 'md:grid-cols-4' : 'md:grid-cols-5'} gap-4`}>
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-slate-900">{opponentSnapshot.avgPoints}</div>
                      <div className="text-xs text-slate-600 mt-1">Avg Points</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-slate-900">{opponentSnapshot.avgRebounds}</div>
                      <div className="text-xs text-slate-600 mt-1">Avg Rebounds</div>
                    </div>
                    {!excludeTurnovers && (
                      <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-slate-900">{opponentSnapshot.avgTurnovers}</div>
                        <div className="text-xs text-slate-600 mt-1">Avg Turnovers</div>
                      </div>
                    )}
                    <div className="bg-amber-50 rounded-lg p-4 text-center border-2 border-amber-200">
                      <div className="text-lg font-bold text-amber-900">{opponentSnapshot.topScorer?.name || 'N/A'}</div>
                      <div className="text-xs text-slate-600 mt-1">Top Scorer</div>
                      {opponentSnapshot.topScorer && (
                        <Badge className="mt-1 bg-amber-100 text-amber-800">{opponentSnapshot.topScorer.ppg} PPG</Badge>
                      )}
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center border-2 border-blue-200">
                      <div className="text-lg font-bold text-blue-900">{opponentSnapshot.topDefender?.name || 'N/A'}</div>
                      <div className="text-xs text-slate-600 mt-1">Top Defender</div>
                      {opponentSnapshot.topDefender && (
                        <Badge className="mt-1 bg-blue-100 text-blue-800">{opponentSnapshot.topDefender.defensiveScore} STL+BLK</Badge>
                      )}
                    </div>
                  </div>
                ) : selectedOpponent ? (
                  <p className="text-center text-slate-500 py-8">No data available for this opponent</p>
                ) : (
                  <p className="text-center text-slate-500 py-8">Select an opponent to view their stats</p>
                )}
              </CardContent>
            </Card>

            {/* Suggested Game Focus */}
            {selectedOpponent && suggestedFocus.length > 0 && (
              <Card className="border-2 border-orange-300 shadow-lg bg-gradient-to-r from-orange-50 to-amber-50">
                <CardHeader className="border-b border-orange-200">
                  <CardTitle className="flex items-center gap-2 text-orange-900">
                    <Target className="w-5 h-5 text-orange-600" />
                    Suggested Game Focus
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {suggestedFocus.map((suggestion, idx) => (
                      <div key={idx} className="flex items-start gap-3 bg-white rounded-lg p-4 border-2 border-orange-200">
                        <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-white text-xs font-bold">{idx + 1}</span>
                        </div>
                        <p className="text-slate-900 font-medium">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Tactical Briefing */}
            <AITacticalBriefing
              selectedLeague={selectedLeague}
              selectedTeam={selectedTeam}
              selectedOpponent={selectedOpponent}
              selectedTeamName={selectedTeamName}
              selectedOpponentName={selectedOpponentName}
              winLossComparison={winLossComparison}
              opponentSnapshot={opponentSnapshot}
              last3GamesTrend={last3GamesTrend}
              currentUser={currentUser}
              excludeTurnovers={excludeTurnovers}
            />

            {/* 4. Player Impact Rankings */}
            <Card className="border-slate-200 shadow-lg">
              <CardHeader className="border-b border-slate-200 bg-purple-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    Player Impact Rankings
                  </CardTitle>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="impact">Overall Impact</SelectItem>
                      <SelectItem value="defensive">Defensive Impact</SelectItem>
                      <SelectItem value="assists">Assist Leader</SelectItem>
                      <SelectItem value="rebounds">Rebound Leader</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {sortedPlayers.length > 0 ? (
                  <div className="space-y-2">
                    {sortedPlayers.slice(0, 10).map((player, idx) => (
                      <div key={player.id} className="flex items-center gap-4 bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors">
                        <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-slate-900">#{player.jerseyNumber} {player.name}</div>
                          <div className="text-sm text-slate-600">
                            {sortBy === 'defensive' ? (
                              <>{player.spg} STL · {player.bpg} BLK · {player.fpg} FOULS</>
                            ) : (
                              <>{player.ppg} PPG · {player.rpg} RPG · {player.apg} APG</>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {sortBy === 'impact' && (
                            <Badge className="bg-purple-100 text-purple-800">Impact: {player.impact}</Badge>
                          )}
                          {sortBy === 'defensive' && (
                            <Badge className="bg-blue-100 text-blue-800">Defense: {player.defensiveImpact}</Badge>
                          )}
                          {sortBy === 'assists' && (
                            <Badge className="bg-green-100 text-green-800">{player.apg} APG</Badge>
                          )}
                          {sortBy === 'rebounds' && (
                            <Badge className="bg-orange-100 text-orange-800">{player.rpg} RPG</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-8">No player data available</p>
                )}
              </CardContent>
            </Card>

            {/* 5. Last 3 Games Trend */}
            {last3GamesTrend && (
              <Card className="border-slate-200 shadow-lg">
                <CardHeader className="border-b border-slate-200 bg-blue-50">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Last {last3GamesTrend.gamesCount} Games Trend
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className={`grid grid-cols-2 ${excludeTurnovers ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-4`}>
                    <div className="bg-white rounded-lg p-4 border-2 border-slate-200 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        {last3GamesTrend.momentum.points === 'up' && <TrendingUp className="w-5 h-5 text-green-600" />}
                        {last3GamesTrend.momentum.points === 'down' && <TrendingDown className="w-5 h-5 text-red-600" />}
                        {last3GamesTrend.momentum.points === 'stable' && <Minus className="w-5 h-5 text-slate-400" />}
                        <div className="text-3xl font-bold text-slate-900">{last3GamesTrend.points}</div>
                      </div>
                      <div className="text-sm text-slate-600">Avg Points</div>
                      {last3GamesTrend.momentum.points === 'up' && (
                        <Badge className="mt-2 bg-green-100 text-green-800 text-xs">Trending Up</Badge>
                      )}
                      {last3GamesTrend.momentum.points === 'down' && (
                        <Badge className="mt-2 bg-red-100 text-red-800 text-xs">Trending Down</Badge>
                      )}
                    </div>
                    <div className="bg-white rounded-lg p-4 border-2 border-slate-200 text-center">
                      <div className="text-3xl font-bold text-slate-900">{last3GamesTrend.assists}</div>
                      <div className="text-sm text-slate-600 mt-1">Avg Assists</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border-2 border-slate-200 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        {last3GamesTrend.momentum.rebounds === 'up' && <TrendingUp className="w-5 h-5 text-green-600" />}
                        {last3GamesTrend.momentum.rebounds === 'down' && <TrendingDown className="w-5 h-5 text-red-600" />}
                        {last3GamesTrend.momentum.rebounds === 'stable' && <Minus className="w-5 h-5 text-slate-400" />}
                        <div className={`text-3xl font-bold ${last3GamesTrend.reboundMargin > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {last3GamesTrend.reboundMargin > 0 ? '+' : ''}{last3GamesTrend.reboundMargin}
                        </div>
                      </div>
                      <div className="text-sm text-slate-600">Rebound Margin</div>
                      {last3GamesTrend.momentum.rebounds === 'up' && (
                        <Badge className="mt-2 bg-green-100 text-green-800 text-xs">Trending Up</Badge>
                      )}
                      {last3GamesTrend.momentum.rebounds === 'down' && (
                        <Badge className="mt-2 bg-red-100 text-red-800 text-xs">Trending Down</Badge>
                      )}
                    </div>
                    {!excludeTurnovers && (
                      <div className="bg-white rounded-lg p-4 border-2 border-slate-200 text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          {last3GamesTrend.momentum.turnovers === 'up' && <TrendingUp className="w-5 h-5 text-red-600" />}
                          {last3GamesTrend.momentum.turnovers === 'down' && <TrendingDown className="w-5 h-5 text-green-600" />}
                          {last3GamesTrend.momentum.turnovers === 'stable' && <Minus className="w-5 h-5 text-slate-400" />}
                          <div className="text-3xl font-bold text-slate-900">{last3GamesTrend.turnovers}</div>
                        </div>
                        <div className="text-sm text-slate-600">Avg Turnovers</div>
                        {last3GamesTrend.momentum.turnovers === 'up' && (
                          <Badge className="mt-2 bg-red-100 text-red-800 text-xs">Risk - Trending Up</Badge>
                        )}
                        {last3GamesTrend.momentum.turnovers === 'down' && (
                          <Badge className="mt-2 bg-green-100 text-green-800 text-xs">Improved</Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
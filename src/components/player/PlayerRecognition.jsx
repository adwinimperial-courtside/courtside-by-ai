import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";

function computeMvpRanking(leagueTeams, completedGames, allStats) {
  if (completedGames.length === 0) return [];

  const teamStats = {};
  leagueTeams.forEach(team => {
    const tg = completedGames.filter(g => g.home_team_id === team.id || g.away_team_id === team.id);
    const wins = tg.filter(g => g.home_team_id === team.id ? g.home_score > g.away_score : g.away_score > g.home_score).length;
    teamStats[team.id] = { gamesPlayed: tg.length, winPct: tg.length > 0 ? wins / tg.length : 0 };
  });

  const scores = {};
  completedGames.forEach(game => {
    allStats.filter(s => s.game_id === game.id).forEach(s => {
      if (!scores[s.player_id]) scores[s.player_id] = { gp: 0, sumGis: 0, sumTech: 0, sumUnsp: 0, teamId: s.team_id };
      const pts = (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0);
      const gis = pts + 1.2*(s.offensive_rebounds||0) + 1.0*(s.defensive_rebounds||0) + 1.5*(s.assists||0) + 2.5*(s.steals||0) + 2.0*(s.blocks||0) - 2.0*(s.turnovers||0) - 0.5*(s.fouls||0) - 3.0*(s.technical_fouls||0) - 4.0*(s.unsportsmanlike_fouls||0);
      scores[s.player_id].gp++;
      scores[s.player_id].sumGis += gis;
      scores[s.player_id].sumTech += s.technical_fouls || 0;
      scores[s.player_id].sumUnsp += s.unsportsmanlike_fouls || 0;
    });
  });

  return Object.entries(scores)
    .map(([playerId, d]) => {
      const td = teamStats[d.teamId];
      if (!td || td.gamesPlayed === 0) return null;
      const gpPct = d.gp / td.gamesPlayed;
      if (gpPct < 0.60) return null;
      const mvpScore = 0.60 * (d.sumGis / d.gp) + 20 * gpPct + 20 * td.winPct - 3 * d.sumTech - 5 * d.sumUnsp;
      return { playerId, mvpScore };
    })
    .filter(Boolean)
    .sort((a, b) => b.mvpScore - a.mvpScore);
}

function computeDpoyRanking(leagueTeams, completedGames, allStats) {
  if (completedGames.length === 0) return [];

  const teamGames = {};
  leagueTeams.forEach(team => {
    teamGames[team.id] = completedGames.filter(g => g.home_team_id === team.id || g.away_team_id === team.id).length;
  });

  const scores = {};
  completedGames.forEach(game => {
    allStats.filter(s => s.game_id === game.id).forEach(s => {
      if (!scores[s.player_id]) scores[s.player_id] = { gp: 0, sumDefGis: 0, sumTech: 0, sumUnsp: 0, teamId: s.team_id };
      const defGis = 3.0*(s.steals||0) + 2.5*(s.blocks||0) + 1.5*(s.offensive_rebounds||0) + 1.0*(s.defensive_rebounds||0) - 1.5*(s.fouls||0) - 2.0*(s.turnovers||0) - 3.0*(s.technical_fouls||0) - 4.0*(s.unsportsmanlike_fouls||0);
      scores[s.player_id].gp++;
      scores[s.player_id].sumDefGis += defGis;
      scores[s.player_id].sumTech += s.technical_fouls || 0;
      scores[s.player_id].sumUnsp += s.unsportsmanlike_fouls || 0;
    });
  });

  return Object.entries(scores)
    .map(([playerId, d]) => {
      const tg = teamGames[d.teamId];
      if (!tg || d.gp === 0) return null;
      const gpPct = d.gp / tg;
      if (gpPct < 0.60) return null;
      const dpoyScore = (d.sumDefGis / d.gp) + 10 * gpPct - 2 * d.sumTech - 3 * d.sumUnsp;
      return { playerId, dpoyScore };
    })
    .filter(Boolean)
    .sort((a, b) => b.dpoyScore - a.dpoyScore);
}

export default function PlayerRecognition({ myStats, allStats, teams, games, matchedPlayerId, selectedLeagueId }) {
  const leagueTeams = useMemo(() => teams.filter(t => t.league_id === selectedLeagueId), [teams, selectedLeagueId]);
  const completedGames = useMemo(() => games.filter(g => g.status === 'completed'), [games]);

  const mvpRanking = useMemo(() => computeMvpRanking(leagueTeams, completedGames, allStats), [leagueTeams, completedGames, allStats]);
  const dpoyRanking = useMemo(() => computeDpoyRanking(leagueTeams, completedGames, allStats), [leagueTeams, completedGames, allStats]);

  const mvpRank = useMemo(() => {
    const idx = mvpRanking.findIndex(r => r.playerId === matchedPlayerId);
    return idx >= 0 ? idx + 1 : null;
  }, [mvpRanking, matchedPlayerId]);

  const dpoyRank = useMemo(() => {
    const idx = dpoyRanking.findIndex(r => r.playerId === matchedPlayerId);
    return idx >= 0 ? idx + 1 : null;
  }, [dpoyRanking, matchedPlayerId]);

  const doubleDoubles = useMemo(() => myStats.filter(s => {
    const pts = (s.points_2||0)*2 + (s.points_3||0)*3 + (s.free_throws||0);
    const reb = (s.offensive_rebounds||0) + (s.defensive_rebounds||0);
    return [pts >= 10, reb >= 10, (s.assists||0) >= 10].filter(Boolean).length >= 2;
  }).length, [myStats]);

  const twentyPlusGames = useMemo(() => myStats.filter(s => {
    return (s.points_2||0)*2 + (s.points_3||0)*3 + (s.free_throws||0) >= 20;
  }).length, [myStats]);

  const badges = [];
  if (mvpRank === 1) badges.push({ label: "MVP Leader", color: "bg-yellow-500 text-white" });
  else if (mvpRank && mvpRank <= 5) badges.push({ label: `Mythical 5 (#${mvpRank})`, color: "bg-purple-500 text-white" });
  else if (mvpRank && mvpRank <= 10) badges.push({ label: `Top 10 MVP (#${mvpRank})`, color: "bg-purple-100 text-purple-800" });
  if (dpoyRank === 1) badges.push({ label: "DPOY Leader", color: "bg-blue-500 text-white" });
  else if (dpoyRank && dpoyRank <= 3) badges.push({ label: `Top 3 DPOY (#${dpoyRank})`, color: "bg-blue-100 text-blue-800" });
  if (doubleDoubles > 0) badges.push({ label: `${doubleDoubles} Double-Double${doubleDoubles > 1 ? "s" : ""}`, color: "bg-green-100 text-green-800" });
  if (twentyPlusGames > 0) badges.push({ label: `${twentyPlusGames}× 20+ PTS`, color: "bg-orange-100 text-orange-800" });

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="w-5 h-5 text-yellow-500" />
          Recognition
        </CardTitle>
      </CardHeader>
      <CardContent>
        {badges.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">No recognition yet — keep playing!</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {badges.map((b, i) => (
              <span key={i} className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${b.color}`}>
                {b.label}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import React, { useMemo } from "react";
import { resolveSettings } from "@/utils/awardDefaults";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

function isActualPlayedGame(g) {
  return (
    g.status === 'completed' &&
    !g.is_default_result &&
    g.result_type !== 'default' &&
    !g.exclude_from_awards
  );
}

function didPlayerParticipate(stat) {
  const hasStats = (stat.points_2 || 0) + (stat.points_3 || 0) + (stat.free_throws || 0) +
                   (stat.assists || 0) + (stat.steals || 0) + (stat.blocks || 0) +
                   (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0) +
                   (stat.fouls || 0) + (stat.technical_fouls || 0) + (stat.unsportsmanlike_fouls || 0) > 0;
  if (stat.did_play) return true;
  if ((stat.minutes_played || 0) > 0) return true;
  if (hasStats) return true;
  return false;
}

export default function AwardLeadersTop20({ league, teams, games, players, stats, awardSettings }) {
  const cfg = resolveSettings(awardSettings);

  const mvpCandidates = useMemo(() => {
    if (!league || !teams || !games || !players || !stats) return [];

    const leagueTeams = teams.filter(t => t.league_id === league.id);
    const leagueGames = games.filter(g => {
      const homeTeam = teams.find(t => t.id === g.home_team_id);
      const awayTeam = teams.find(t => t.id === g.away_team_id);
      return (
        (homeTeam?.league_id === league.id || awayTeam?.league_id === league.id) &&
        isActualPlayedGame(g)
      );
    });

    if (leagueGames.length === 0) return [];

    const teamStats = {};
    leagueTeams.forEach(team => {
      const teamGames = leagueGames.filter(g => g.home_team_id === team.id || g.away_team_id === team.id);
      const wins = teamGames.filter(g =>
        g.home_team_id === team.id ? g.home_score > g.away_score : g.away_score > g.home_score
      ).length;
      teamStats[team.id] = {
        gamesPlayed: teamGames.length,
        wins,
        winPct: teamGames.length > 0 ? wins / teamGames.length : 0
      };
    });

    const playerMvpScores = {};
    leagueGames.forEach(game => {
      const gameStats = stats.filter(s => s.game_id === game.id);
      gameStats.forEach(playerStat => {
        if (!didPlayerParticipate(playerStat)) return;
        if (!playerMvpScores[playerStat.player_id]) {
          playerMvpScores[playerStat.player_id] = { gp: 0, sumGis: 0, sumTech: 0, sumUnsp: 0, teamId: playerStat.team_id };
        }
        const isDigital = game.entry_type === 'digital' && !game.edited;
        const pts = cfg.mvp_pts_weight * ((isDigital ? (playerStat.points_2 || 0) * 2 : (playerStat.points_2 || 0)) + ((playerStat.points_3 || 0) * 3) + (playerStat.free_throws || 0));
        const gis = pts +
          cfg.mvp_oreb_weight * (playerStat.offensive_rebounds || 0) +
          cfg.mvp_dreb_weight * (playerStat.defensive_rebounds || 0) +
          cfg.mvp_ast_weight * (playerStat.assists || 0) +
          cfg.mvp_stl_weight * (playerStat.steals || 0) +
          cfg.mvp_blk_weight * (playerStat.blocks || 0) -
          cfg.mvp_turnover_penalty * (playerStat.turnovers || 0) -
          cfg.mvp_foul_penalty * (playerStat.fouls || 0) -
          cfg.mvp_tech_penalty * (playerStat.technical_fouls || 0) -
          cfg.mvp_unsportsmanlike_penalty * (playerStat.unsportsmanlike_fouls || 0);

        playerMvpScores[playerStat.player_id].gp += 1;
        playerMvpScores[playerStat.player_id].sumGis += gis;
        playerMvpScores[playerStat.player_id].sumTech += playerStat.technical_fouls || 0;
        playerMvpScores[playerStat.player_id].sumUnsp += playerStat.unsportsmanlike_fouls || 0;
      });
    });

    return Object.entries(playerMvpScores)
      .map(([playerId, data]) => {
        const player = players.find(p => p.id === playerId);
        const team = teams.find(t => t.id === data.teamId);
        const teamData = teamStats[data.teamId];
        if (!player || !team || !teamData) return null;

        const effectiveGp = Math.min(data.gp, teamData.gamesPlayed);
        const avgGis = effectiveGp > 0 ? data.sumGis / effectiveGp : 0;
        const gpPct = teamData.gamesPlayed > 0 ? effectiveGp / teamData.gamesPlayed : 0;
        const eligible = gpPct >= cfg.mvp_min_games_percent / 100;
        if (!eligible) return null;

        const teamBonus = cfg.mvp_team_win_percent_weight * teamData.winPct;
        const mvpScore = cfg.mvp_avg_gis_weight * avgGis + cfg.mvp_gp_percent_weight * gpPct + teamBonus - cfg.mvp_tech_final_penalty * data.sumTech - cfg.mvp_unsp_final_penalty * data.sumUnsp;

        return {
          playerId,
          player,
          team,
          gp: effectiveGp,
          totalGames: teamData.gamesPlayed,
          gpPct: (gpPct * 100).toFixed(1),
          avgGis: avgGis.toFixed(1),
          avgGisNum: avgGis,
          mvpScore: mvpScore.toFixed(2),
          mvpScoreNum: mvpScore,
          sumTech: data.sumTech,
          sumUnsp: data.sumUnsp,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const scoreDiff = Math.round(b.mvpScoreNum * 10) - Math.round(a.mvpScoreNum * 10);
        if (scoreDiff !== 0) return scoreDiff;
        return b.avgGisNum - a.avgGisNum;
      })
      .slice(0, 20);
  }, [league, teams, games, players, stats]);

  const rankBadge = (index) => {
    if (index === 0) return <Badge className="bg-yellow-500 text-white">MVP</Badge>;
    if (index < 5) return <Badge className="bg-purple-500 text-white">Mythical {index + 1}</Badge>;
    return null;
  };

  const rowBg = (index) => {
    if (index === 0) return "bg-yellow-50";
    if (index < 5) return "bg-purple-50/40";
    return "";
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Top 20 MVP Rankings — {league?.name}
        </CardTitle>
        <p className="text-sm text-slate-500">
          {mvpCandidates.length} eligible players · Same formula as Award Leaders · Min {cfg.mvp_min_games_percent}% games played
        </p>
      </CardHeader>
      <CardContent>
        {mvpCandidates.length === 0 ? (
          <p className="text-slate-500 text-center py-10">No eligible MVP candidates yet for this league.</p>
        ) : (
          <>
            {/* Mobile */}
            <div className="block md:hidden space-y-3">
              {mvpCandidates.map((c, index) => (
                <div key={c.playerId} className={`rounded-xl border p-4 ${rowBg(index)}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg font-black text-slate-400 w-7">#{index + 1}</span>
                    <div className="flex-1 ml-2">
                      <div className="font-bold text-slate-900">{c.player.name}</div>
                      <div className="text-xs text-slate-500">{c.team.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-purple-600">{c.mvpScore}</div>
                      <div className="text-xs text-slate-400">MVP Score</div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-600 mt-2">
                    <span>GP: <strong>{c.gp}/{c.totalGames}</strong></span>
                    <span>Avg GIS: <strong>{c.avgGis}</strong></span>
                    <span>GP%: <strong>{c.gpPct}%</strong></span>
                  </div>
                  {rankBadge(index) && <div className="mt-2">{rankBadge(index)}</div>}
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">GP</TableHead>
                    <TableHead className="text-center">GP%</TableHead>
                    <TableHead className="text-center">Avg GIS</TableHead>
                    <TableHead className="text-center">MVP Score</TableHead>
                    <TableHead>Award</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mvpCandidates.map((c, index) => (
                    <TableRow key={c.playerId} className={rowBg(index)}>
                      <TableCell className="font-bold text-slate-500">{index + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-900">{c.player.name}</TableCell>
                      <TableCell className="text-slate-600">{c.team.name}</TableCell>
                      <TableCell className="text-center">{c.gp}/{c.totalGames}</TableCell>
                      <TableCell className="text-center">{c.gpPct}%</TableCell>
                      <TableCell className="text-center">{c.avgGis}</TableCell>
                      <TableCell className="text-center font-bold text-purple-600 text-base">{c.mvpScore}</TableCell>
                      <TableCell>{rankBadge(index)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
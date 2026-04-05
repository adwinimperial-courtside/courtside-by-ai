import React, { useMemo } from "react";
import { resolveSettings } from "@/utils/awardDefaults";

/**
 * Returns true only for games that were actually played.
 * Default / forfeited / excluded games are never included in award calculations.
 */
function isActualPlayedGame(g) {
  return (
    g.status === 'completed' &&
    !g.is_default_result &&
    g.result_type !== 'default' &&
    !g.exclude_from_awards
  );
}
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Shield } from "lucide-react";
import MobileAwardCards from "./MobileAwardCards";

export default function AwardLeaders({ league, teams, games, players, stats, awardSettings }) {
  const cfg = resolveSettings(awardSettings);
  const didPlayerParticipate = (stat) => {
    const hasStats = (stat.points_2 || 0) + (stat.points_3 || 0) + (stat.free_throws || 0) +
                     (stat.assists || 0) + (stat.steals || 0) + (stat.blocks || 0) +
                     (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0) +
                     (stat.fouls || 0) + (stat.technical_fouls || 0) + (stat.unsportsmanlike_fouls || 0) > 0;
    
    if (stat.did_play) return true;
    if ((stat.minutes_played || 0) > 0) return true;
    if (hasStats) return true;
    return false;
  };

  const mvpCandidates = useMemo(() => {
    if (!league || !teams || !games || !players || !stats) return [];

    // Filter for current league — only actually played games count for awards
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

    // Team win % and games played — only from actually played games (leagueGames already filtered)
    const teamStats = {};
    leagueTeams.forEach(team => {
      const teamGames = leagueGames.filter(g => g.home_team_id === team.id || g.away_team_id === team.id);
      const wins = teamGames.filter(g =>
        g.home_team_id === team.id ? g.home_score > g.away_score : g.away_score > g.home_score
      ).length;
      teamStats[team.id] = {
        gamesPlayed: teamGames.length, // denominator for eligibility — defaults excluded
        wins,
        winPct: teamGames.length > 0 ? wins / teamGames.length : 0
      };
    });

    // Calculate MVP scores per player
    const playerMvpScores = {};
    leagueGames.forEach(game => {
      const gameStats = stats.filter(s => s.game_id === game.id);
      gameStats.forEach(playerStat => {
        if (!didPlayerParticipate(playerStat)) return;
        
        if (!playerMvpScores[playerStat.player_id]) {
          playerMvpScores[playerStat.player_id] = {
            gp: 0,
            sumGis: 0,
            sumTech: 0,
            sumUnsp: 0,
            teamId: playerStat.team_id
          };
        }
        // entry_type='digital' and not edited = double points_2; otherwise treat as raw points
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

    // Calculate final MVP scores
    const candidates = Object.entries(playerMvpScores)
      .map(([playerId, data]) => {
        const player = players.find(p => p.id === playerId);
        const team = teams.find(t => t.id === data.teamId);
        const teamData = teamStats[data.teamId];
        
        if (!player || !team || !teamData) return null;

        const avgGis = data.gp > 0 ? data.sumGis / data.gp : 0;
        const gpPct = teamData.gamesPlayed > 0 ? data.gp / teamData.gamesPlayed : 0;
        const eligible = gpPct >= cfg.mvp_min_games_percent / 100;

        if (!eligible) return null;

        const teamBonus = cfg.mvp_team_win_percent_weight * teamData.winPct;
        const mvpScore = cfg.mvp_avg_gis_weight * avgGis + cfg.mvp_gp_percent_weight * gpPct + teamBonus - cfg.mvp_tech_final_penalty * data.sumTech - cfg.mvp_unsp_final_penalty * data.sumUnsp;

        return {
          playerId,
          player,
          team,
          gp: data.gp,
          avgGis: avgGis.toFixed(1),
          gpPct: (gpPct * 100).toFixed(1),
          mvpScore: mvpScore.toFixed(1),
          mvpScoreNum: mvpScore
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.mvpScoreNum - a.mvpScoreNum)
      .slice(0, 10);

    return candidates;
  }, [league, teams, games, players, stats]);

  const dpoyLeaders = useMemo(() => {
    if (!league || !teams || !games || !players || !stats) return [];

    const leagueTeams = teams.filter(t => t.league_id === league.id);
    // Only actually played games count for DPOY
    const leagueGames = games.filter(g => {
      const homeTeam = teams.find(t => t.id === g.home_team_id);
      const awayTeam = teams.find(t => t.id === g.away_team_id);
      return (
        (homeTeam?.league_id === league.id || awayTeam?.league_id === league.id) &&
        isActualPlayedGame(g)
      );
    });

    if (leagueGames.length === 0) return [];

    // Eligibility denominator — only actually played games per team
    const teamGames = {};
    leagueTeams.forEach(team => {
      teamGames[team.id] = leagueGames.filter(g => g.home_team_id === team.id || g.away_team_id === team.id).length;
    });

    // Calculate DPOY scores (based on defensive stats)
    const playerDpoyScores = {};
    leagueGames.forEach(game => {
      const gameStats = stats.filter(s => s.game_id === game.id);
      gameStats.forEach(playerStat => {
        if (!didPlayerParticipate(playerStat)) return;
        
        if (!playerDpoyScores[playerStat.player_id]) {
          playerDpoyScores[playerStat.player_id] = {
            gp: 0,
            sumDefGis: 0,
            sumTech: 0,
            sumUnsp: 0,
            teamId: playerStat.team_id
          };
        }
        
        const defGis = cfg.dpoy_stl_weight * (playerStat.steals || 0) +
          cfg.dpoy_blk_weight * (playerStat.blocks || 0) +
          cfg.dpoy_oreb_weight * (playerStat.offensive_rebounds || 0) +
          cfg.dpoy_dreb_weight * (playerStat.defensive_rebounds || 0) -
          cfg.dpoy_foul_penalty * (playerStat.fouls || 0) -
          cfg.dpoy_turnover_penalty * (playerStat.turnovers || 0) -
          cfg.dpoy_tech_penalty * (playerStat.technical_fouls || 0) -
          cfg.dpoy_unsportsmanlike_penalty * (playerStat.unsportsmanlike_fouls || 0);

        playerDpoyScores[playerStat.player_id].gp += 1;
        playerDpoyScores[playerStat.player_id].sumDefGis += defGis;
        playerDpoyScores[playerStat.player_id].sumTech += playerStat.technical_fouls || 0;
        playerDpoyScores[playerStat.player_id].sumUnsp += playerStat.unsportsmanlike_fouls || 0;
      });
    });

    const leaders = Object.entries(playerDpoyScores)
      .map(([playerId, data]) => {
        const player = players.find(p => p.id === playerId);
        const team = teams.find(t => t.id === data.teamId);
        const tg = teamGames[data.teamId];

        if (!player || !team || tg === undefined || data.gp === 0 || tg === 0) return null;

        const gpPct = data.gp / tg;
        const eligible = gpPct >= cfg.dpoy_min_games_percent / 100;

        if (!eligible) return null;

        const avgDefGis = data.sumDefGis / data.gp;
        const dpoyScore = avgDefGis + cfg.dpoy_gp_percent_weight * gpPct - cfg.dpoy_tech_final_penalty * data.sumTech - cfg.dpoy_unsp_final_penalty * data.sumUnsp;

        return {
          playerId,
          player,
          team,
          gp: data.gp,
          avgDefGis: avgDefGis.toFixed(1),
          gpPct: (gpPct * 100).toFixed(1),
          sumTech: data.sumTech,
          sumUnsp: data.sumUnsp,
          dpoyScore: dpoyScore.toFixed(1),
          dpoyScoreNum: dpoyScore
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.dpoyScoreNum - a.dpoyScoreNum)
      .slice(0, 5);

    return leaders;
  }, [league, teams, games, players, stats]);

  const mythical5 = mvpCandidates.slice(0, cfg.mythical_five_count);

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Season Awards
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="mvp" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mvp">MVP</TabsTrigger>
            <TabsTrigger value="dpoy">DPOY</TabsTrigger>
          </TabsList>

          <TabsContent value="mvp" className="space-y-4">
            {mvpCandidates.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No MVP candidates yet</p>
            ) : (
              <>
                {/* Mobile: Stacked Cards */}
                <div className="block md:hidden">
                  <MobileAwardCards candidates={mvpCandidates} awardType="mvp" />
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Rank</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-center">GP</TableHead>
                        <TableHead className="text-center">Avg GIS</TableHead>
                        <TableHead className="text-center">MVP Score</TableHead>
                        <TableHead>Award</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mvpCandidates.map((candidate, index) => (
                        <TableRow key={candidate.playerId} className={index === 0 ? "bg-yellow-50" : ""}>
                          <TableCell className="font-bold">{index + 1}</TableCell>
                          <TableCell className="font-medium">{candidate.player.name}</TableCell>
                          <TableCell>{candidate.team.name}</TableCell>
                          <TableCell className="text-center">{candidate.gp}</TableCell>
                          <TableCell className="text-center">{candidate.avgGis}</TableCell>
                          <TableCell className="text-center font-bold text-purple-600">{candidate.mvpScore}</TableCell>
                          <TableCell>
                            {index === 0 && <Badge className="bg-yellow-500">MVP</Badge>}
                            {index > 0 && index < 5 && <Badge className="bg-purple-500">Mythical {index}</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="space-y-2 text-sm text-slate-700">
                    <p className="font-semibold flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      Most Valuable Player (MVP)
                    </p>
                    <p>The MVP is awarded to the player with the highest overall impact across the season.</p>
                    <p className="font-medium mt-3">The MVP is calculated automatically based on:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>All-around performance (scoring, rebounds, assists, steals, and blocks)</li>
                      <li>Consistency (average impact per game, not just single big games)</li>
                      <li>Availability (games played during the season)</li>
                      <li>Team performance</li>
                      <li>Sportsmanship (technical and unsportsmanlike fouls reduce the score)</li>
                    </ul>
                    <p className="mt-3">To be eligible, a player must play in at least 60% of their team's completed games.</p>
                    <p>All calculations use only completed games and apply the same formula to every player.</p>
                    <p>There are no votes, opinions, or manual adjustments.</p>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="dpoy" className="space-y-4">
            {dpoyLeaders.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No DPOY candidates yet</p>
            ) : (
              <>
                {/* Mobile: Stacked Cards */}
                <div className="block md:hidden">
                  <MobileAwardCards candidates={dpoyLeaders} awardType="dpoy" />
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Rank</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-center">GP</TableHead>
                        <TableHead className="text-center">Avg DEF_GIS</TableHead>
                        <TableHead className="text-center">DPOY Score</TableHead>
                        <TableHead className="text-center">Award</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dpoyLeaders.map((leader, index) => (
                        <TableRow key={leader.playerId} className={index === 0 ? "bg-blue-50" : ""}>
                          <TableCell className="font-bold">{index + 1}</TableCell>
                          <TableCell className="font-medium">{leader.player.name}</TableCell>
                          <TableCell>{leader.team.name}</TableCell>
                          <TableCell className="text-center">{leader.gp}</TableCell>
                          <TableCell className="text-center">{leader.avgDefGis}</TableCell>
                          <TableCell className="text-center font-bold text-blue-600">{leader.dpoyScore}</TableCell>
                          <TableCell className="text-center">{index === 0 ? <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">DPOY</span> : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="space-y-2 text-sm text-slate-700">
                    <p className="font-semibold flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      Defensive Player of the Year (DPOY)
                    </p>
                    <p>The Defensive Player of the Year recognizes the player with the strongest defensive impact across the season.</p>
                    <p className="font-medium mt-3">The DPOY is calculated based on:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Defensive actions (steals, blocks, and rebounds)</li>
                      <li>Defensive discipline (fewer fouls and technicals score higher)</li>
                      <li>Consistency and availability throughout the season</li>
                      <li>Scoring points is not included in the DPOY calculation, making the award fair for all positions</li>
                    </ul>
                    <p className="mt-3">To be eligible, a player must play in at least 60% of their team's completed games.</p>
                    <p>The award is fully data-driven and updates automatically as game stats are recorded.</p>
                    <p className="font-semibold mt-3">⚖️ Fair &amp; Transparent</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Same rules for all players</li>
                      <li>Same formula for the entire season</li>
                      <li>No popularity or reputation bias</li>
                      <li>No manual overrides</li>
                    </ul>
                    <p className="mt-3">Awards are earned on the court and backed by data.</p>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy, Shield } from "lucide-react";

export default function AwardLeaders({ league, teams, games, players, stats }) {
  const mvpCandidates = useMemo(() => {
    if (!league || !teams || !games || !players || !stats) return [];

    // Filter for current league
    const leagueTeams = teams.filter(t => t.league_id === league.id);
    const leagueGames = games.filter(g => {
      const homeTeam = teams.find(t => t.id === g.home_team_id);
      const awayTeam = teams.find(t => t.id === g.away_team_id);
      return (homeTeam?.league_id === league.id || awayTeam?.league_id === league.id) && g.status === "completed";
    });

    if (leagueGames.length === 0) return [];

    // Calculate team games and win percentages
    const teamStats = {};
    leagueTeams.forEach(team => {
      const teamGames = leagueGames.filter(g => g.home_team_id === team.id || g.away_team_id === team.id);
      const wins = teamGames.filter(g => {
        if (g.home_team_id === team.id) return g.home_score > g.away_score;
        return g.away_score > g.home_score;
      }).length;
      teamStats[team.id] = {
        gamesPlayed: teamGames.length,
        wins,
        winPct: teamGames.length > 0 ? wins / teamGames.length : 0
      };
    });

    // Calculate MVP scores per player
    const playerMvpScores = {};
    leagueGames.forEach(game => {
      const gameStats = stats.filter(s => s.game_id === game.id);
      gameStats.forEach(playerStat => {
        if (!playerMvpScores[playerStat.player_id]) {
          playerMvpScores[playerStat.player_id] = {
            gp: 0,
            sumGis: 0,
            sumTech: 0,
            sumUnsp: 0,
            teamId: playerStat.team_id
          };
        }
        const pts = (playerStat.points_2 || 0) * 2 + (playerStat.points_3 || 0) * 3 + (playerStat.free_throws || 0);
        const gis = pts +
          1.2 * (playerStat.offensive_rebounds || 0) +
          1.0 * (playerStat.defensive_rebounds || 0) +
          1.5 * (playerStat.assists || 0) +
          2.5 * (playerStat.steals || 0) +
          2.0 * (playerStat.blocks || 0) -
          2.0 * (playerStat.turnovers || 0) -
          0.5 * (playerStat.fouls || 0) -
          3.0 * (playerStat.technical_fouls || 0) -
          4.0 * (playerStat.unsportsmanlike_fouls || 0);

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
        const eligible = gpPct >= 0.60;

        if (!eligible) return null;

        const teamBonus = 20 * teamData.winPct;
        const mvpScore = 0.60 * avgGis + 20 * gpPct + teamBonus - 3 * data.sumTech - 5 * data.sumUnsp;

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
    const leagueGames = games.filter(g => {
      const homeTeam = teams.find(t => t.id === g.home_team_id);
      const awayTeam = teams.find(t => t.id === g.away_team_id);
      return (homeTeam?.league_id === league.id || awayTeam?.league_id === league.id) && g.status === "completed";
    });

    if (leagueGames.length === 0) return [];

    // Calculate team games for eligibility
    const teamGames = {};
    leagueTeams.forEach(team => {
      const count = leagueGames.filter(g => g.home_team_id === team.id || g.away_team_id === team.id).length;
      teamGames[team.id] = count;
    });

    // Calculate DPOY scores (based on defensive stats)
    const playerDpoyScores = {};
    leagueGames.forEach(game => {
      const gameStats = stats.filter(s => s.game_id === game.id);
      gameStats.forEach(playerStat => {
        if (!playerDpoyScores[playerStat.player_id]) {
          playerDpoyScores[playerStat.player_id] = {
            gp: 0,
            steals: 0,
            blocks: 0,
            dreb: 0,
            teamId: playerStat.team_id
          };
        }
        playerDpoyScores[playerStat.player_id].gp += 1;
        playerDpoyScores[playerStat.player_id].steals += playerStat.steals || 0;
        playerDpoyScores[playerStat.player_id].blocks += playerStat.blocks || 0;
        playerDpoyScores[playerStat.player_id].dreb += playerStat.defensive_rebounds || 0;
      });
    });

    const leaders = Object.entries(playerDpoyScores)
      .map(([playerId, data]) => {
        const player = players.find(p => p.id === playerId);
        const team = teams.find(t => t.id === data.teamId);
        const tg = teamGames[data.teamId];

        if (!player || !team || tg === undefined) return null;

        const gpPct = tg > 0 ? data.gp / tg : 0;
        const eligible = gpPct >= 0.60;

        if (!eligible) return null;

        // DPOY score: weighted combination of defensive stats
        const dpoyScore = (2.5 * data.steals + 2.0 * data.blocks + 1.0 * data.dreb) / data.gp;

        return {
          playerId,
          player,
          team,
          gp: data.gp,
          spg: (data.steals / data.gp).toFixed(1),
          bpg: (data.blocks / data.gp).toFixed(1),
          drpg: (data.dreb / data.gp).toFixed(1),
          dpoyScore: dpoyScore.toFixed(1),
          dpoyScoreNum: dpoyScore
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.dpoyScoreNum - a.dpoyScoreNum)
      .slice(0, 5);

    return leaders;
  }, [league, teams, games, players, stats]);

  const mythical5 = mvpCandidates.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* MVP Award */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            MVP Candidates - Top 10
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mvpCandidates.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No MVP candidates yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">GP</TableHead>
                    <TableHead className="text-center">GP %</TableHead>
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
                      <TableCell className="text-center">{candidate.gpPct}%</TableCell>
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
          )}
        </CardContent>
      </Card>

      {/* DPOY Award */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Defensive Player of the Year - Top 5
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dpoyLeaders.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No DPOY candidates yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">GP</TableHead>
                    <TableHead className="text-center">SPG</TableHead>
                    <TableHead className="text-center">BPG</TableHead>
                    <TableHead className="text-center">DRPG</TableHead>
                    <TableHead className="text-center">DPOY Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dpoyLeaders.map((leader, index) => (
                    <TableRow key={leader.playerId} className={index === 0 ? "bg-blue-50" : ""}>
                      <TableCell className="font-bold">{index + 1}</TableCell>
                      <TableCell className="font-medium">{leader.player.name}</TableCell>
                      <TableCell>{leader.team.name}</TableCell>
                      <TableCell className="text-center">{leader.gp}</TableCell>
                      <TableCell className="text-center">{leader.spg}</TableCell>
                      <TableCell className="text-center">{leader.bpg}</TableCell>
                      <TableCell className="text-center">{leader.drpg}</TableCell>
                      <TableCell className="text-center font-bold text-blue-600">{leader.dpoyScore}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
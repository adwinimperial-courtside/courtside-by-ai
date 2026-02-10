import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

export default function GameStats({ games, teams, players, stats }) {
  const [expandedGame, setExpandedGame] = useState(null);
  
  const completedGames = games
    .filter(g => g.status === 'completed')
    .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));

  const hasStats = (stat) => {
    return (stat.points_2 || 0) > 0 || 
           (stat.points_3 || 0) > 0 || 
           (stat.free_throws || 0) > 0 || 
           (stat.offensive_rebounds || 0) > 0 || 
           (stat.defensive_rebounds || 0) > 0 || 
           (stat.assists || 0) > 0 || 
           (stat.steals || 0) > 0 || 
           (stat.blocks || 0) > 0 || 
           (stat.turnovers || 0) > 0 || 
           (stat.fouls || 0) > 0;
  };

  const getTopPerformer = (gameId) => {
    const gameStats = stats.filter(s => s.game_id === gameId && hasStats(s));
    if (gameStats.length === 0) return null;

    const playerWithStats = gameStats.map(stat => {
      const player = players.find(p => p.id === stat.player_id);
      const points = ((stat.points_2 || 0) * 2) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0);
      return { player, stat, points };
    });

    return playerWithStats.sort((a, b) => b.points - a.points)[0];
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-600" />
          Game Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {completedGames.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No completed games yet</p>
        ) : (
          <div className="space-y-4">
            {completedGames.map(game => {
              const homeTeam = teams.find(t => t.id === game.home_team_id);
              const awayTeam = teams.find(t => t.id === game.away_team_id);
              const topPerformer = getTopPerformer(game.id);
              const gamePlayerStats = stats.filter(s => s.game_id === game.id);
              
              const homeStats = gamePlayerStats.filter(s => s.team_id === game.home_team_id);
              const awayStats = gamePlayerStats.filter(s => s.team_id === game.away_team_id);
              
              const homeTeamStats = {
                rebounds: homeStats.reduce((acc, s) => acc + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0),
                assists: homeStats.reduce((acc, s) => acc + (s.assists || 0), 0),
                fouls: homeStats.reduce((acc, s) => acc + (s.fouls || 0), 0),
              };
              
              const awayTeamStats = {
                rebounds: awayStats.reduce((acc, s) => acc + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0),
                assists: awayStats.reduce((acc, s) => acc + (s.assists || 0), 0),
                fouls: awayStats.reduce((acc, s) => acc + (s.fouls || 0), 0),
              };

              const isExpanded = expandedGame === game.id;
              const homePlayerStats = gamePlayerStats.filter(s => s.team_id === game.home_team_id && hasStats(s));
              const awayPlayerStats = gamePlayerStats.filter(s => s.team_id === game.away_team_id && hasStats(s));

              return (
                <Card key={game.id} className="border-slate-200 bg-gradient-to-br from-white to-slate-50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-slate-500">
                        {format(new Date(game.game_date), 'MMM d, yyyy • h:mm a')}
                      </p>
                      <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                        Final
                      </span>
                    </div>

                    {/* Score Display */}
                    <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center mb-6">
                      {/* Away Team */}
                       <div className="text-right">
                         <div className="flex items-center justify-end gap-3 mb-2">
                           <span className="text-lg font-semibold text-slate-900">{awayTeam?.name}</span>
                           {awayTeam?.logo_url ? (
                             <img src={awayTeam.logo_url} alt={awayTeam.name} className="w-10 h-10 rounded-lg object-cover" />
                           ) : (
                             <div 
                               className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                               style={{ backgroundColor: awayTeam?.color || '#f97316' }}
                             >
                               {awayTeam?.name?.[0]}
                             </div>
                           )}
                         </div>
                        <p className="text-sm text-slate-500">
                          {awayTeamStats.rebounds} REB • {awayTeamStats.assists} AST • {awayTeamStats.fouls} FOULS
                        </p>
                      </div>

                      {/* Score */}
                      <div className="text-center px-6">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl font-bold text-slate-900">{game.away_score || 0}</span>
                          <span className="text-2xl text-slate-400">-</span>
                          <span className="text-3xl font-bold text-slate-900">{game.home_score || 0}</span>
                        </div>
                      </div>

                      {/* Home Team */}
                      <div className="text-left">
                        <div className="flex items-center gap-3 mb-2">
                          {homeTeam?.logo_url ? (
                            <img src={homeTeam.logo_url} alt={homeTeam.name} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div 
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: homeTeam?.color || '#f97316' }}
                            >
                              {homeTeam?.name?.[0]}
                            </div>
                          )}
                          <span className="text-lg font-semibold text-slate-900">{homeTeam?.name}</span>
                        </div>
                        <p className="text-sm text-slate-500">
                          {homeTeamStats.rebounds} REB • {homeTeamStats.assists} AST • {homeTeamStats.fouls} FOULS
                        </p>
                      </div>
                    </div>

                    {/* Top Performer */}
                    {topPerformer && (
                      <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                        <p className="text-xs font-semibold text-purple-600 mb-2">TOP PERFORMER</p>
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: teams.find(t => t.id === topPerformer.player?.team_id)?.color || '#f97316' }}
                          >
                            {topPerformer.player?.jersey_number}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">{topPerformer.player?.name}</p>
                            <p className="text-sm text-slate-600">{teams.find(t => t.id === topPerformer.player?.team_id)?.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-purple-600">{topPerformer.points}</p>
                            <p className="text-xs text-slate-500">points</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* View Details Button */}
                    <Button
                      variant="outline"
                      onClick={() => setExpandedGame(isExpanded ? null : game.id)}
                      className="w-full mt-4"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4 mr-2" />
                          Hide Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 mr-2" />
                          View Player Stats
                        </>
                      )}
                    </Button>

                    {/* Expanded Player Stats */}
                    {isExpanded && (
                      <div className="mt-6 space-y-6">
                        {/* Away Team Stats */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            {awayTeam?.logo_url ? (
                              <img src={awayTeam.logo_url} alt={awayTeam.name} className="w-8 h-8 rounded-lg object-cover" />
                            ) : (
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                                style={{ backgroundColor: awayTeam?.color || '#f97316' }}
                              >
                                {awayTeam?.name?.[0]}
                              </div>
                            )}
                            <h4 className="font-semibold text-slate-900">{awayTeam?.name}</h4>
                          </div>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Player</TableHead>
                                  <TableHead className="text-center">PTS</TableHead>
                                  <TableHead className="text-center">2PT</TableHead>
                                  <TableHead className="text-center">3PT</TableHead>
                                  <TableHead className="text-center">FT</TableHead>
                                  <TableHead className="text-center">OREB</TableHead>
                                  <TableHead className="text-center">DREB</TableHead>
                                  <TableHead className="text-center">REB</TableHead>
                                  <TableHead className="text-center">AST</TableHead>
                                  <TableHead className="text-center">STL</TableHead>
                                  <TableHead className="text-center">BLK</TableHead>
                                  <TableHead className="text-center">TO</TableHead>
                                  <TableHead className="text-center">FOULS</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {awayPlayerStats.map(stat => {
                                  const player = players.find(p => p.id === stat.player_id);
                                  const points = ((stat.points_2 || 0) * 2) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0);
                                  const rebounds = (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0);
                                  return (
                                    <TableRow key={stat.id}>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <div 
                                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                            style={{ backgroundColor: awayTeam?.color || '#f97316' }}
                                          >
                                            {player?.jersey_number}
                                          </div>
                                          <span className="text-sm">{player?.name}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center font-semibold">{points}</TableCell>
                                      <TableCell className="text-center">{stat.points_2 || 0}</TableCell>
                                      <TableCell className="text-center">{stat.points_3 || 0}</TableCell>
                                      <TableCell className="text-center">{stat.free_throws || 0}</TableCell>
                                      <TableCell className="text-center">{stat.offensive_rebounds || 0}</TableCell>
                                      <TableCell className="text-center">{stat.defensive_rebounds || 0}</TableCell>
                                      <TableCell className="text-center">{rebounds}</TableCell>
                                      <TableCell className="text-center">{stat.assists || 0}</TableCell>
                                      <TableCell className="text-center">{stat.steals || 0}</TableCell>
                                      <TableCell className="text-center">{stat.blocks || 0}</TableCell>
                                      <TableCell className="text-center">{stat.turnovers || 0}</TableCell>
                                      <TableCell className="text-center">{stat.fouls || 0}</TableCell>
                                    </TableRow>
                                  );
                                })}
                                <TableRow className="bg-slate-50 font-semibold">
                                  <TableCell>TEAM TOTALS</TableCell>
                                  <TableCell className="text-center">{game.away_score || 0}</TableCell>
                                  <TableCell className="text-center">{awayPlayerStats.reduce((acc, s) => acc + (s.points_2 || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{awayPlayerStats.reduce((acc, s) => acc + (s.points_3 || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{awayPlayerStats.reduce((acc, s) => acc + (s.free_throws || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{awayPlayerStats.reduce((acc, s) => acc + (s.offensive_rebounds || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{awayPlayerStats.reduce((acc, s) => acc + (s.defensive_rebounds || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{awayTeamStats.rebounds}</TableCell>
                                  <TableCell className="text-center">{awayTeamStats.assists}</TableCell>
                                  <TableCell className="text-center">{awayPlayerStats.reduce((acc, s) => acc + (s.steals || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{awayPlayerStats.reduce((acc, s) => acc + (s.blocks || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{awayPlayerStats.reduce((acc, s) => acc + (s.turnovers || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{awayTeamStats.fouls}</TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        {/* Home Team Stats */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                              style={{ backgroundColor: homeTeam?.color || '#f97316' }}
                            >
                              {homeTeam?.name?.[0]}
                            </div>
                            <h4 className="font-semibold text-slate-900">{homeTeam?.name}</h4>
                          </div>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Player</TableHead>
                                  <TableHead className="text-center">PTS</TableHead>
                                  <TableHead className="text-center">2PT</TableHead>
                                  <TableHead className="text-center">3PT</TableHead>
                                  <TableHead className="text-center">FT</TableHead>
                                  <TableHead className="text-center">OREB</TableHead>
                                  <TableHead className="text-center">DREB</TableHead>
                                  <TableHead className="text-center">REB</TableHead>
                                  <TableHead className="text-center">AST</TableHead>
                                  <TableHead className="text-center">STL</TableHead>
                                  <TableHead className="text-center">BLK</TableHead>
                                  <TableHead className="text-center">TO</TableHead>
                                  <TableHead className="text-center">FOULS</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {homePlayerStats.map(stat => {
                                  const player = players.find(p => p.id === stat.player_id);
                                  const points = ((stat.points_2 || 0) * 2) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0);
                                  const rebounds = (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0);
                                  return (
                                    <TableRow key={stat.id}>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <div 
                                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                            style={{ backgroundColor: homeTeam?.color || '#f97316' }}
                                          >
                                            {player?.jersey_number}
                                          </div>
                                          <span className="text-sm">{player?.name}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center font-semibold">{points}</TableCell>
                                      <TableCell className="text-center">{stat.points_2 || 0}</TableCell>
                                      <TableCell className="text-center">{stat.points_3 || 0}</TableCell>
                                      <TableCell className="text-center">{stat.free_throws || 0}</TableCell>
                                      <TableCell className="text-center">{stat.offensive_rebounds || 0}</TableCell>
                                      <TableCell className="text-center">{stat.defensive_rebounds || 0}</TableCell>
                                      <TableCell className="text-center">{rebounds}</TableCell>
                                      <TableCell className="text-center">{stat.assists || 0}</TableCell>
                                      <TableCell className="text-center">{stat.steals || 0}</TableCell>
                                      <TableCell className="text-center">{stat.blocks || 0}</TableCell>
                                      <TableCell className="text-center">{stat.turnovers || 0}</TableCell>
                                      <TableCell className="text-center">{stat.fouls || 0}</TableCell>
                                    </TableRow>
                                  );
                                })}
                                <TableRow className="bg-slate-50 font-semibold">
                                  <TableCell>TEAM TOTALS</TableCell>
                                  <TableCell className="text-center">{game.home_score || 0}</TableCell>
                                  <TableCell className="text-center">{homePlayerStats.reduce((acc, s) => acc + (s.points_2 || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{homePlayerStats.reduce((acc, s) => acc + (s.points_3 || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{homePlayerStats.reduce((acc, s) => acc + (s.free_throws || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{homePlayerStats.reduce((acc, s) => acc + (s.offensive_rebounds || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{homePlayerStats.reduce((acc, s) => acc + (s.defensive_rebounds || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{homeTeamStats.rebounds}</TableCell>
                                  <TableCell className="text-center">{homeTeamStats.assists}</TableCell>
                                  <TableCell className="text-center">{homePlayerStats.reduce((acc, s) => acc + (s.steals || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{homePlayerStats.reduce((acc, s) => acc + (s.blocks || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{homePlayerStats.reduce((acc, s) => acc + (s.turnovers || 0), 0)}</TableCell>
                                  <TableCell className="text-center">{homeTeamStats.fouls}</TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
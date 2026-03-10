import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, MapPin, Play, CheckCircle, ChevronDown, ChevronUp, Trophy, Activity } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import TeamLogo from "../teams/TeamLogo";

export default function GameCard({ game, teams, leagues, players, stats, onStartGame, currentUser }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLiveExpanded, setIsLiveExpanded] = useState(false);
  const [liveGame, setLiveGame] = useState(game);
  const [liveStats, setLiveStats] = useState(stats?.filter(s => s.game_id === game.id) || []);

  const isAdmin = currentUser?.user_type === 'league_admin' || currentUser?.user_type === 'app_admin';

  useEffect(() => {
    setLiveGame(game);
  }, [game]);

  useEffect(() => {
    if (game.status === 'in_progress') {
      const unsubscribeGame = base44.entities.Game.subscribe((event) => {
        if (event.id === game.id && event.type === 'update') {
          setLiveGame(event.data);
        }
      });
      const unsubscribeStats = base44.entities.PlayerStats.subscribe(() => {
        base44.entities.PlayerStats.filter({ game_id: game.id }).then(setLiveStats);
      });
      // Initial fetch of live stats
      base44.entities.PlayerStats.filter({ game_id: game.id }).then(setLiveStats);
      return () => {
        unsubscribeGame();
        unsubscribeStats();
      };
    }
  }, [game.id, game.status]);

  const homeTeam = teams.find(t => t.id === liveGame.home_team_id);
  const awayTeam = teams.find(t => t.id === liveGame.away_team_id);
  const league = leagues.find(l => l.id === liveGame.league_id);

  const statusColors = {
    scheduled: "bg-blue-100 text-blue-800",
    in_progress: "bg-orange-100 text-orange-800",
    completed: "bg-green-100 text-green-800"
  };

  const entryTypeColors = {
    manual: "bg-purple-100 text-purple-800",
    digital: "bg-cyan-100 text-cyan-800"
  };

  const editedBadgeColor = "bg-amber-100 text-amber-800";

  const gamePlayerStats = liveGame.status === 'in_progress'
    ? liveStats
    : (stats?.filter(s => s.game_id === liveGame.id) || []);
  
  const hasPlayerStats = (stat) => {
    const points = ((stat.points_2 || 0) * 2) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0);
    return points > 0 || (stat.offensive_rebounds || 0) > 0 || (stat.defensive_rebounds || 0) > 0 || 
           (stat.assists || 0) > 0 || (stat.steals || 0) > 0 || (stat.blocks || 0) > 0 || 
           (stat.turnovers || 0) > 0 || (stat.fouls || 0) > 0 || (stat.technical_fouls || 0) > 0 || 
           (stat.unsportsmanlike_fouls || 0) > 0;
  };
  
  const homePlayerStats = gamePlayerStats.filter(s => s.team_id === liveGame.home_team_id && hasPlayerStats(s));
  const awayPlayerStats = gamePlayerStats.filter(s => s.team_id === liveGame.away_team_id && hasPlayerStats(s));

  // Compute scores from actual player stats (source of truth for completed games)
  const computedHomeScore = gamePlayerStats
    .filter(s => s.team_id === liveGame.home_team_id)
    .reduce((acc, s) => acc + (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0), 0);
  const computedAwayScore = gamePlayerStats
    .filter(s => s.team_id === liveGame.away_team_id)
    .reduce((acc, s) => acc + (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0), 0);
  const displayHomeScore = liveGame.status === 'completed' ? computedHomeScore : liveGame.home_score;
  const displayAwayScore = liveGame.status === 'completed' ? computedAwayScore : liveGame.away_score;

  const homeTeamStats = {
    rebounds: homePlayerStats.reduce((acc, s) => acc + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0),
    assists: homePlayerStats.reduce((acc, s) => acc + (s.assists || 0), 0),
  };

  const awayTeamStats = {
    rebounds: awayPlayerStats.reduce((acc, s) => acc + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0),
    assists: awayPlayerStats.reduce((acc, s) => acc + (s.assists || 0), 0),
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-slate-200 hover:shadow-lg transition-all duration-200">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {league && (
                  <Badge variant="outline" className="text-xs truncate max-w-[160px]">
                    {league.name}
                  </Badge>
                )}
                <Badge className={statusColors[liveGame.status]}>
                  {liveGame.status === 'in_progress' ? 'Live' : liveGame.status.replace('_', ' ')}
                </Badge>
                {liveGame.entry_type && (
                  <Badge className={entryTypeColors[liveGame.entry_type]}>
                    {liveGame.entry_type === 'manual' ? 'Manual Entry' : 'Digital Entry'}
                  </Badge>
                )}
                {liveGame.edited && (
                  <Badge className={editedBadgeColor}>Edited</Badge>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamLogo team={homeTeam} size="md" />
                    <span className="font-semibold text-slate-900 truncate">{homeTeam?.name}</span>
                  </div>
                  {(liveGame.status === 'in_progress' || liveGame.status === 'completed') && (
                      <span className="text-2xl font-bold text-slate-900 ml-2 flex-shrink-0">{displayHomeScore}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamLogo team={awayTeam} size="md" />
                      <span className="font-semibold text-slate-900 truncate">{awayTeam?.name}</span>
                    </div>
                    {(liveGame.status === 'in_progress' || liveGame.status === 'completed') && (
                      <span className="text-2xl font-bold text-slate-900 ml-2 flex-shrink-0">{displayAwayScore}</span>
                    )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>{format(new Date(liveGame.game_date), "MMM d, yyyy • h:mm a")}</span>
                </div>
                {liveGame.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{liveGame.location}</span>
                  </div>
                )}
              </div>

              {liveGame.status === 'completed' && liveGame.player_of_game && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span className="text-slate-600">Player of the Game:</span>
                    <span className="font-semibold text-slate-900">
                      {players?.find(p => p.id === liveGame.player_of_game)?.name || 'Unknown'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex">
              {liveGame.status === 'scheduled' && (currentUser?.user_type === 'league_admin' || currentUser?.user_type === 'app_admin') && (
                <Button
                  onClick={onStartGame}
                  className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Game
                </Button>
              )}
              {liveGame.status === 'in_progress' && (currentUser?.user_type === 'league_admin' || currentUser?.user_type === 'app_admin') && (
                <Button
                  onClick={onStartGame}
                  variant="outline"
                  className="w-full sm:w-auto border-orange-500 text-orange-600 hover:bg-orange-50"
                >
                  Continue
                </Button>
              )}
              {liveGame.status === 'completed' && (
                <Button
                  variant="outline"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full sm:w-auto hover:bg-slate-50"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-2" />
                      Hide Stats
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      View Stats
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Expanded Stats for Completed Games */}
          {liveGame.status === 'completed' && isExpanded && (
            <div className="mt-6 pt-6 border-t border-slate-200 space-y-6">
              {[
                { team: awayTeam, playerStats: awayPlayerStats, teamStats: awayTeamStats, score: displayAwayScore },
                { team: homeTeam, playerStats: homePlayerStats, teamStats: homeTeamStats, score: displayHomeScore },
              ].map(({ team, playerStats, teamStats, score }) => (
                <div key={team?.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <TeamLogo team={team} size="md" />
                    <h4 className="font-semibold text-slate-900 truncate">{team?.name}</h4>
                  </div>

                  {/* Mobile: card per player */}
                  <div className="block sm:hidden space-y-2">
                    {playerStats.map(stat => {
                      const player = players?.find(p => p.id === stat.player_id);
                      const points = ((stat.points_2 || 0) * 2) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0);
                      const rebounds = (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0);
                      return (
                        <div key={stat.id} className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: team?.color || '#f97316' }}>
                              {player?.jersey_number}
                            </div>
                            <span className="font-semibold text-sm text-slate-900 truncate">{player?.name}</span>
                            <span className="ml-auto font-bold text-slate-900">{points} PTS</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-xs text-center">
                            {[
                              ['3PT', stat.points_3 || 0],
                              ['FT', stat.free_throws || 0],
                              ['REB', rebounds],
                              ['AST', stat.assists || 0],
                              ['STL', stat.steals || 0],
                              ['BLK', stat.blocks || 0],
                              ['TO', stat.turnovers || 0],
                              ['F', stat.fouls || 0],
                            ].map(([label, val]) => (
                              <div key={label} className="bg-white rounded p-1">
                                <div className="text-slate-400 text-[10px]">{label}</div>
                                <div className="font-semibold text-slate-800">{val}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {/* Team totals card on mobile */}
                    <div className="bg-slate-800 text-white rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm">TEAM TOTALS</span>
                        <span className="font-bold text-lg">{score ?? 0} PTS</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-xs text-center">
                        {[
                          ['3PT', playerStats.reduce((acc, s) => acc + (s.points_3 || 0), 0)],
                          ['FT', playerStats.reduce((acc, s) => acc + (s.free_throws || 0), 0)],
                          ['REB', teamStats.rebounds],
                          ['AST', teamStats.assists],
                          ['STL', playerStats.reduce((acc, s) => acc + (s.steals || 0), 0)],
                          ['BLK', playerStats.reduce((acc, s) => acc + (s.blocks || 0), 0)],
                          ['TO', playerStats.reduce((acc, s) => acc + (s.turnovers || 0), 0)],
                          ['F', playerStats.reduce((acc, s) => acc + (s.fouls || 0), 0)],
                        ].map(([label, val]) => (
                          <div key={label} className="bg-slate-700 rounded p-1">
                            <div className="text-slate-400 text-[10px]">{label}</div>
                            <div className="font-semibold">{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Desktop: scrollable table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Player</TableHead>
                          <TableHead className="text-center">PTS</TableHead>
                          <TableHead className="text-center">3PT</TableHead>
                          <TableHead className="text-center">FT</TableHead>
                          <TableHead className="text-center">OREB</TableHead>
                          <TableHead className="text-center">DREB</TableHead>
                          <TableHead className="text-center">REB</TableHead>
                          <TableHead className="text-center">AST</TableHead>
                          <TableHead className="text-center">STL</TableHead>
                          <TableHead className="text-center">BLK</TableHead>
                          <TableHead className="text-center">TO</TableHead>
                          <TableHead className="text-center">F</TableHead>
                          <TableHead className="text-center">TF</TableHead>
                          <TableHead className="text-center">UNSPO</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {playerStats.map(stat => {
                          const player = players?.find(p => p.id === stat.player_id);
                          const points = ((stat.points_2 || 0) * 2) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0);
                          const rebounds = (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0);
                          return (
                            <TableRow key={stat.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                    style={{ backgroundColor: team?.color || '#f97316' }}>
                                    {player?.jersey_number}
                                  </div>
                                  <span className="text-sm">{player?.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-semibold">{points}</TableCell>
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
                              <TableCell className="text-center">{stat.technical_fouls || 0}</TableCell>
                              <TableCell className="text-center">{stat.unsportsmanlike_fouls || 0}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-slate-50 font-semibold">
                          <TableCell>TEAM TOTALS</TableCell>
                          <TableCell className="text-center">{score || 0}</TableCell>
                          <TableCell className="text-center">{playerStats.reduce((acc, s) => acc + (s.points_3 || 0), 0)}</TableCell>
                          <TableCell className="text-center">{playerStats.reduce((acc, s) => acc + (s.free_throws || 0), 0)}</TableCell>
                          <TableCell className="text-center">{playerStats.reduce((acc, s) => acc + (s.offensive_rebounds || 0), 0)}</TableCell>
                          <TableCell className="text-center">{playerStats.reduce((acc, s) => acc + (s.defensive_rebounds || 0), 0)}</TableCell>
                          <TableCell className="text-center">{teamStats.rebounds}</TableCell>
                          <TableCell className="text-center">{teamStats.assists}</TableCell>
                          <TableCell className="text-center">{playerStats.reduce((acc, s) => acc + (s.steals || 0), 0)}</TableCell>
                          <TableCell className="text-center">{playerStats.reduce((acc, s) => acc + (s.blocks || 0), 0)}</TableCell>
                          <TableCell className="text-center">{playerStats.reduce((acc, s) => acc + (s.turnovers || 0), 0)}</TableCell>
                          <TableCell className="text-center">{playerStats.reduce((acc, s) => acc + (s.fouls || 0), 0)}</TableCell>
                          <TableCell className="text-center">{playerStats.reduce((acc, s) => acc + (s.technical_fouls || 0), 0)}</TableCell>
                          <TableCell className="text-center">{playerStats.reduce((acc, s) => acc + (s.unsportsmanlike_fouls || 0), 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
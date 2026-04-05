import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { createPageUrl } from "@/utils";
import TeamLogo from "@/components/teams/TeamLogo";
import ClockDisplay from "@/components/live/ClockDisplay";
import LatestActivity from "@/components/live/LatestActivity";

export default function LiveBoxScorePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const gameId = urlParams.get('gameId');
  const [liveGame, setLiveGame] = useState(null);

  const { data: game } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => base44.entities.Game.get(gameId),
    enabled: !!gameId,
    staleTime: 0,
    refetchInterval: 3000,
    refetchOnWindowFocus: true
  });

  // Sync liveGame from query data and real-time subscription
  useEffect(() => {
    if (game) setLiveGame(game);
  }, [game]);

  const { data: allStats = [] } = useQuery({
    queryKey: ['playerStats', gameId],
    queryFn: () => base44.entities.PlayerStats.filter({ game_id: gameId }),
    enabled: !!gameId,
    staleTime: 0,
    refetchInterval: 3000,
    refetchOnWindowFocus: true
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!gameId) return;

    const unsubscribeStats = base44.entities.PlayerStats.subscribe((event) => {
      if (event.data?.game_id === gameId) {
        queryClient.invalidateQueries({ queryKey: ['playerStats', gameId] });
      }
    });

    const unsubscribeGame = base44.entities.Game.subscribe((event) => {
      if (event.id === gameId) {
        setLiveGame(event.data); // update immediately
        queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      }
    });

    const unsubscribeLogs = base44.entities.GameLog.subscribe((event) => {
      if (event.data?.game_id === gameId) {
        queryClient.invalidateQueries({ queryKey: ['gameLogs', gameId, 'latest'] });
      }
    });

    return () => {
      unsubscribeStats();
      unsubscribeGame();
      unsubscribeLogs();
    };
  }, [gameId, queryClient]);



  const { data: homeTeam } = useQuery({
    queryKey: ['team', game?.home_team_id],
    queryFn: () => base44.entities.Team.get(game.home_team_id),
    enabled: !!game?.home_team_id,
    staleTime: 5000,
    refetchOnWindowFocus: false
  });

  const { data: awayTeam } = useQuery({
    queryKey: ['team', game?.away_team_id],
    queryFn: () => base44.entities.Team.get(game.away_team_id),
    enabled: !!game?.away_team_id,
    staleTime: 5000,
    refetchOnWindowFocus: false
  });

  const playerIds = allStats?.map(s => s.player_id) || [];
  const { data: players = [] } = useQuery({
    queryKey: ['players', playerIds],
    queryFn: () => playerIds.length > 0 ? base44.entities.Player.filter({ id: { $in: playerIds } }) : Promise.resolve([]),
    enabled: playerIds.length > 0,
    staleTime: 5000,
    refetchOnWindowFocus: false
  });

  const { data: latestLogs = [] } = useQuery({
    queryKey: ['gameLogs', gameId, 'latest'],
    queryFn: () => base44.entities.GameLog.filter({ game_id: gameId }, '-created_date', 1),
    enabled: !!gameId,
    staleTime: 2000,
    refetchOnWindowFocus: false
  });
  const latestLog = latestLogs[0] || null;

  if (!gameId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Game Not Found</h2>
          <Button onClick={() => navigate(createPageUrl('Schedule'))}>Back to Schedule</Button>
        </div>
      </div>
    );
  }

  const displayGame = liveGame || game;

  if (!displayGame || !homeTeam || !awayTeam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Deduplicate stats by player_id — sum all rows for the same player
  const mergeStatsByPlayer = (statRows) => {
    const map = {};
    statRows.forEach(s => {
      if (!map[s.player_id]) {
        map[s.player_id] = { ...s };
      } else {
        const m = map[s.player_id];
        m.points_2 = (m.points_2 || 0) + (s.points_2 || 0);
        m.points_3 = (m.points_3 || 0) + (s.points_3 || 0);
        m.free_throws = (m.free_throws || 0) + (s.free_throws || 0);
        m.free_throws_missed = (m.free_throws_missed || 0) + (s.free_throws_missed || 0);
        m.offensive_rebounds = (m.offensive_rebounds || 0) + (s.offensive_rebounds || 0);
        m.defensive_rebounds = (m.defensive_rebounds || 0) + (s.defensive_rebounds || 0);
        m.assists = (m.assists || 0) + (s.assists || 0);
        m.steals = (m.steals || 0) + (s.steals || 0);
        m.blocks = (m.blocks || 0) + (s.blocks || 0);
        m.turnovers = (m.turnovers || 0) + (s.turnovers || 0);
        m.fouls = (m.fouls || 0) + (s.fouls || 0);
        m.technical_fouls = (m.technical_fouls || 0) + (s.technical_fouls || 0);
        m.unsportsmanlike_fouls = (m.unsportsmanlike_fouls || 0) + (s.unsportsmanlike_fouls || 0);
        m.minutes_played = (m.minutes_played || 0) + (s.minutes_played || 0);
        // Keep is_active true if any row is active
        if (s.is_active) m.is_active = true;
      }
    });
    return Object.values(map);
  };

  // Show all players who have played in the game (deduplicated)
  const homePlayerStats = mergeStatsByPlayer(allStats.filter(s => s.team_id === displayGame?.home_team_id));
  const awayPlayerStats = mergeStatsByPlayer(allStats.filter(s => s.team_id === displayGame?.away_team_id));

  // Calculate scores from player stats for consistency
  const calcScore = (stats) => stats.reduce((acc, s) => acc + (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0), 0);
  const homeScore = calcScore(homePlayerStats);
  const awayScore = calcScore(awayPlayerStats);



  const StatTable = ({ team, playerStats, game: tGame }) => {
    const game = tGame || displayGame;
    const teamPlayers = playerStats.map(stat => ({
      ...stat,
      player: players.find(p => p.id === stat.player_id)
    })).sort((a, b) => (a.player?.jersey_number || 0) - (b.player?.jersey_number || 0));

    const teamScore = teamPlayers.reduce((acc, s) => acc + (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0), 0);
    const team3PT = teamPlayers.reduce((acc, s) => acc + (s.points_3 || 0), 0);
    const teamFT = teamPlayers.reduce((acc, s) => acc + (s.free_throws || 0), 0);
    const teamREB = teamPlayers.reduce((acc, s) => acc + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0), 0);
    const teamAST = teamPlayers.reduce((acc, s) => acc + (s.assists || 0), 0);
    const teamSTL = teamPlayers.reduce((acc, s) => acc + (s.steals || 0), 0);
    const teamBLK = teamPlayers.reduce((acc, s) => acc + (s.blocks || 0), 0);
    const teamTO = teamPlayers.reduce((acc, s) => acc + (s.turnovers || 0), 0);
    const teamF = teamPlayers.reduce((acc, s) => acc + (s.fouls || 0), 0);

    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TeamLogo team={team} size="md" />
          <h3 className="font-bold text-lg text-slate-900">{team?.name}</h3>
        </div>

        {/* Mobile: Cards */}
        <div className="block md:hidden space-y-2 mb-4">
          {teamPlayers.map(stat => {
            const points = (stat.points_2 || 0) * 2 + (stat.points_3 || 0) * 3 + (stat.free_throws || 0);
            const rebounds = (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0);
            return (
              <div key={stat.id} className="rounded-lg p-3" style={{ backgroundColor: stat.is_active ? 'rgba(34,197,94,0.08)' : '#f8fafc' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: team?.color || '#f97316' }}>
                      {stat.player?.jersey_number}
                    </div>
                    {stat.is_active && <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-green-500 rounded-full"></div>}
                  </div>
                  <span className="font-semibold text-sm text-slate-900 truncate">{stat.player?.name}</span>
                  <span className="ml-auto font-bold text-slate-900">{points} PTS</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-xs text-center">
                  {[['3PT', stat.points_3 || 0], ['FT', stat.free_throws || 0], ['REB', rebounds], ['AST', stat.assists || 0], ['STL', stat.steals || 0], ['BLK', stat.blocks || 0], ['TO', stat.turnovers || 0], ['F', stat.fouls || 0]].map(([label, val]) => (
                    <div key={label} className="bg-white rounded p-1">
                      <div className="text-slate-400 text-[10px]">{label}</div>
                      <div className="font-semibold text-slate-800">{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="bg-slate-800 text-white rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm">TEAM TOTALS</span>
              <span className="font-bold text-lg">{teamScore} PTS</span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-xs text-center">
              {[['3PT', team3PT], ['FT', teamFT], ['REB', teamREB], ['AST', teamAST], ['STL', teamSTL], ['BLK', teamBLK], ['TO', teamTO], ['F', teamF]].map(([label, val]) => (
                <div key={label} className="bg-slate-700 rounded p-1">
                  <div className="text-slate-400 text-[10px]">{label}</div>
                  <div className="font-semibold">{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop: Table */}
        <div className="hidden md:block overflow-x-auto mb-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                {displayGame.game_mode === 'timed' && <TableHead className="text-center">MIN</TableHead>}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamPlayers.map(stat => {
              const points = (stat.points_2 || 0) * 2 + (stat.points_3 || 0) * 3 + (stat.free_throws || 0);
              const rebounds = (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0);
              return (
                <TableRow key={stat.id} style={{ backgroundColor: stat.is_active ? 'rgba(34,197,94,0.08)' : 'transparent' }}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: team?.color || '#f97316' }}>
                          {stat.player?.jersey_number}
                        </div>
                        {stat.is_active && <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-green-500 rounded-full"></div>}
                      </div>
                      <span className="text-sm">{stat.player?.name}</span>
                    </div>
                  </TableCell>
                    {displayGame.game_mode === 'timed' && <TableCell className="text-center">{stat.minutes_played?.toFixed(1) || '0.0'}</TableCell>}
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
                  </TableRow>
                );
              })}
              <TableRow className="bg-slate-50 font-semibold">
                <TableCell>TEAM TOTALS</TableCell>
                {displayGame.game_mode === 'timed' && <TableCell className="text-center">—</TableCell>}
                <TableCell className="text-center">{teamScore}</TableCell>
                <TableCell className="text-center">{team3PT}</TableCell>
                <TableCell className="text-center">{teamFT}</TableCell>
                <TableCell className="text-center">{teamPlayers.reduce((acc, s) => acc + (s.offensive_rebounds || 0), 0)}</TableCell>
                <TableCell className="text-center">{teamPlayers.reduce((acc, s) => acc + (s.defensive_rebounds || 0), 0)}</TableCell>
                <TableCell className="text-center">{teamREB}</TableCell>
                <TableCell className="text-center">{teamAST}</TableCell>
                <TableCell className="text-center">{teamSTL}</TableCell>
                <TableCell className="text-center">{teamBLK}</TableCell>
                <TableCell className="text-center">{teamTO}</TableCell>
                <TableCell className="text-center">{teamF}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(createPageUrl('Schedule'))} className="mb-4 text-slate-600 hover:bg-slate-200/50">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Schedule
          </Button>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">Live Box Score</h1>
            </div>

            {displayGame.status === 'in_progress' && (
              <Badge className="bg-orange-100 text-orange-800 mb-4">Live</Badge>
            )}

            {/* Game info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Home team */}
              <div className="flex flex-col items-center gap-2">
                <TeamLogo team={homeTeam} size="lg" />
                <div className="text-center">
                  <h3 className="font-bold text-lg text-slate-900">{homeTeam?.name}</h3>
                  <p className="text-4xl font-bold text-slate-900">{homeScore}</p>
                </div>
              </div>

              {/* Center info */}
              <div className="flex flex-col items-center">
                <ClockDisplay game={displayGame} />
                <LatestActivity
                  latestLog={latestLog}
                  players={players}
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  game={displayGame}
                />
              </div>

              {/* Away team */}
              <div className="flex flex-col items-center gap-2">
                <TeamLogo team={awayTeam} size="lg" />
                <div className="text-center">
                  <h3 className="font-bold text-lg text-slate-900">{awayTeam?.name}</h3>
                  <p className="text-4xl font-bold text-slate-900">{awayScore}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Tables */}
        <div className="space-y-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <StatTable team={homeTeam} playerStats={homePlayerStats} game={displayGame} />
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <StatTable team={awayTeam} playerStats={awayPlayerStats} game={displayGame} />
          </div>
        </div>
      </div>
    </div>
  );
}
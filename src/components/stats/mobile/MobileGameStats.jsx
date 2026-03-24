import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function MobileGameStats({ games, teams, players, stats }) {
  const [expandedGame, setExpandedGame] = useState(null);

  const completedGames = games
    .filter(g => g.status === 'completed')
    .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));

  const hasStats = (stat) =>
    (stat.points_2 || 0) > 0 || (stat.points_3 || 0) > 0 || (stat.free_throws || 0) > 0 ||
    (stat.offensive_rebounds || 0) > 0 || (stat.defensive_rebounds || 0) > 0 ||
    (stat.assists || 0) > 0 || (stat.steals || 0) > 0 || (stat.blocks || 0) > 0 ||
    (stat.turnovers || 0) > 0 || (stat.fouls || 0) > 0;

  const getTopPerformer = (game) => {
    if (!game.player_of_game) return null;
    const playerStat = stats.find(s => s.game_id === game.id && s.player_id === game.player_of_game);
    if (!playerStat) return null;
    const player = players.find(p => p.id === game.player_of_game);
    const isManual = game.entry_type === 'manual' || game.edited === true;
    const points = isManual
      ? (playerStat.points_2 || 0) + ((playerStat.points_3 || 0) * 3) + (playerStat.free_throws || 0)
      : ((playerStat.points_2 || 0) * 2) + ((playerStat.points_3 || 0) * 3) + (playerStat.free_throws || 0);
    return { player, stat: playerStat, points };
  };

  if (completedGames.length === 0) {
    return <p className="text-slate-500 text-center py-8">No completed games yet</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Calendar className="w-4 h-4 text-purple-600" />
        <h2 className="text-base font-semibold text-slate-900">Game Statistics</h2>
      </div>

      {completedGames.map(game => {
        const homeTeam = teams.find(t => t.id === game.home_team_id);
        const awayTeam = teams.find(t => t.id === game.away_team_id);
        const topPerformer = getTopPerformer(game);
        const gamePlayerStats = stats.filter(s => s.game_id === game.id);
        const homePlayerStats = gamePlayerStats.filter(s => s.team_id === game.home_team_id && hasStats(s));
        const awayPlayerStats = gamePlayerStats.filter(s => s.team_id === game.away_team_id && hasStats(s));
        const isExpanded = expandedGame === game.id;

        const TeamLogo = ({ team, score }) => (
          <div className="flex flex-col items-center gap-1">
            {team?.logo_url ? (
              <img src={team.logo_url} alt={team.name} className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: team?.color || '#f97316' }}
              >
                {team?.name?.[0]}
              </div>
            )}
            <p className="text-xs font-semibold text-slate-700 text-center max-w-[70px] truncate">{team?.name}</p>
            <p className="text-2xl font-extrabold text-slate-900">{score || 0}</p>
          </div>
        );

        const PlayerRow = ({ stat, team }) => {
          const player = players.find(p => p.id === stat.player_id);
          const isManual = game.entry_type === 'manual' || game.edited === true;
          const pts = isManual
            ? (stat.points_2 || 0) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0)
            : ((stat.points_2 || 0) * 2) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0);
          const reb = (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0);
          return (
            <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ backgroundColor: team?.color || '#f97316' }}
              >
                {player?.jersey_number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{player?.name}</p>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                  <span className="font-bold text-purple-600">{pts} PTS</span>
                  <span>•</span>
                  <span>{reb} REB</span>
                  <span>•</span>
                  <span>{stat.assists || 0} AST</span>
                  <span>•</span>
                  <span>{stat.steals || 0} STL</span>
                  <span>•</span>
                  <span>{stat.blocks || 0} BLK</span>
                  <span>•</span>
                  <span>{stat.turnovers || 0} TO</span>
                </div>
              </div>
            </div>
          );
        };

        return (
          <Card key={game.id} className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500">{format(new Date(game.game_date), 'MMM d, yyyy')}</p>
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Final</span>
              </div>

              {/* Score */}
              <div className="flex items-center justify-around mb-4">
                <TeamLogo team={awayTeam} score={game.away_score} />
                <span className="text-xl text-slate-300 font-light">vs</span>
                <TeamLogo team={homeTeam} score={game.home_score} />
              </div>

              {/* Top Performer */}
              {topPerformer && (
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-100 mb-3">
                  <p className="text-[10px] font-semibold text-purple-600 mb-2">TOP PERFORMER</p>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                      style={{ backgroundColor: teams.find(t => t.id === topPerformer.player?.team_id)?.color || '#f97316' }}
                    >
                      {topPerformer.player?.jersey_number}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{topPerformer.player?.name}</p>
                      <p className="text-xs text-slate-500">{teams.find(t => t.id === topPerformer.player?.team_id)?.name}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs">
                    {[
                      { label: 'PTS', val: topPerformer.points },
                      { label: 'REB', val: (topPerformer.stat.offensive_rebounds || 0) + (topPerformer.stat.defensive_rebounds || 0) },
                      { label: 'AST', val: topPerformer.stat.assists || 0 },
                      { label: 'STL', val: topPerformer.stat.steals || 0 },
                      { label: 'BLK', val: topPerformer.stat.blocks || 0 },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className="font-bold text-purple-600 text-sm">{s.val}</p>
                        <p className="text-slate-500">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setExpandedGame(isExpanded ? null : game.id)}
                className="w-full flex items-center justify-center gap-1 text-xs text-purple-600 font-semibold py-2 border border-purple-200 rounded-lg"
              >
                {isExpanded ? <><ChevronUp className="w-3 h-3" /> Hide Player Stats</> : <><ChevronDown className="w-3 h-3" /> View Player Stats</>}
              </button>

              {isExpanded && (
                <div className="mt-4 space-y-4">
                  {/* Away Team */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {awayTeam?.logo_url ? (
                        <img src={awayTeam.logo_url} alt={awayTeam.name} className="w-6 h-6 rounded object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: awayTeam?.color || '#f97316' }}>
                          {awayTeam?.name?.[0]}
                        </div>
                      )}
                      <p className="text-sm font-bold text-slate-800">{awayTeam?.name}</p>
                    </div>
                    {awayPlayerStats.map(stat => <PlayerRow key={stat.id} stat={stat} team={awayTeam} />)}
                  </div>

                  {/* Home Team */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {homeTeam?.logo_url ? (
                        <img src={homeTeam.logo_url} alt={homeTeam.name} className="w-6 h-6 rounded object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: homeTeam?.color || '#f97316' }}>
                          {homeTeam?.name?.[0]}
                        </div>
                      )}
                      <p className="text-sm font-bold text-slate-800">{homeTeam?.name}</p>
                    </div>
                    {homePlayerStats.map(stat => <PlayerRow key={stat.id} stat={stat} team={homeTeam} />)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
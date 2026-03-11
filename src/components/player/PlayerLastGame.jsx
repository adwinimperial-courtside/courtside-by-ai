import React, { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

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

export default function PlayerLastGame({ games, myStats, teams, teamId }) {
  const navigate = useNavigate();

  const lastGame = useMemo(() => {
    if (!teamId || !games.length) return null;
    const completedGames = games
      .filter(g => (g.home_team_id === teamId || g.away_team_id === teamId) && g.status === 'completed')
      .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));
    
    for (const game of completedGames) {
      const stat = myStats.find(s => s.game_id === game.id);
      if (stat && didPlayerParticipate(stat)) {
        return game;
      }
    }
    return null;
  }, [games, teamId, myStats]);

  const statLine = useMemo(
    () => lastGame ? myStats.find(s => s.game_id === lastGame.id) || null : null,
    [lastGame, myStats]
  );

  return (
    <div className={`rounded-2xl shadow-sm border overflow-hidden transition-all ${!lastGame ? 'bg-white border-slate-100' : lastGame.home_team_id === teamId && lastGame.home_score > lastGame.away_score || lastGame.away_team_id === teamId && lastGame.away_score > lastGame.home_score ? 'bg-green-50 border-green-200 border-l-4 border-l-green-500' : 'bg-red-50 border-red-200 border-l-4 border-l-red-500'}`}>
      <div className="px-6 pt-5 pb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Last Game</h3>
        {lastGame && <ChevronRight className="w-4 h-4 text-slate-300" />}
      </div>

      {!lastGame ? (
        <div className="px-6 pb-5 pt-2">
          <p className="text-slate-400 text-sm">No game stats available yet.</p>
        </div>
      ) : (
        <button
          className="w-full text-left px-6 pb-5 hover:opacity-85 transition-opacity"
          onClick={() => navigate(createPageUrl('Schedule'))}
          >
          {(() => {
            const isHome = lastGame.home_team_id === teamId;
            const opponentId = isHome ? lastGame.away_team_id : lastGame.home_team_id;
            const opponent = teams.find(t => t.id === opponentId);
            const myScore = isHome ? lastGame.home_score : lastGame.away_score;
            const oppScore = isHome ? lastGame.away_score : lastGame.home_score;
            const won = myScore > oppScore;

            const pts = statLine ? (statLine.points_2||0)*2 + (statLine.points_3||0)*3 + (statLine.free_throws||0) : null;
            const reb = statLine ? (statLine.offensive_rebounds||0) + (statLine.defensive_rebounds||0) : null;
            const ast = statLine ? statLine.assists || 0 : null;
            const min = statLine ? Math.round(statLine.minutes_played || 0) : null;

            return (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {/* Win/Loss + opponent row */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${won ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                      {won ? 'WIN' : 'LOSS'}
                    </span>
                    <span className={`text-sm font-semibold ${won ? 'text-green-700' : 'text-red-700'} truncate`}>{opponent?.name}</span>
                  </div>

                  {/* Score */}
                  <p className={`text-3xl font-bold ${won ? 'text-green-900' : 'text-red-900'}`}>
                    {myScore} – {oppScore}
                  </p>
                  <p className={`text-sm ${won ? 'text-green-700' : 'text-red-700'} font-medium mt-1`}>vs {opponent?.name}</p>

                  {/* Stat line */}
                  {statLine ? (
                    <div className="flex items-center gap-4 mt-4">
                      <div className="text-center">
                        <p className={`text-lg font-bold ${won ? 'text-green-900' : 'text-red-900'}`}>{pts}</p>
                        <p className={`text-xs font-semibold ${won ? 'text-green-600' : 'text-red-600'}`}>PTS</p>
                      </div>
                      <div className={`w-px h-8 ${won ? 'bg-green-300' : 'bg-red-300'}`} />
                      <div className="text-center">
                        <p className={`text-lg font-bold ${won ? 'text-green-900' : 'text-red-900'}`}>{reb}</p>
                        <p className={`text-xs font-semibold ${won ? 'text-green-600' : 'text-red-600'}`}>REB</p>
                      </div>
                      <div className={`w-px h-8 ${won ? 'bg-green-300' : 'bg-red-300'}`} />
                      <div className="text-center">
                        <p className={`text-lg font-bold ${won ? 'text-green-900' : 'text-red-900'}`}>{ast}</p>
                        <p className={`text-xs font-semibold ${won ? 'text-green-600' : 'text-red-600'}`}>AST</p>
                      </div>
                      {min > 0 && (
                        <>
                          <div className={`w-px h-8 ${won ? 'bg-green-300' : 'bg-red-300'}`} />
                          <div className="text-center">
                            <p className={`text-lg font-bold ${won ? 'text-green-900' : 'text-red-900'}`}>{min}</p>
                            <p className={`text-xs font-semibold ${won ? 'text-green-600' : 'text-red-600'}`}>MIN</p>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className={`text-sm ${won ? 'text-green-600' : 'text-red-600'} mt-3`}>No personal stats recorded.</p>
                  )}

                  <p className={`text-xs ${won ? 'text-green-600' : 'text-red-600'} mt-3 font-medium`}>{format(new Date(lastGame.game_date), "EEE, MMM d")}</p>
                </div>
              </div>
            );
          })()}
        </button>
      )}
    </div>
  );
}
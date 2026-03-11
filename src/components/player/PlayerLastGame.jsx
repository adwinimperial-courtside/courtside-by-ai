import React, { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PlayerLastGame({ games, myStats, teams, teamId }) {
  const navigate = useNavigate();

  const lastGame = useMemo(() => {
    if (!teamId || !games.length) return null;
    return games
      .filter(g => (g.home_team_id === teamId || g.away_team_id === teamId) && g.status === 'completed')
      .sort((a, b) => new Date(b.game_date) - new Date(a.game_date))[0] || null;
  }, [games, teamId]);

  const statLine = useMemo(
    () => lastGame ? myStats.find(s => s.game_id === lastGame.id) || null : null,
    [lastGame, myStats]
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Last Game</h3>
        {lastGame && <ChevronRight className="w-4 h-4 text-slate-300" />}
      </div>

      {!lastGame ? (
        <div className="px-5 pb-5 pt-2">
          <p className="text-slate-400 text-sm">No game stats available yet.</p>
        </div>
      ) : (
        <button
          className="w-full text-left px-5 pb-5 hover:bg-slate-50 transition-colors"
          onClick={() => navigate(createPageUrl(`LiveGame?gameid=${lastGame.id}`))}
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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {/* Win/Loss + opponent row */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${won ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {won ? 'WIN' : 'LOSS'}
                    </span>
                    <span className="text-sm font-semibold text-slate-600 truncate">{opponent?.name}</span>
                  </div>

                  {/* Score */}
                  <p className="text-2xl font-bold text-slate-900">
                    {myScore} – {oppScore}
                    <span className="text-base font-normal text-slate-500 ml-1">vs {opponent?.name}</span>
                  </p>

                  {/* Stat line */}
                  {statLine ? (
                    <div className="flex items-center gap-3 mt-2">
                      <div className="text-center">
                        <p className="text-base font-bold text-slate-800">{pts}</p>
                        <p className="text-xs text-slate-400 font-medium">PTS</p>
                      </div>
                      <div className="w-px h-6 bg-slate-200" />
                      <div className="text-center">
                        <p className="text-base font-bold text-slate-800">{reb}</p>
                        <p className="text-xs text-slate-400 font-medium">REB</p>
                      </div>
                      <div className="w-px h-6 bg-slate-200" />
                      <div className="text-center">
                        <p className="text-base font-bold text-slate-800">{ast}</p>
                        <p className="text-xs text-slate-400 font-medium">AST</p>
                      </div>
                      {min > 0 && (
                        <>
                          <div className="w-px h-6 bg-slate-200" />
                          <div className="text-center">
                            <p className="text-base font-bold text-slate-800">{min}</p>
                            <p className="text-xs text-slate-400 font-medium">MIN</p>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-2">No personal stats recorded.</p>
                  )}

                  <p className="text-xs text-slate-400 mt-2">{format(new Date(lastGame.game_date), "EEE, MMM d")}</p>
                </div>
              </div>
            );
          })()}
        </button>
      )}
    </div>
  );
}
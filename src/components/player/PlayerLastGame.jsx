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

  const statLine = useMemo(() => lastGame ? myStats.find(s => s.game_id === lastGame.id) || null : null, [lastGame, myStats]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Last Game</h3>
        {lastGame && <ChevronRight className="w-4 h-4 text-slate-400" />}
      </div>

      {!lastGame ? (
        <div className="px-5 py-6 text-center">
          <p className="text-slate-400 text-sm">No game stats available yet.</p>
        </div>
      ) : (
        <button
          className="w-full text-left px-5 pb-4 pt-2 hover:bg-slate-50 transition-colors"
          onClick={() => navigate(createPageUrl(`LiveBoxScore?gameId=${lastGame.id}`))}
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
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-500">
                  {opponent?.name?.charAt(0) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${won ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {won ? 'WIN' : 'LOSS'}
                    </span>
                    <span className="text-xs text-slate-500 font-medium truncate">{opponent?.name}</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900">{myScore} – {oppScore} <span className="text-base font-medium text-slate-500">vs {opponent?.name}</span></p>
                  {statLine && (
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      <span className="text-slate-700 font-bold">{pts}</span> PTS&nbsp;
                      <span className="text-slate-700 font-bold">{reb}</span> REB&nbsp;
                      <span className="text-slate-700 font-bold">{ast}</span> AST
                      {min > 0 ? <>&nbsp;<span className="text-slate-700 font-bold">{min}</span> MIN</> : null}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </button>
      )}
    </div>
  );
}
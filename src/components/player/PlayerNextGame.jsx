import React, { useMemo } from "react";
import { Calendar } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PlayerNextGame({ games, teams, teamId }) {
  const navigate = useNavigate();

  const nextGame = useMemo(() => {
    if (!teamId || !games.length) return null;
    const now = new Date();
    return games
      .filter(g => (g.home_team_id === teamId || g.away_team_id === teamId) && g.status === 'scheduled' && new Date(g.game_date) >= now)
      .sort((a, b) => new Date(a.game_date) - new Date(b.game_date))[0] || null;
  }, [games, teamId]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-purple-500 overflow-hidden">
      <div className="px-6 pt-5 pb-2">
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Next Game</h3>
      </div>

      {!nextGame ? (
        <div className="px-6 pb-5 pt-2">
          <p className="text-slate-400 text-sm">No upcoming games scheduled.</p>
        </div>
      ) : (
        <button
          className="w-full text-left px-6 pb-5 hover:bg-purple-50 transition-colors"
          onClick={() => navigate(createPageUrl(`LiveBoxScore?gameId=${nextGame.id}`))}
        >
          {(() => {
            const isHome = nextGame.home_team_id === teamId;
            const opponentId = isHome ? nextGame.away_team_id : nextGame.home_team_id;
            const opponent = teams.find(t => t.id === opponentId);
            const gameDate = new Date(nextGame.game_date);
            const gameDay = isToday(gameDate);
            const tomorrow = isTomorrow(gameDate);
            const dateLabel = gameDay ? "Today" : tomorrow ? "Tomorrow" : format(gameDate, "EEE, MMM d");

            return (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  {/* Opponent avatar */}
                  <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-lg font-bold text-purple-600">
                      {opponent?.name?.charAt(0) || "?"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-slate-900 truncate">{opponent?.name || "TBD"}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <p className="text-sm text-slate-600 font-medium">{dateLabel} · {format(gameDate, "HH:mm")}</p>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1">{isHome ? "🏠 Home" : "🚌 Away"}</p>
                  </div>
                </div>
                {gameDay && (
                  <span className="flex-shrink-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-xs font-bold px-4 py-2 rounded-full shadow-md">
                    Today
                  </span>
                )}
              </div>
            );
          })()}
        </button>
      )}
    </div>
  );
}
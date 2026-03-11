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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 pt-4 pb-1">
        <h3 className="text-sm font-semibold text-slate-700">Next Game</h3>
      </div>

      {!nextGame ? (
        <div className="px-5 py-6 text-center">
          <p className="text-slate-400 text-sm">No upcoming games scheduled.</p>
        </div>
      ) : (
        <button
          className="w-full text-left px-5 pb-4 pt-2 hover:bg-slate-50 transition-colors"
          onClick={() => navigate(createPageUrl(`LiveBoxScore?gameId=${nextGame.id}`))}
        >
          {(() => {
            const isHome = nextGame.home_team_id === teamId;
            const opponentId = isHome ? nextGame.away_team_id : nextGame.home_team_id;
            const opponent = teams.find(t => t.id === opponentId);
            const gameDate = new Date(nextGame.game_date);
            const gameDay = isToday(gameDate);
            const dateLabel = gameDay ? "Today" : isTomorrow(gameDate) ? "Tomorrow" : format(gameDate, "EEE, MMM d");

            return (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-indigo-500">
                    {opponent?.name?.charAt(0) || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-slate-900 truncate">{opponent?.name || "Opponent"}</p>
                    <p className="text-xs text-slate-500">{dateLabel} · {format(gameDate, "HH:mm")}</p>
                  </div>
                </div>
                {gameDay && (
                  <span className="flex-shrink-0 bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                    Game Day
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
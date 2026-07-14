import React, { useMemo } from "react";
import { Calendar } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

// PROFILE_GOLD_V1 — trophy-room palette
const GOLD_HI = "#E5C688";
const GOLD_MID = "#C8A468";
const WARM_WHITE = "#EFE6D4";
const WARM_MUTED = "#877A63";
const CARD_BG = "#100D08";
const CARD_BORDER = "#2A2114";
const INNER_BG = "#1A130C";
const INNER_BORDER = "#3A2E1B";
const GOLD_CHIP_TEXT = "#1A1206";

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
    <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      {!nextGame ? (
        <div className="px-5 py-4">
          <p className="text-[10px] font-bold tracking-[0.12em]" style={{ color: GOLD_MID }}>NEXT GAME</p>
          <p className="text-sm mt-1" style={{ color: WARM_MUTED }}>No upcoming games scheduled.</p>
        </div>
      ) : (
        <button
          className="w-full text-left px-5 py-4 transition-opacity hover:opacity-85"
          onClick={() => navigate(createPageUrl(`LiveBoxScore?gameId=${nextGame.id}`))}
        >
          {(() => {
            const isHome = nextGame.home_team_id === teamId;
            const opponentId = isHome ? nextGame.away_team_id : nextGame.home_team_id;
            const opponent = teams.find(t => t.id === opponentId);
            const gameDate = new Date(nextGame.game_date);
            const gameDay = isToday(gameDate);
            const tomorrow = isTomorrow(gameDate);
            const dateLabel = gameDay ? "TODAY" : tomorrow ? "TOMORROW" : format(gameDate, "EEE, MMM d").toUpperCase();

            return (
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: INNER_BG, border: `1px solid ${INNER_BORDER}` }}
                >
                  <span className="text-lg font-bold" style={{ color: GOLD_MID }}>
                    {opponent?.name?.charAt(0) || "?"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold tracking-[0.12em]" style={{ color: GOLD_MID }}>NEXT GAME</p>
                  <p className="text-lg font-bold uppercase truncate mt-0.5" style={{ color: WARM_WHITE }}>
                    vs {opponent?.name || "TBD"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5" style={{ color: WARM_MUTED }} />
                    <p className="text-[11px] font-medium tracking-wide" style={{ color: WARM_MUTED }}>
                      {dateLabel} · {format(gameDate, "HH:mm")} · {isHome ? "HOME" : "AWAY"}
                    </p>
                  </div>
                </div>
                {gameDay ? (
                  <span
                    className="flex-shrink-0 text-[11px] font-bold tracking-wide px-3 py-1.5 rounded-full"
                    style={{ background: GOLD_MID, color: GOLD_CHIP_TEXT }}
                  >
                    TODAY
                  </span>
                ) : (
                  <span
                    className="flex-shrink-0 text-[11px] font-semibold tracking-wide px-3 py-1.5 rounded-full"
                    style={{ border: `1px solid ${GOLD_MID}`, color: GOLD_HI }}
                  >
                    SCHEDULE
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
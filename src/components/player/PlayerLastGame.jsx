import React, { useMemo } from "react";
import { ChevronRight, Flame, Dumbbell, Handshake, Hand, Ban } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
// CARD_FORMAT_V1 — points math comes from the stat engine (format-aware).
import { calcPoints } from "@/components/stats/statEngine";

// PROFILE_GOLD_V1 — trophy-room palette
const GOLD_MID = "#C8A468";
const WARM_WHITE = "#EFE6D4";
const WARM_MUTED = "#877A63";
const CARD_BG = "#100D08";
const CARD_BORDER = "#2A2114";
const DIVIDER = "#2A2114";
const WIN_BG = "#16241A";
const WIN_TEXT = "#7FBE93";
const LOSS_BG = "#2A1614";
const LOSS_TEXT = "#E29B93";

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

export default function PlayerLastGame({ games, myStats, teams, teamId, formatMap = null }) {
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
    <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-bold tracking-[0.12em]" style={{ color: GOLD_MID }}>LAST GAME</h3>
        {lastGame && <ChevronRight className="w-4 h-4" style={{ color: WARM_MUTED }} />}
      </div>

      {!lastGame ? (
        <div className="px-5 pb-4">
          <p className="text-sm" style={{ color: WARM_MUTED }}>No game stats available yet.</p>
        </div>
      ) : (
        <button
          className="w-full text-left px-5 pb-4 transition-opacity hover:opacity-85"
          onClick={() => navigate(createPageUrl('Schedule'))}
        >
          {(() => {
            const isHome = lastGame.home_team_id === teamId;
            const opponentId = isHome ? lastGame.away_team_id : lastGame.home_team_id;
            const opponent = teams.find(t => t.id === opponentId);
            const myScore = isHome ? lastGame.home_score : lastGame.away_score;
            const oppScore = isHome ? lastGame.away_score : lastGame.home_score;
            const won = myScore > oppScore;

            const pts = statLine ? calcPoints(statLine, lastGame, formatMap ? formatMap[lastGame.id] : undefined) : null; // CARD_FORMAT_V1
            const reb = statLine ? (statLine.offensive_rebounds||0) + (statLine.defensive_rebounds||0) : null;
            const ast = statLine ? statLine.assists || 0 : null;
            const stl = statLine ? statLine.steals || 0 : null; // PROFILE_GOLD_V1 — defense on the line
            const blk = statLine ? statLine.blocks || 0 : null;

            const cols = [
              { label: "PTS", value: pts, Icon: Flame },
              { label: "REB", value: reb, Icon: Dumbbell },
              { label: "AST", value: ast, Icon: Handshake },
              { label: "STL", value: stl, Icon: Hand },
              { label: "BLK", value: blk, Icon: Ban },
            ];

            return (
              <div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-baseline gap-3 min-w-0">
                    <p className="text-2xl font-bold" style={{ color: WARM_WHITE }}>
                      {myScore} – {oppScore}
                    </p>
                    <p className="text-sm font-semibold uppercase truncate" style={{ color: WARM_MUTED }}>
                      vs {opponent?.name}
                    </p>
                  </div>
                  <span
                    className="text-[11px] font-bold tracking-wide px-3 py-1 rounded-full flex-shrink-0"
                    style={won ? { background: WIN_BG, color: WIN_TEXT } : { background: LOSS_BG, color: LOSS_TEXT }}
                  >
                    {won ? "W" : "L"} {myScore}–{oppScore}
                  </span>
                </div>

                {statLine ? (
                  <div className="grid grid-cols-5 mt-4 rounded-xl pt-3 pb-2" style={{ background: "#0B0A08", border: `1px solid ${DIVIDER}` }}>
                    {cols.map(({ label, value, Icon }, i) => (
                      <div
                        key={label}
                        className="text-center"
                        style={i < cols.length - 1 ? { borderRight: `1px solid ${DIVIDER}` } : undefined}
                      >
                        <Icon className="w-4 h-4 mx-auto" style={{ color: WARM_MUTED }} />
                        <p className="text-lg font-bold leading-none mt-1.5" style={{ color: WARM_WHITE }}>{value}</p>
                        <p className="text-[10px] tracking-[0.08em] mt-1" style={{ color: WARM_MUTED }}>{label}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm mt-3" style={{ color: WARM_MUTED }}>No personal stats recorded.</p>
                )}

                <p className="text-[11px] font-medium tracking-wide mt-3" style={{ color: WARM_MUTED }}>
                  {format(new Date(lastGame.game_date), "EEE, MMM d").toUpperCase()}
                </p>
              </div>
            );
          })()}
        </button>
      )}
    </div>
  );
}
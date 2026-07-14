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

  // PROFILE_GOLD_V1 — last THREE games the player appeared in, newest first.
  const recentGames = useMemo(() => {
    if (!teamId || !games.length) return [];
    const completedGames = games
      .filter(g => (g.home_team_id === teamId || g.away_team_id === teamId) && g.status === 'completed')
      .sort((a, b) => new Date(b.game_date) - new Date(a.game_date));

    const result = [];
    for (const game of completedGames) {
      const stat = myStats.find(s => s.game_id === game.id);
      if (stat && didPlayerParticipate(stat)) {
        result.push({ game, stat });
        if (result.length === 3) break;
      }
    }
    return result;
  }, [games, teamId, myStats]);

  const describeGame = ({ game, stat }) => {
    const isHome = game.home_team_id === teamId;
    const opponentId = isHome ? game.away_team_id : game.home_team_id;
    const opponent = teams.find(t => t.id === opponentId);
    const myScore = isHome ? game.home_score : game.away_score;
    const oppScore = isHome ? game.away_score : game.home_score;
    const won = myScore > oppScore;
    const pts = calcPoints(stat, game, formatMap ? formatMap[game.id] : undefined); // CARD_FORMAT_V1
    const reb = (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0);
    const ast = stat.assists || 0;
    const stl = stat.steals || 0;
    const blk = stat.blocks || 0;
    return { opponent, myScore, oppScore, won, pts, reb, ast, stl, blk, date: new Date(game.game_date) };
  };

  const featured = recentGames.length ? describeGame(recentGames[0]) : null;
  const earlier = recentGames.slice(1).map(describeGame);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-bold tracking-[0.12em]" style={{ color: GOLD_MID }}>RECENT GAMES</h3>
        {featured && <ChevronRight className="w-4 h-4" style={{ color: WARM_MUTED }} />}
      </div>

      {!featured ? (
        <div className="px-5 pb-4">
          <p className="text-sm" style={{ color: WARM_MUTED }}>No game stats available yet.</p>
        </div>
      ) : (
        <button
          className="w-full text-left px-5 pb-4 transition-opacity hover:opacity-85"
          onClick={() => navigate(createPageUrl('Schedule'))}
        >
          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-baseline gap-3 min-w-0">
                <p className="text-2xl font-bold" style={{ color: WARM_WHITE }}>
                  {featured.myScore} – {featured.oppScore}
                </p>
                <p className="text-sm font-semibold uppercase truncate" style={{ color: WARM_MUTED }}>
                  vs {featured.opponent?.name}
                </p>
              </div>
              <span
                className="text-[11px] font-bold tracking-wide px-3 py-1 rounded-full flex-shrink-0"
                style={featured.won ? { background: WIN_BG, color: WIN_TEXT } : { background: LOSS_BG, color: LOSS_TEXT }}
              >
                {featured.won ? "W" : "L"} {featured.myScore}–{featured.oppScore}
              </span>
            </div>

            <div className="grid grid-cols-5 mt-4 rounded-xl pt-3 pb-2" style={{ background: "#0B0A08", border: `1px solid ${DIVIDER}` }}>
              {[
                { label: "PTS", value: featured.pts, Icon: Flame },
                { label: "REB", value: featured.reb, Icon: Dumbbell },
                { label: "AST", value: featured.ast, Icon: Handshake },
                { label: "STL", value: featured.stl, Icon: Hand },
                { label: "BLK", value: featured.blk, Icon: Ban },
              ].map(({ label, value, Icon }, i, arr) => (
                <div
                  key={label}
                  className="text-center"
                  style={i < arr.length - 1 ? { borderRight: `1px solid ${DIVIDER}` } : undefined}
                >
                  <Icon className="w-4 h-4 mx-auto" style={{ color: WARM_MUTED }} />
                  <p className="text-lg font-bold leading-none mt-1.5" style={{ color: WARM_WHITE }}>{value}</p>
                  <p className="text-[10px] tracking-[0.08em] mt-1" style={{ color: WARM_MUTED }}>{label}</p>
                </div>
              ))}
            </div>

            <p className="text-[11px] font-medium tracking-wide mt-3" style={{ color: WARM_MUTED }}>
              {format(featured.date, "EEE, MMM d").toUpperCase()}
            </p>

            {/* PROFILE_GOLD_V1 — two earlier games as compact rows */}
            {earlier.length > 0 && (
              <div className="mt-3 pt-1" style={{ borderTop: `1px solid ${DIVIDER}` }}>
                {earlier.map((g, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2.5"
                    style={i < earlier.length - 1 ? { borderBottom: `1px solid ${DIVIDER}` } : undefined}
                  >
                    <span
                      className="text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full flex-shrink-0 w-7 text-center"
                      style={g.won ? { background: WIN_BG, color: WIN_TEXT } : { background: LOSS_BG, color: LOSS_TEXT }}
                    >
                      {g.won ? "W" : "L"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold uppercase truncate" style={{ color: WARM_WHITE }}>
                        vs {g.opponent?.name}
                      </p>
                      <p className="text-[10px] tracking-wide" style={{ color: WARM_MUTED }}>
                        {format(g.date, "MMM d").toUpperCase()} · {g.myScore}–{g.oppScore}
                      </p>
                    </div>
                    <p className="text-xs font-semibold flex-shrink-0" style={{ color: WARM_MUTED }}>
                      <span style={{ color: WARM_WHITE }}>{g.pts}</span>p · <span style={{ color: WARM_WHITE }}>{g.reb}</span>r · <span style={{ color: WARM_WHITE }}>{g.ast}</span>a · <span style={{ color: WARM_WHITE }}>{g.stl}</span>s
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </button>
      )}
    </div>
  );
}
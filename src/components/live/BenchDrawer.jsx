// ─── BenchDrawer ─────────────────────────────────────────────────────────────
// Per-team drawer shown below a team's on-court column when at least one of
// that team's on-court cards is armed for substitution. Tapping a bench chip
// commits a 1-for-1 swap. Compact jersey-number chips so a deep bench stays in
// a couple of rows. A red foul-count badge appears on any chip whose player has
// fouls, as an at-a-glance warning before subbing them in.

import { motion } from "framer-motion";
import { ChevronUp } from "lucide-react";

export default function BenchDrawer({
  benchPlayers = [],
  armedCount = 0,
  existingStats = [],
  onPickBenchPlayer,
}) {
  const sortedBench = [...benchPlayers].sort(
    (a, b) => (a.jersey_number || 0) - (b.jersey_number || 0),
  );
  const benchCount = sortedBench.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden"
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50">
        <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <span className="text-slate-700 truncate" style={{ fontSize: 13, fontWeight: 500 }}>
          Bench — tap a number to swap in
        </span>
        <span className="text-slate-400 whitespace-nowrap" style={{ fontSize: 11, fontWeight: 500 }}>
          · {benchCount} available
        </span>
        <span className="ml-auto text-red-600 whitespace-nowrap" style={{ fontSize: 12, fontWeight: 600 }}>
          {armedCount} slot{armedCount === 1 ? "" : "s"} waiting
        </span>
      </div>

      {/* Body — capped height so a deep bench can't push on-court cards off-screen */}
      <div className="p-2.5 max-h-[40vh] overflow-y-auto">
        {benchCount === 0 ? (
          <div className="text-center text-slate-500 text-xs py-4">
            No bench players available
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 justify-start">
            {sortedBench.map((player) => {
              const pStats = existingStats.find((s) => s.player_id === player.id);
              const fouls = pStats?.fouls || 0;
              const pts =
                ((pStats?.points_2 || 0) * 2) +
                ((pStats?.points_3 || 0) * 3) +
                (pStats?.free_throws || 0);
              const tooltip =
                `#${player.jersey_number} ${player.name}` +
                (fouls > 0 ? ` · ${fouls} foul${fouls === 1 ? "" : "s"}` : "") +
                (pts > 0 ? ` · ${pts} PTS` : "");
              return (
                <motion.button
                  key={player.id}
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onPickBenchPlayer?.(player.id)}
                  title={tooltip}
                  className="relative w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow transition-colors bg-slate-700 hover:bg-slate-800 active:bg-slate-900 flex-shrink-0"
                  style={{ fontSize: 13, lineHeight: 1 }}
                >
                  {player.jersey_number}
                  {fouls > 0 && (
                    <span
                      className="absolute -top-1 -right-1 rounded-full bg-red-600 text-white flex items-center justify-center shadow-sm border border-white"
                      style={{ fontSize: 9, fontWeight: 700, width: 15, height: 15, lineHeight: 1 }}
                    >
                      {fouls}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
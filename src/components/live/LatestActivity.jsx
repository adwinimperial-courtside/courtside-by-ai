import React from "react";

export default function LatestActivity({ latestLog, player, team }) {
  return (
    <div className="mt-3 w-full flex flex-col items-center">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
        Latest Activity
      </p>
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 w-full max-w-[220px] shadow-sm">
        {!latestLog ? (
          <p className="text-xs text-slate-400 italic text-center">No activity recorded yet</p>
        ) : (
          <>
            <div className="flex items-center justify-center gap-1.5 min-w-0">
              {team && (
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: team.color || "#f97316" }}
                />
              )}
              <p className="text-xs font-semibold text-slate-800 truncate">
                {player ? `#${player.jersey_number} ${player.name}` : "Unknown Player"}
              </p>
            </div>
            <p className="text-xs text-slate-600 text-center truncate mt-0.5">
              {latestLog.stat_label || latestLog.stat_type}
            </p>
            {team && (
              <p
                className="text-[10px] text-center truncate mt-0.5 font-medium"
                style={{ color: team.color || "#64748b" }}
              >
                {team.name}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
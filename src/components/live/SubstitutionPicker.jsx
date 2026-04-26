import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";

/**
 * Compact floating substitution picker.
 * Renders inline inside the team column (desktop) or as a centered modal (mobile).
 */
export default function SubstitutionPicker({
  playerOut,
  benchPlayers,       // already filtered to the correct team
  teamId,
  game,
  existingStats,
  onConfirm,          // (playerOut, playerInId) => void
  onCancel,
}) {
  const [selectedInId, setSelectedInId] = useState(null);

  const isHome = teamId === game.home_team_id;
  const accent      = isHome ? "blue"  : "red";
  const headerBg    = isHome ? "bg-blue-600"  : "bg-red-600";
  const borderColor = isHome ? "border-blue-500" : "border-red-500";
  const selBg       = isHome ? "bg-blue-50"   : "bg-red-50";
  const hoverBorder = isHome ? "hover:border-blue-300" : "hover:border-red-300";

  // Sort bench by jersey number ascending
  const sorted = [...benchPlayers].sort(
    (a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999)
  );

  const getStatLine = (playerId) => {
    const s = existingStats.find(st => st.player_id === playerId);
    if (!s) return null;
    const parts = [];
    if ((s.fouls || 0) > 0)           parts.push(`${s.fouls}F`);
    if ((s.technical_fouls || 0) > 0) parts.push(`${s.technical_fouls}T`);
    return parts.join(" · ") || null;
  };

  return (
    <div className={`flex flex-col bg-white rounded-2xl shadow-2xl border-2 ${borderColor} overflow-hidden`}
         style={{ maxHeight: "min(80vh, 520px)" }}>
      {/* ── Header ── */}
      <div className={`${headerBg} px-4 py-3 flex items-center gap-3 flex-shrink-0`}>
        <div className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          #{playerOut.jersey_number}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight truncate">
            {playerOut.name} <span className="font-extrabold">OUT</span>
          </p>
          <p className="text-white/75 text-xs">Select replacement</p>
        </div>
        <button
          onClick={onCancel}
          className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Bench grid (scrollable) ── */}
      <div className="flex-1 overflow-y-auto p-3">
        {sorted.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-6">No eligible bench players.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {sorted.map(player => {
              const isSelected = selectedInId === player.id;
              const statLine   = getStatLine(player.id);
              return (
                <button
                  key={player.id}
                  onClick={() => setSelectedInId(isSelected ? null : player.id)}
                  className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all text-center
                    ${isSelected
                      ? `${borderColor} ${selBg} shadow-md`
                      : `border-slate-200 bg-white ${hoverBorder} hover:bg-slate-50`
                    }`}
                >
                  {/* Jersey circle */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0
                    ${isHome ? "bg-blue-600" : "bg-red-600"}`}>
                    {player.jersey_number}
                  </div>
                  <p className="font-semibold text-slate-800 text-[11px] leading-tight truncate w-full">
                    {player.name}
                  </p>
                  {(player.position || statLine) && (
                    <p className="text-[10px] text-slate-400 leading-none">
                      {[player.position, statLine].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {/* Selected checkmark */}
                  {isSelected && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Sticky footer ── */}
      <div className="flex gap-2 p-3 border-t border-slate-100 flex-shrink-0">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 h-10 border-slate-300 text-slate-700"
        >
          Cancel
        </Button>
        <Button
          disabled={!selectedInId}
          onClick={() => onConfirm(playerOut, selectedInId)}
          className={`flex-1 h-10 text-white font-bold transition-all
            ${isHome
              ? "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200"
              : "bg-red-600  hover:bg-red-700  disabled:bg-red-200"
            }`}
        >
          Confirm Sub
        </Button>
      </div>
    </div>
  );
}
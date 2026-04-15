import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Trophy, Clock, X } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * POGSpotlightModal — stub
 *
 * Full player profile spotlight will be rebuilt in the Player Profile phase.
 * Requires PlayerDashboardCard, PlayerAchievements, PlayerTrendCard, PlayerLastGame
 * — all of which have Base44 dependencies.
 */
export default function POGSpotlightModal({ open, onClose, pogPlayer }) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full p-0 gap-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">
              {t("schedule.playerOfGame", "Player of the Game")}
            </p>
            <h2 className="text-white font-bold text-lg truncate">
              {pogPlayer
                ? `${pogPlayer.first_name} ${pogPlayer.last_name}`
                : "—"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Placeholder */}
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-7 h-7 text-amber-400" />
          </div>
          <h3 className="font-semibold text-slate-800 mb-2">
            {t("schedule.pogComingSoon", "Full Profile Coming Soon")}
          </h3>
          <p className="text-sm text-slate-500 max-w-xs">
            {t(
              "schedule.pogDescription",
              "The full Player of the Game spotlight will be available once the Player Profile phase is complete."
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

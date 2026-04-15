import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

const REASONS = [
  "Opponent no-show",
  "Late withdrawal",
  "Team forfeited",
  "Ineligible players",
  "Other",
];

export default function DefaultWinnerDialog({
  open,
  onOpenChange,
  game,
  homeTeam,
  awayTeam,
  onSaved,
}) {
  const { t } = useTranslation();
  const [selectedWinnerTeamId, setSelectedWinnerTeamId] = useState(null);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const winnerTeam = selectedWinnerTeamId === homeTeam?.id ? homeTeam : awayTeam;
  const loserTeam = selectedWinnerTeamId === homeTeam?.id ? awayTeam : homeTeam;

  const handleConfirm = async () => {
    if (!selectedWinnerTeamId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("games")
        .update({
          status: "final",
          is_default_result: true,
          default_winner_team_id: selectedWinnerTeamId,
          default_loser_team_id: loserTeam?.id || null,
          default_reason: reason || null,
          exclude_from_awards: true,
        })
        .eq("id", game.id);
      if (error) throw error;

      onSaved?.();
      onOpenChange(false);
      setSelectedWinnerTeamId(null);
      setReason("");
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedWinnerTeamId(null);
    setReason("");
    setConfirming(false);
    onOpenChange(false);
  };

  if (!homeTeam || !awayTeam) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {t("schedule.markDefaultWinner", "Mark Default Winner")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Matchup */}
          <div className="flex items-center justify-center gap-3 py-3 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: homeTeam.color || "#64748b" }}
              >
                {homeTeam.name?.[0]}
              </div>
              <span className="font-semibold text-slate-800 text-sm">{homeTeam.name}</span>
            </div>
            <span className="text-slate-400 font-bold text-xs">vs</span>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: awayTeam.color || "#64748b" }}
              >
                {awayTeam.name?.[0]}
              </div>
              <span className="font-semibold text-slate-800 text-sm">{awayTeam.name}</span>
            </div>
          </div>

          {/* Winner selection */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">
              {t("schedule.selectDefaultWinner", "Select the team that won by default:")}
            </p>
            <div className="space-y-2">
              {[homeTeam, awayTeam].map((team) => (
                <button
                  key={team.id}
                  onClick={() => { setSelectedWinnerTeamId(team.id); setConfirming(false); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    selectedWinnerTeamId === team.id
                      ? "border-amber-500 bg-amber-50"
                      : "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/40"
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ backgroundColor: team.color || "#64748b" }}
                  >
                    {team.name?.[0]}
                  </div>
                  <span className="font-semibold text-slate-800">{team.name}</span>
                  {selectedWinnerTeamId === team.id && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">
              {t("schedule.reason", "Reason (optional):")}
            </p>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              <option value="">{t("schedule.selectReason", "Select a reason...")}</option>
              {REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Confirmation summary */}
          {selectedWinnerTeamId && confirming && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <p className="font-semibold mb-1">⚠ Please confirm:</p>
              <p>
                This will mark <span className="font-bold">{winnerTeam?.name}</span> as the winner by default.
                This game will count in standings but will be{" "}
                <span className="font-bold">excluded from awards and player stats</span>.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            {t("common.cancel", "Cancel")}
          </Button>
          {!confirming ? (
            <Button
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
              disabled={!selectedWinnerTeamId}
              onClick={() => setConfirming(true)}
            >
              {t("common.continue", "Continue")}
            </Button>
          ) : (
            <Button
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              disabled={saving}
              onClick={handleConfirm}
            >
              {saving
                ? t("common.saving", "Saving...")
                : t("schedule.confirmDefault", "Confirm Default Result")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

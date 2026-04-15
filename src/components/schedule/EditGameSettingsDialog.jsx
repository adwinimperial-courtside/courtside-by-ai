import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabaseClient";

export default function EditGameSettingsDialog({ open, onOpenChange, game, onSaved }) {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    scheduled_at: game?.scheduled_at
      ? new Date(game.scheduled_at).toISOString().slice(0, 16)
      : "",
    venue: game?.venue || "",
    game_stage: game?.game_stage || "regular",
    exclude_from_awards: game?.exclude_from_awards || false,
    game_mode: game?.game_mode || "timed",
    period_type: game?.period_type || "quarters",
    period_minutes: game?.period_minutes ?? 10,
    overtime_minutes: game?.overtime_minutes ?? 5,
  });

  // Sync form when game prop changes
  React.useEffect(() => {
    if (game) {
      setFormData({
        scheduled_at: game.scheduled_at
          ? new Date(game.scheduled_at).toISOString().slice(0, 16)
          : "",
        venue: game.venue || "",
        game_stage: game.game_stage || "regular",
        exclude_from_awards: game.exclude_from_awards || false,
        game_mode: game.game_mode || "timed",
        period_type: game.period_type || "quarters",
        period_minutes: game.period_minutes ?? 10,
        overtime_minutes: game.overtime_minutes ?? 5,
      });
    }
  }, [game, open]);

  const handleStageChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      game_stage: value,
      exclude_from_awards: value === "championship" ? true : prev.exclude_from_awards,
    }));
  };

  const isTimed = formData.game_mode === "timed";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = { ...formData };
      if (isTimed) {
        payload.period_count = payload.period_type === "quarters" ? 4 : 2;
      } else {
        payload.period_type = null;
        payload.period_count = null;
        payload.period_minutes = null;
        payload.overtime_minutes = null;
      }
      if (payload.scheduled_at) {
        payload.scheduled_at = new Date(payload.scheduled_at).toISOString();
      }

      const { error } = await supabase
        .from("games")
        .update(payload)
        .eq("id", game.id);
      if (error) throw error;

      onSaved?.();
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {t("schedule.editGameSettings", "Edit Game Settings")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="scheduled_at">
              {t("schedule.dateTime", "Date & Time (Optional)")}
            </Label>
            <Input
              id="scheduled_at"
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="venue">{t("schedule.venue", "Venue (Optional)")}</Label>
            <Input
              id="venue"
              value={formData.venue}
              onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              placeholder="e.g., Helsinki Ice Hall"
              className="mt-1.5"
            />
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-4">
            <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              {t("schedule.gameStage", "Game Stage")}
            </p>
            <div>
              <Label>{t("schedule.stage", "Stage")}</Label>
              <Select value={formData.game_stage} onValueChange={handleStageChange}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">{t("schedule.regular", "Regular Season")}</SelectItem>
                  <SelectItem value="quarterfinal">{t("schedule.quarterfinal", "Quarterfinal")}</SelectItem>
                  <SelectItem value="semifinal">{t("schedule.semifinal", "Semifinal")}</SelectItem>
                  <SelectItem value="championship">{t("schedule.championship", "Championship")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Checkbox
                id="exclude_from_awards_edit"
                checked={formData.exclude_from_awards}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, exclude_from_awards: !!checked }))
                }
                className="mt-0.5"
              />
              <div>
                <label
                  htmlFor="exclude_from_awards_edit"
                  className="text-sm font-semibold text-amber-900 cursor-pointer"
                >
                  {t("schedule.excludeFromAwards", "Exclude this game from player awards")}
                </label>
                <p className="text-xs text-amber-700 mt-0.5">
                  {t("schedule.excludeFromAwardsDescription", "Stats will still appear in box scores and player profiles, but won't count toward season awards.")}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-4">
            <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              {t("schedule.gameMode", "Game Mode")}
            </p>

            <div>
              <Label>{t("schedule.mode", "Mode")}</Label>
              <Select
                value={formData.game_mode}
                onValueChange={(value) => setFormData({ ...formData, game_mode: value })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timed">{t("schedule.timed", "Timed Game")}</SelectItem>
                  <SelectItem value="untimed">{t("schedule.untimed", "Untimed Game")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isTimed && (
              <>
                <div>
                  <Label>{t("schedule.periodFormat", "Period Format")}</Label>
                  <Select
                    value={formData.period_type}
                    onValueChange={(value) => setFormData({ ...formData, period_type: value })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quarters">{t("schedule.quarters", "4 Quarters")}</SelectItem>
                      <SelectItem value="halves">{t("schedule.halves", "2 Halves")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="period_minutes_edit">
                      {t("schedule.minutesPerPeriod", "Minutes per Period")}
                    </Label>
                    <Input
                      id="period_minutes_edit"
                      type="number"
                      min={1}
                      max={30}
                      value={formData.period_minutes}
                      onChange={(e) =>
                        setFormData({ ...formData, period_minutes: Number(e.target.value) })
                      }
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="overtime_minutes_edit">
                      {t("schedule.overtimeMinutes", "Overtime Minutes")}{" "}
                      <span className="text-slate-400 font-normal text-xs">(0 = none)</span>
                    </Label>
                    <Input
                      id="overtime_minutes_edit"
                      type="number"
                      min={0}
                      max={15}
                      value={formData.overtime_minutes}
                      onChange={(e) =>
                        setFormData({ ...formData, overtime_minutes: Number(e.target.value) })
                      }
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              {isSaving ? t("common.saving", "Saving...") : t("common.save", "Save Settings")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

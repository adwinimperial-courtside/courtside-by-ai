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
import { base44 } from "@/api/base44Client";

export default function EditGameSettingsDialog({ open, onOpenChange, game, onSaved }) {
  const [formData, setFormData] = useState({
    game_date: game.game_date ? new Date(game.game_date).toISOString().slice(0, 16) : "",
    location: game.location || "",
    game_mode: game.game_mode || "timed",
    game_stage: game.game_stage || "regular",
    exclude_from_awards: game.exclude_from_awards || false,
    period_type: game.period_type || "quarters",
    period_minutes: game.period_minutes ?? 10,
    overtime_minutes: game.overtime_minutes ?? 5,
  });

  const handleStageChange = (value) => {
    setFormData(prev => ({
      ...prev,
      game_stage: value,
      exclude_from_awards: value === "championship" ? true : prev.exclude_from_awards,
    }));
  };
  const [isSaving, setIsSaving] = useState(false);

  const isTimed = formData.game_mode === "timed";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const payload = { ...formData };
    if (isTimed) {
      payload.period_count = formData.period_type === "quarters" ? 4 : 2;
    } else {
      payload.period_type = null;
      payload.period_count = null;
      payload.period_minutes = null;
      payload.overtime_minutes = null;
    }
    await base44.entities.Game.update(game.id, payload);
    setIsSaving(false);
    onSaved && onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Edit Game Settings</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="gameDate">Date & Time (Optional)</Label>
            <Input
              id="gameDate"
              type="datetime-local"
              value={formData.game_date}
              onChange={(e) => setFormData({ ...formData, game_date: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="location">Location (Optional)</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Main Arena"
              className="mt-1.5"
            />
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-4">
            <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Game Stage</p>
            <div>
              <Label>Stage</Label>
              <Select value={formData.game_stage} onValueChange={handleStageChange}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular Season</SelectItem>
                  <SelectItem value="quarterfinal">Quarterfinal</SelectItem>
                  <SelectItem value="semifinal">Semifinal</SelectItem>
                  <SelectItem value="championship">Championship</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Checkbox
                id="exclude_from_awards_edit"
                checked={formData.exclude_from_awards}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, exclude_from_awards: !!checked }))}
                className="mt-0.5"
              />
              <div>
                <label htmlFor="exclude_from_awards_edit" className="text-sm font-semibold text-amber-900 cursor-pointer">
                  Exclude this game from player awards
                </label>
                <p className="text-xs text-amber-700 mt-0.5">
                  Stats will still appear in box scores and player profiles, but this game will not count toward season awards (MVP, DPOY, Mythical 5).
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-4">
            <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Game Mode</p>

            <div>
              <Label>Game Mode</Label>
              <Select
                value={formData.game_mode}
                onValueChange={(value) => setFormData({ ...formData, game_mode: value })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timed">Timed Game</SelectItem>
                  <SelectItem value="untimed">Untimed Game</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isTimed && (
              <>
                <div>
                  <Label>Period Format</Label>
                  <Select
                    value={formData.period_type}
                    onValueChange={(value) => setFormData({ ...formData, period_type: value })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quarters">4 Quarters</SelectItem>
                      <SelectItem value="halves">2 Halves</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="period_minutes">Minutes per Period</Label>
                    <Input
                      id="period_minutes"
                      type="number"
                      min={1}
                      max={30}
                      value={formData.period_minutes}
                      onChange={(e) => setFormData({ ...formData, period_minutes: Number(e.target.value) })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="overtime_minutes">Overtime Minutes <span className="text-slate-400 font-normal">(0 = no overtime)</span></Label>
                    <Input
                      id="overtime_minutes"
                      type="number"
                      min={0}
                      max={15}
                      value={formData.overtime_minutes}
                      onChange={(e) => setFormData({ ...formData, overtime_minutes: Number(e.target.value) })}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700">
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
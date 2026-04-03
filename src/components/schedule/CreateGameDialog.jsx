import React, { useState, useRef } from "react";
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

const STAGE_PRESETS = {
  elimination:   { overtime_allowed: false, timeouts_total: 2, timeouts_first_half: null, timeouts_second_half: null },
  quarter_final: { overtime_allowed: true,  timeouts_total: 2, timeouts_first_half: null, timeouts_second_half: null },
  semi_final:    { overtime_allowed: true,  timeouts_total: null, timeouts_first_half: 1, timeouts_second_half: 2 },
  championship:  { overtime_allowed: true,  timeouts_total: null, timeouts_first_half: 2, timeouts_second_half: 3 },
};

export default function CreateGameDialog({ open, onOpenChange, onSubmit, isLoading, leagues, teams }) {
  const [formData, setFormData] = useState({
    league_id: "",
    home_team_id: "",
    away_team_id: "",
    game_date: "",
    location: "",
    game_mode: "timed",
    period_type: "quarters",
    period_minutes: 10,
    overtime_minutes: 5,
    game_stage: "",
    overtime_allowed: null,
    timeouts_total: "",
    timeouts_first_half: "",
    timeouts_second_half: "",
  });


  const isTimed = formData.game_mode === "timed";

  const applyStagePreset = (stage) => {
    const preset = STAGE_PRESETS[stage] || {};
    setFormData(f => ({
      ...f,
      game_stage: stage,
      overtime_allowed: preset.overtime_allowed ?? null,
      timeouts_total: preset.timeouts_total != null ? preset.timeouts_total : "",
      timeouts_first_half: preset.timeouts_first_half != null ? preset.timeouts_first_half : "",
      timeouts_second_half: preset.timeouts_second_half != null ? preset.timeouts_second_half : "",
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (isTimed) {
      payload.period_count = formData.period_type === "quarters" ? 4 : 2;
      // Only include timeout/overtime fields if they have values
      const gameRules = {};
      if (formData.game_stage) gameRules.game_stage = formData.game_stage;
      if (formData.overtime_allowed !== null) gameRules.overtime_allowed = formData.overtime_allowed;
      if (formData.timeouts_total !== "") gameRules.timeouts_total = Number(formData.timeouts_total);
      if (formData.timeouts_first_half !== "") gameRules.timeouts_first_half = Number(formData.timeouts_first_half);
      if (formData.timeouts_second_half !== "") gameRules.timeouts_second_half = Number(formData.timeouts_second_half);
      if (Object.keys(gameRules).length > 0) payload.game_rules = gameRules;
    } else {
      payload.period_type = null;
      payload.period_count = null;
      payload.period_minutes = null;
      payload.overtime_minutes = null;
    }
    // Clean up UI-only fields from payload
    delete payload.game_stage;
    delete payload.overtime_allowed;
    delete payload.timeouts_total;
    delete payload.timeouts_first_half;
    delete payload.timeouts_second_half;
    onSubmit(payload);
    setFormData({ league_id: "", home_team_id: "", away_team_id: "", game_date: "", location: "", game_mode: "timed", period_type: "quarters", period_minutes: 10, overtime_minutes: 5, game_stage: "", overtime_allowed: null, timeouts_total: "", timeouts_first_half: "", timeouts_second_half: "" });
  };

  const leagueTeams = formData.league_id 
    ? teams.filter(t => t.league_id === formData.league_id)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Schedule New Game</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="league">League</Label>
            <Select
              value={formData.league_id}
              onValueChange={(value) => setFormData({ ...formData, league_id: value, home_team_id: "", away_team_id: "" })}
              required
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select a league" />
              </SelectTrigger>
              <SelectContent>
                {leagues.map(league => (
                  <SelectItem key={league.id} value={league.id}>
                    {league.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="homeTeam">Home Team</Label>
            <Select
              value={formData.home_team_id}
              onValueChange={(value) => setFormData({ ...formData, home_team_id: value })}
              required
              disabled={!formData.league_id}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select home team" />
              </SelectTrigger>
              <SelectContent>
                {leagueTeams.filter(t => t.id !== formData.away_team_id).map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="awayTeam">Away Team</Label>
            <Select
              value={formData.away_team_id}
              onValueChange={(value) => setFormData({ ...formData, away_team_id: value })}
              required
              disabled={!formData.league_id}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select away team" />
              </SelectTrigger>
              <SelectContent>
                {leagueTeams.filter(t => t.id !== formData.home_team_id).map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

          {/* Game Mode Section */}
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
                    <Label htmlFor="overtime_minutes">Overtime Minutes</Label>
                    <Input
                      id="overtime_minutes"
                      type="number"
                      min={1}
                      max={15}
                      value={formData.overtime_minutes}
                      onChange={(e) => setFormData({ ...formData, overtime_minutes: Number(e.target.value) })}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                {/* Tournament / Timeout Settings */}
                <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Tournament Settings <span className="font-normal text-slate-400">(Optional)</span></p>

                  <div>
                    <Label>Game Stage</Label>
                    <Select value={formData.game_stage} onValueChange={applyStagePreset}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select stage (fills defaults)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="elimination">Elimination</SelectItem>
                        <SelectItem value="quarter_final">Quarter Final</SelectItem>
                        <SelectItem value="semi_final">Semi Final</SelectItem>
                        <SelectItem value="championship">Championship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Overtime Allowed</Label>
                    <Select
                      value={formData.overtime_allowed === null ? "" : String(formData.overtime_allowed)}
                      onValueChange={v => setFormData(f => ({ ...f, overtime_allowed: v === "" ? null : v === "true" }))}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Use default" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>Use default</SelectItem>
                        <SelectItem value="true">Yes — Overtime allowed</SelectItem>
                        <SelectItem value="false">No — No overtime</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="timeouts_total" className="text-xs">Total Timeouts</Label>
                      <Input
                        id="timeouts_total"
                        type="number"
                        min={0}
                        max={10}
                        placeholder="—"
                        value={formData.timeouts_total}
                        onChange={e => setFormData(f => ({ ...f, timeouts_total: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="timeouts_first_half" className="text-xs">1st Half TOs</Label>
                      <Input
                        id="timeouts_first_half"
                        type="number"
                        min={0}
                        max={10}
                        placeholder="—"
                        value={formData.timeouts_first_half}
                        onChange={e => setFormData(f => ({ ...f, timeouts_first_half: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="timeouts_second_half" className="text-xs">2nd Half TOs</Label>
                      <Input
                        id="timeouts_second_half"
                        type="number"
                        min={0}
                        max={10}
                        placeholder="—"
                        value={formData.timeouts_second_half}
                        onChange={e => setFormData(f => ({ ...f, timeouts_second_half: e.target.value }))}
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Selecting a stage auto-fills these values. You can override them manually. Leave blank to use global defaults.</p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              {isLoading ? "Scheduling..." : "Schedule Game"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
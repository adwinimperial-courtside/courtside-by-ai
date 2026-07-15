import React, { useState, useRef, useEffect } from "react";
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

const DEFAULT_FORM = { league_id: "", home_team_id: "", away_team_id: "", game_date: "", location: "", game_mode: "timed", game_stage: "regular", exclude_from_awards: false, period_type: "quarters", period_minutes: 10, overtime_minutes: 5, timeoutsPerSegment: 2, teamFoulBonusThreshold: 5, personalFoulLimit: 5 };

export default function CreateGameDialog({ open, onOpenChange, onSubmit, isLoading, leagues, teams, defaultLeagueId }) {
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [diffTimePeriod, setDiffTimePeriod] = useState(false);

  // LEAGUE_PREFILL_V1: when the dialog opens, pre-select the league from the page filter
  useEffect(() => {
    if (!open) return;
    if (!defaultLeagueId || defaultLeagueId === "all") return;
    setFormData(prev => {
      if (prev.league_id === defaultLeagueId) return prev;
      return { ...prev, league_id: defaultLeagueId, home_team_id: "", away_team_id: "" };
    });
  }, [open, defaultLeagueId]);
  const [perPeriodMinutes, setPerPeriodMinutes] = useState([10, 10, 10, 10]);
  const [diffTimeoutPeriod, setDiffTimeoutPeriod] = useState(false);
  const [perPeriodTimeouts, setPerPeriodTimeouts] = useState([2, 2, 2, 2]);

  const handleStageChange = (value) => {
    setFormData(prev => ({
      ...prev,
      game_stage: value,
      exclude_from_awards: value === "championship" ? true : prev.exclude_from_awards,
    }));
  };


  const isTimed = formData.game_mode === "timed";

  const periodCount = formData.period_type === "quarters" ? 4 : 2;
  const periodLabels = formData.period_type === "quarters"
    ? ["Q1 (min)", "Q2 (min)", "Q3 (min)", "Q4 (min)"]
    : ["1st half (min)", "2nd half (min)"];

  const handlePeriodTypeChange = (value) => {
    const count = value === "quarters" ? 4 : 2;
    setPerPeriodMinutes(Array(count).fill(formData.period_minutes));
    setPerPeriodTimeouts(Array(count).fill(formData.timeoutsPerSegment));
    setFormData(prev => ({ ...prev, period_type: value }));
  };

  const handleToggleDiffTime = (checked) => {
    setDiffTimePeriod(checked);
    setPerPeriodMinutes(Array(periodCount).fill(formData.period_minutes));
  };

  const handleToggleDiffTimeout = (checked) => {
    setDiffTimeoutPeriod(checked);
    setPerPeriodTimeouts(Array(periodCount).fill(formData.timeoutsPerSegment));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { timeoutsPerSegment, teamFoulBonusThreshold, personalFoulLimit, ...rest } = formData;
    const payload = { ...rest };
    if (isTimed) {
      payload.period_count = periodCount;
      const gameRules = {
        timeoutsPerSegment: diffTimeoutPeriod ? perPeriodTimeouts : timeoutsPerSegment,
        teamFoulBonusThreshold,
        personalFoulLimit,
      };
      if (diffTimePeriod) {
        gameRules.periodMinutes = perPeriodMinutes;
        payload.period_minutes = perPeriodMinutes[0];
      }
      payload.game_rules = gameRules;
    } else {
      payload.period_type = null;
      payload.period_count = null;
      payload.period_minutes = null;
      payload.overtime_minutes = null;
    }
    onSubmit(payload);
    setFormData(DEFAULT_FORM);
    setDiffTimePeriod(false);
    setPerPeriodMinutes([10, 10, 10, 10]);
    setDiffTimeoutPeriod(false);
    setPerPeriodTimeouts([2, 2, 2, 2]);
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

          {/* Game Stage & Awards */}
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
                id="exclude_from_awards"
                checked={formData.exclude_from_awards}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, exclude_from_awards: !!checked }))}
                className="mt-0.5"
              />
              <div>
                <label htmlFor="exclude_from_awards" className="text-sm font-semibold text-amber-900 cursor-pointer">
                  Exclude this game from player awards
                </label>
                <p className="text-xs text-amber-700 mt-0.5">
                  Stats will still appear in box scores and player profiles, but this game will not count toward season awards (MVP, DPOY, Mythical 5).
                </p>
              </div>
            </div>
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
                  <Select value={formData.period_type} onValueChange={handlePeriodTypeChange}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quarters">4 Quarters</SelectItem>
                      <SelectItem value="halves">2 Halves</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Different time per period toggle */}
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="diffTimePeriod_create"
                    checked={diffTimePeriod}
                    onCheckedChange={handleToggleDiffTime}
                  />
                  <label htmlFor="diffTimePeriod_create" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Different time per period
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {!diffTimePeriod && (
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
                  )}
                  {diffTimePeriod && periodLabels.map((label, i) => (
                    <div key={i}>
                      <Label>{label}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={perPeriodMinutes[i] ?? formData.period_minutes}
                        onChange={(e) => {
                          const updated = [...perPeriodMinutes];
                          updated[i] = Number(e.target.value);
                          setPerPeriodMinutes(updated);
                        }}
                        className="mt-1.5"
                      />
                    </div>
                  ))}
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
                  {!diffTimeoutPeriod && (
                  <div>
                    <Label htmlFor="timeoutsPerSegment">Timeouts per Segment</Label>
                    <Input
                      id="timeoutsPerSegment"
                      type="number"
                      min={0}
                      max={10}
                      value={formData.timeoutsPerSegment}
                      onChange={(e) => setFormData({ ...formData, timeoutsPerSegment: Number(e.target.value) })}
                      className="mt-1.5"
                    />
                  </div>
                  )}
                  <div className="sm:col-span-2">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="diffTimeoutPeriod_create"
                        checked={diffTimeoutPeriod}
                        onCheckedChange={handleToggleDiffTimeout}
                      />
                      <label htmlFor="diffTimeoutPeriod_create" className="text-sm font-medium text-slate-700 cursor-pointer">
                        Different timeouts per period
                      </label>
                    </div>
                  </div>
                  {diffTimeoutPeriod && (formData.period_type === "quarters"
                    ? ["Q1 timeouts", "Q2 timeouts", "Q3 timeouts", "Q4 timeouts"]
                    : ["1st half timeouts", "2nd half timeouts"]
                  ).map((label, i) => (
                    <div key={i}>
                      <Label>{label}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={perPeriodTimeouts[i] ?? formData.timeoutsPerSegment}
                        onChange={(e) => {
                          const updated = [...perPeriodTimeouts];
                          updated[i] = Number(e.target.value);
                          setPerPeriodTimeouts(updated);
                        }}
                        className="mt-1.5"
                      />
                    </div>
                  ))}
                  <div>
                    <Label htmlFor="teamFoulBonusThreshold">Team Fouls Before Bonus</Label>
                    <Input
                      id="teamFoulBonusThreshold"
                      type="number"
                      min={1}
                      max={20}
                      value={formData.teamFoulBonusThreshold}
                      onChange={(e) => setFormData({ ...formData, teamFoulBonusThreshold: Number(e.target.value) })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="personalFoulLimit">Player Foul Limit</Label>
                    <Input
                      id="personalFoulLimit"
                      type="number"
                      min={1}
                      max={10}
                      value={formData.personalFoulLimit}
                      onChange={(e) => setFormData({ ...formData, personalFoulLimit: Number(e.target.value) })}
                      className="mt-1.5"
                    />
                    <p className="text-xs text-slate-500 mt-1">Fouls before a player is disqualified</p>
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
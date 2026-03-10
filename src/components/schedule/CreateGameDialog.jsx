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
  });


  const isTimed = formData.game_mode === "timed";

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (isTimed) {
      payload.period_count = formData.period_type === "quarters" ? 4 : 2;
    } else {
      payload.period_type = null;
      payload.period_count = null;
      payload.period_minutes = null;
      payload.overtime_minutes = null;
    }
    onSubmit(payload);
    setFormData({ league_id: "", home_team_id: "", away_team_id: "", game_date: "", location: "", game_mode: "timed", period_type: "quarters", period_minutes: 10, overtime_minutes: 5 });
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
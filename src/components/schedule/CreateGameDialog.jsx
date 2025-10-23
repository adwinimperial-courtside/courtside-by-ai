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

export default function CreateGameDialog({ open, onOpenChange, onSubmit, isLoading, leagues, teams }) {
  const [formData, setFormData] = useState({
    league_id: "",
    home_team_id: "",
    away_team_id: "",
    game_date: "",
    location: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ league_id: "", home_team_id: "", away_team_id: "", game_date: "", location: "" });
  };

  const leagueTeams = formData.league_id 
    ? teams.filter(t => t.league_id === formData.league_id)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
            <Label htmlFor="gameDate">Date & Time</Label>
            <Input
              id="gameDate"
              type="datetime-local"
              value={formData.game_date}
              onChange={(e) => setFormData({ ...formData, game_date: e.target.value })}
              required
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
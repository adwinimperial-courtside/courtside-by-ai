import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";

export default function CreateLeagueDialog({ open, onOpenChange, onSubmit, isLoading }) {
  const currentYear = new Date().getFullYear().toString();
  const [leagueName, setLeagueName] = useState("");
  const [description, setDescription] = useState("");
  const [seasonName, setSeasonName] = useState("");
  const [seasonYear, setSeasonYear] = useState(currentYear);
  const [seasonNameEdited, setSeasonNameEdited] = useState(false);

  useEffect(() => {
    if (open) {
      setLeagueName("");
      setDescription("");
      setSeasonName("");
      setSeasonYear(new Date().getFullYear().toString());
      setSeasonNameEdited(false);
    }
  }, [open]);

  useEffect(() => {
    if (!seasonNameEdited) {
      setSeasonName(leagueName.trim() ? `${leagueName.trim()} ${seasonYear}`.trim() : "");
    }
  }, [leagueName, seasonYear, seasonNameEdited]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      leagueName: leagueName.trim(),
      description: description.trim(),
      seasonName: seasonName.trim(),
      seasonYear: seasonYear.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-marker="CREATE_LEAGUE_GROUP_V1" className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Create League</DialogTitle>
          <p className="text-sm text-slate-500">A league holds all its seasons. You can add more seasons later.</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="league-name">League Name</Label>
            <Input
              id="league-name"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              placeholder="e.g., Fin-Noy Sports Club"
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="league-description">Description (Optional)</Label>
            <Textarea
              id="league-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the league"
              className="mt-1.5 h-20"
            />
          </div>
          <div className="border-t border-slate-200 pt-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-600 mb-3">
              <Calendar className="w-4 h-4" />
              First season
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="season-name">Season Name</Label>
                <Input
                  id="season-name"
                  value={seasonName}
                  onChange={(e) => { setSeasonName(e.target.value); setSeasonNameEdited(true); }}
                  placeholder="e.g., Open Age Season 1"
                  required
                  className="mt-1.5"
                />
                <p className="text-xs text-slate-400 mt-1">Prefilled from the league name — edit freely</p>
              </div>
              <div>
                <Label htmlFor="season-year">Season Year</Label>
                <Input
                  id="season-year"
                  value={seasonYear}
                  onChange={(e) => setSeasonYear(e.target.value)}
                  required
                  className="mt-1.5 max-w-[140px]"
                />
              </div>
            </div>
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
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              {isLoading ? "Creating..." : "Create League"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
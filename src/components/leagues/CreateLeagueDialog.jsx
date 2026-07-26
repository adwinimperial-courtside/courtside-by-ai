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

export default function CreateLeagueDialog({ open, onOpenChange, onSubmit, isLoading }) {
  const [leagueName, setLeagueName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setLeagueName("");
      setDescription("");
    }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      leagueName: leagueName.trim(),
      description: description.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-marker="CREATE_LEAGUE_GROUP_V2" className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Create League</DialogTitle>
          <p className="text-sm text-slate-500">A league holds all its seasons. After creating it, use the New Season button on the league card to add your first season.</p>
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
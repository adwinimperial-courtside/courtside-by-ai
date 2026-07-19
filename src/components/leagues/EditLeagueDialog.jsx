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

export default function EditLeagueDialog({ open, onOpenChange, league, onSubmit, isLoading, showAdminInfo }) {
  const [formData, setFormData] = useState({ name: "", season: "", description: "" });

  useEffect(() => {
    if (league) {
      setFormData({
        name: league.name || "",
        season: league.season || "",
        description: league.description || ""
      });
    }
  }, [league]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Edit League</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">League Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., City Championship League"
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="season">Season</Label>
            <Input
              id="season"
              value={formData.season}
              onChange={(e) => setFormData({ ...formData, season: e.target.value })}
              placeholder="e.g., 2024-2025"
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the league"
              className="mt-1.5 h-24"
            />
          </div>
          {showAdminInfo && league && (
            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 border border-slate-200">
              <p className="text-slate-700"><span className="font-medium">Owner:</span> {league.owner_name || league.owner_email || league.created_by || "Unknown"}{league.owner_name && league.owner_email ? ` (${league.owner_email})` : ""}</p>
              <p className="text-slate-600"><span className="font-medium">Created by:</span> {league.created_by}</p>
              <p className="text-slate-600"><span className="font-medium">Created:</span> {league.created_date ? new Date(league.created_date).toLocaleString() : "-"}</p>
              <p className="text-slate-500 font-mono break-all">ID: {league.id}</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
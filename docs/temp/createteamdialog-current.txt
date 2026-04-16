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
import { base44 } from "@/api/base44Client";
import { Upload } from "lucide-react";

const TEAM_COLORS = [
  { name: "Orange", value: "#f97316" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Red", value: "#ef4444" },
  { name: "Green", value: "#22c55e" },
  { name: "Purple", value: "#a855f7" },
  { name: "Yellow", value: "#eab308" },
];

export default function CreateTeamDialog({ open, onOpenChange, onSubmit, isLoading, leagues }) {
  const [formData, setFormData] = useState({
    name: "",
    league_id: "",
    color: "#f97316",
    logo_url: "",
    head_coach: "",
    manager: ""
  });
  const [captainData, setCaptainData] = useState({
    name: "",
    jersey_number: "",
    position: "PG"
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = { ...formData };
    if (captainData.name && captainData.jersey_number) {
      submitData.captain = captainData;
    }
    onSubmit(submitData);
    setFormData({ name: "", league_id: "", color: "#f97316", logo_url: "", head_coach: "", manager: "" });
    setCaptainData({ name: "", jersey_number: "", position: "PG" });
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, logo_url: file_url });
    } catch (error) {
      alert("Failed to upload logo: " + error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Add New Team</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Team Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Warriors"
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="league">League</Label>
            <Select
              value={formData.league_id}
              onValueChange={(value) => setFormData({ ...formData, league_id: value })}
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
            <Label htmlFor="head_coach">Head Coach (Optional)</Label>
            <Input
              id="head_coach"
              value={formData.head_coach}
              onChange={(e) => setFormData({ ...formData, head_coach: e.target.value })}
              placeholder="e.g., John Smith"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="manager">Manager (Optional)</Label>
            <Input
              id="manager"
              value={formData.manager}
              onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
              placeholder="e.g., Jane Doe"
              className="mt-1.5"
            />
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="font-semibold text-slate-900 mb-3">Team Captain (Optional)</h3>
            <div>
              <Label htmlFor="captain_name">Captain Name</Label>
              <Input
                id="captain_name"
                value={captainData.name}
                onChange={(e) => setCaptainData({ ...captainData, name: e.target.value })}
                placeholder="e.g., LeBron James"
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label htmlFor="captain_jersey">Jersey Number</Label>
                <Input
                  id="captain_jersey"
                  type="number"
                  value={captainData.jersey_number}
                  onChange={(e) => setCaptainData({ ...captainData, jersey_number: parseInt(e.target.value) || "" })}
                  placeholder="e.g., 23"
                  className="mt-1.5"
                  min="0"
                  max="99"
                />
              </div>
              <div>
                <Label htmlFor="captain_position">Position</Label>
                <Select
                  value={captainData.position}
                  onValueChange={(value) => setCaptainData({ ...captainData, position: value })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PG">PG</SelectItem>
                    <SelectItem value="SG">SG</SelectItem>
                    <SelectItem value="SF">SF</SelectItem>
                    <SelectItem value="PF">PF</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="logo">Team Logo (Optional)</Label>
            <div className="mt-1.5">
              {formData.logo_url ? (
                <div className="flex items-center gap-3">
                  <img 
                    src={formData.logo_url} 
                    alt="Team logo" 
                    className="w-16 h-16 object-cover rounded-lg border-2 border-slate-200"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, logo_url: "" })}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-slate-400 transition-colors">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-6 h-6 text-slate-400" />
                    <span className="text-sm text-slate-600">
                      {uploadingLogo ? "Uploading..." : "Click to upload logo"}
                    </span>
                  </div>
                  <input
                    id="logo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                  />
                </label>
              )}
            </div>
          </div>
          <div>
            <Label>Team Color</Label>
            <div className="grid grid-cols-6 gap-2 mt-1.5">
              {TEAM_COLORS.map(color => (
                <button
                  key={color.value}
                  type="button"
                  className={`w-10 h-10 rounded-lg transition-all ${
                    formData.color === color.value 
                      ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' 
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  title={color.name}
                />
              ))}
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
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              {isLoading ? "Adding..." : "Add Team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
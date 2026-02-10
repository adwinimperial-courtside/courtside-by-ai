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

export default function EditTeamDialog({ open, onOpenChange, team, onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    name: "",
    color: "#f97316",
    logo_url: "",
    head_coach: "",
    manager: "",
    team_captain: ""
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name,
        color: team.color || "#f97316",
        logo_url: team.logo_url || "",
        head_coach: team.head_coach || "",
        manager: team.manager || "",
        team_captain: team.team_captain || ""
      });
    }
  }, [team, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
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

  if (!team) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Edit Team</DialogTitle>
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
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
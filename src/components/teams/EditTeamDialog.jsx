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
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

const TEAM_COLORS = [
  { name: "Orange",    value: "#f97316" },
  { name: "Blue",      value: "#3b82f6" },
  { name: "Red",       value: "#ef4444" },
  { name: "Green",     value: "#22c55e" },
  { name: "Purple",    value: "#a855f7" },
  { name: "Yellow",    value: "#eab308" },
  { name: "Dark Blue", value: "#1d4ed8" },
  { name: "Teal",      value: "#0d9488" },
];

export default function EditTeamDialog({ open, onOpenChange, team, onSubmit, isLoading }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    short_name: "",
    color: "#f97316",
    logo_url: "",
    head_coach: "",
    manager: "",
  });

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || "",
        short_name: team.short_name || "",
        color: team.color || "#f97316",
        logo_url: team.logo_url || "",
        head_coach: team.head_coach || "",
        manager: team.manager || "",
      });
    }
  }, [team, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!team) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {t("teams.editTeam", "Edit Team")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">{t("teams.teamName", "Team Name")}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="short_name">{t("teams.shortName", "Short Name (Optional)")}</Label>
            <Input
              id="short_name"
              value={formData.short_name}
              onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
              maxLength={5}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="head_coach">{t("teams.headCoach", "Head Coach (Optional)")}</Label>
            <Input
              id="head_coach"
              value={formData.head_coach}
              onChange={(e) => setFormData({ ...formData, head_coach: e.target.value })}
              placeholder="e.g., Matti Korhonen"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="manager">{t("teams.manager", "Manager (Optional)")}</Label>
            <Input
              id="manager"
              value={formData.manager}
              onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
              placeholder="e.g., Sari Virtanen"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>{t("teams.teamColor", "Team Color")}</Label>
            <div className="grid grid-cols-8 gap-2 mt-1.5">
              {TEAM_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={`w-9 h-9 rounded-lg transition-all ${
                    formData.color === color.value
                      ? "ring-2 ring-offset-2 ring-slate-400 scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              {t("teams.logoUploadComingSoon", "Logo upload will be available once Supabase Storage is configured.")}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              {isLoading ? t("common.saving", "Saving...") : t("common.save", "Save Changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

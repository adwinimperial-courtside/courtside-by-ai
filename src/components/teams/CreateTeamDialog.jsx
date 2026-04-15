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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function CreateTeamDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  leagues = [],
  defaultLeagueId,
}) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    short_name: "",
    league_id: defaultLeagueId || "",
    color: "#f97316",
    logo_url: "",
    head_coach: "",
    manager: "",
  });

  React.useEffect(() => {
    if (defaultLeagueId) {
      setFormData((prev) => ({ ...prev, league_id: defaultLeagueId }));
    }
  }, [defaultLeagueId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      name: "",
      short_name: "",
      league_id: defaultLeagueId || "",
      color: "#f97316",
      logo_url: "",
      head_coach: "",
      manager: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {t("teams.addTeam", "Add New Team")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">{t("teams.teamName", "Team Name")}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Helsinki Hawks"
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
              placeholder="e.g., HHK"
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

          {leagues.length > 1 && (
            <div>
              <Label htmlFor="league">{t("teams.league", "League")}</Label>
              <Select
                value={formData.league_id}
                onValueChange={(value) => setFormData({ ...formData, league_id: value })}
                required
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={t("teams.selectLeague", "Select a league")} />
                </SelectTrigger>
                <SelectContent>
                  {leagues.map((league) => (
                    <SelectItem key={league.id} value={league.id}>
                      {league.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
              disabled={isLoading || !formData.league_id}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              {isLoading ? t("teams.adding", "Adding...") : t("teams.addTeam", "Add Team")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

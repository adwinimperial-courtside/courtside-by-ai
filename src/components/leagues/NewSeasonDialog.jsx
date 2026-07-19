import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const START_EMPTY = "__start_empty__";

export default function NewSeasonDialog({ open, onOpenChange, group, groupSeasons }) {
  const queryClient = useQueryClient();
  const [seasonName, setSeasonName] = useState("");
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear().toString());
  const [copyFromId, setCopyFromId] = useState(START_EMPTY);
  const [teamSelections, setTeamSelections] = useState({});
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (open) {
      setSeasonName("");
      setSeasonYear(new Date().getFullYear().toString());
      setCopyFromId(groupSeasons && groupSeasons.length > 0 ? groupSeasons[0].id : START_EMPTY);
      setTeamSelections({});
      setErrorMessage("");
    }
  }, [open, groupSeasons]);

  const { data: sourceTeams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['newSeasonTeams', copyFromId],
    queryFn: () => base44.entities.Team.filter({ league_id: copyFromId }),
    enabled: open && copyFromId !== START_EMPTY,
  });

  useEffect(() => {
    if (copyFromId === START_EMPTY) {
      setTeamSelections({});
    } else {
      const next = {};
      for (const t of sourceTeams) next[t.id] = "roster";
      setTeamSelections(next);
    }
  }, [copyFromId, sourceTeams]);

  const sortedTeams = useMemo(
    () => [...sourceTeams].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [sourceTeams]
  );

  const toggleTeam = (teamId) => {
    setTeamSelections(prev => {
      const next = { ...prev };
      if (next[teamId]) {
        delete next[teamId];
      } else {
        next[teamId] = "roster";
      }
      return next;
    });
  };

  const setTeamMode = (teamId, mode) => {
    setTeamSelections(prev => ({ ...prev, [teamId]: mode }));
  };

  const createSeasonMutation = useMutation({
    mutationFn: async () => {
      const sourceLeague = groupSeasons.find(l => l.id === copyFromId) || groupSeasons[0] || null;
      const ownerInfo = sourceLeague ? {
        owner_user_id: sourceLeague.owner_user_id,
        owner_email: sourceLeague.owner_email,
        owner_name: sourceLeague.owner_name,
      } : {};
      Object.keys(ownerInfo).forEach(k => { if (ownerInfo[k] === undefined) delete ownerInfo[k]; });

      const newLeague = await base44.entities.League.create({
        name: seasonName.trim(),
        season: seasonYear.trim(),
        group_id: group.id,
        ...ownerInfo,
      });

      if (copyFromId !== START_EMPTY) {
        const chosen = sortedTeams.filter(t => teamSelections[t.id]);
        for (const team of chosen) {
          const teamData = {
            league_id: newLeague.id,
            name: team.name,
            wins: 0,
            losses: 0,
          };
          if (team.logo_url) teamData.logo_url = team.logo_url;
          if (team.color) teamData.color = team.color;
          if (team.description) teamData.description = team.description;
          if (team.head_coach) teamData.head_coach = team.head_coach;
          if (team.manager) teamData.manager = team.manager;
          if (team.team_captain) teamData.team_captain = team.team_captain;
          const newTeam = await base44.entities.Team.create(teamData);

          if (teamSelections[team.id] === "roster") {
            const roster = await base44.entities.Player.filter({ team_id: team.id });
            for (const p of roster) {
              const playerData = { team_id: newTeam.id, name: p.name };
              if (p.jersey_number !== undefined && p.jersey_number !== null && p.jersey_number !== "") playerData.jersey_number = p.jersey_number;
              if (p.position) playerData.position = p.position;
              if (p.photo_url) playerData.photo_url = p.photo_url;
              await base44.entities.Player.create(playerData);
            }
          }
        }
      }

      const groupLeagueIds = groupSeasons.map(l => l.id);
      const allUsers = await base44.entities.User.list();
      const groupAdmins = allUsers.filter(u =>
        u.user_type === 'league_admin' &&
        (u.assigned_league_ids || []).some(id => groupLeagueIds.includes(id))
      );
      for (const admin of groupAdmins) {
        const existing = admin.assigned_league_ids || [];
        if (!existing.includes(newLeague.id)) {
          await base44.entities.User.update(admin.id, {
            assigned_league_ids: [...existing, newLeague.id],
          });
        }
      }

      return newLeague;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      onOpenChange(false);
    },
    onError: (error) => {
      setErrorMessage('Failed to create season: ' + error.message);
    },
  });

  const handleCreate = () => {
    if (!seasonName.trim()) {
      setErrorMessage('Please enter a season name');
      return;
    }
    setErrorMessage("");
    createSeasonMutation.mutate();
  };

  if (!group) return null;

  const selectedCount = Object.keys(teamSelections).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-marker="NEW_SEASON_V1" className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New season — {group.name}</DialogTitle>
          <p className="text-sm text-slate-500">Creates a new current season in this group</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="new-season-name">Season name</Label>
            <Input
              id="new-season-name"
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              placeholder="e.g., Fin-Noy Ballers Open Age Season 6"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="new-season-year">Season year</Label>
            <Input
              id="new-season-year"
              value={seasonYear}
              onChange={(e) => setSeasonYear(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Copy teams from</Label>
            <Select value={copyFromId} onValueChange={setCopyFromId}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={START_EMPTY}>Start empty — add teams later</SelectItem>
                {groupSeasons.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name} ({l.season})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {copyFromId !== START_EMPTY && (
            <div>
              {teamsLoading ? (
                <p className="text-sm text-slate-500">Loading teams…</p>
              ) : sortedTeams.length === 0 ? (
                <p className="text-sm text-slate-500">This season has no teams to copy.</p>
              ) : (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {sortedTeams.map(team => {
                    const mode = teamSelections[team.id];
                    const isChecked = !!mode;
                    return (
                      <div key={team.id} className="flex items-center gap-3 p-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleTeam(team.id)}
                        />
                        <span className={`flex-1 text-sm font-medium ${isChecked ? 'text-slate-900' : 'text-slate-400'}`}>
                          {team.name}
                        </span>
                        {isChecked ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setTeamMode(team.id, "roster")}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${mode === "roster" ? "bg-orange-500 border-orange-500 text-white font-medium" : "border-slate-300 text-slate-500 hover:border-orange-300"}`}
                            >
                              With roster
                            </button>
                            <button
                              type="button"
                              onClick={() => setTeamMode(team.id, "empty")}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${mode === "empty" ? "bg-orange-500 border-orange-500 text-white font-medium" : "border-slate-300 text-slate-500 hover:border-orange-300"}`}
                            >
                              Empty
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Not copied</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-slate-500 mt-2">
                Copied teams start 0–0. "With roster" also copies player names, jersey numbers, positions and photos.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm font-medium">{errorMessage}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createSeasonMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createSeasonMutation.isPending || !seasonName.trim()}
            className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
          >
            {createSeasonMutation.isPending
              ? 'Creating…'
              : copyFromId === START_EMPTY
                ? 'Create season'
                : `Create season (${selectedCount} ${selectedCount === 1 ? 'team' : 'teams'})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
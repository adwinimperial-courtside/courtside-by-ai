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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [rosterDeadline, setRosterDeadline] = useState("");
  const [registrationMode, setRegistrationMode] = useState("open");
  const [teamSlots, setTeamSlots] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    initialData: null,
  });

  useEffect(() => {
    if (open) {
      setSeasonName("");
      setSeasonYear(new Date().getFullYear().toString());
      setStartDate("");
      setEndDate("");
      setRegistrationDeadline("");
      setRosterDeadline("");
      setRegistrationMode("open");
      setTeamSlots("");
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

  const handleStartDateChange = (value) => {
    setStartDate(value);
    const year = (value || "").slice(0, 4);
    if (/^\d{4}$/.test(year)) setSeasonYear(year);
  };

  const modeCardClass = (mode) =>
    "text-left p-3 rounded-lg border transition-colors " +
    (registrationMode === mode
      ? "border-orange-500 bg-orange-50"
      : "border-slate-200 hover:border-orange-300");

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
      } : (group && group.owner_user_id ? {
        owner_user_id: group.owner_user_id,
        owner_email: group.owner_email,
        owner_name: group.owner_name,
      } : (currentUser ? {
        owner_user_id: currentUser.id,
        owner_email: currentUser.email,
        owner_name: currentUser.full_name,
      } : {}));
      Object.keys(ownerInfo).forEach(k => { if (ownerInfo[k] === undefined) delete ownerInfo[k]; });

      const seasonFields = { registration_mode: registrationMode };
      if (startDate) seasonFields.start_date = startDate;
      if (endDate) seasonFields.end_date = endDate;
      if (registrationMode === "open") {
        if (registrationDeadline) seasonFields.registration_deadline = registrationDeadline;
        const slots = parseInt(teamSlots, 10);
        if (!isNaN(slots) && slots > 0) seasonFields.team_slots = slots;
      }
      const newLeague = await base44.entities.League.create({
        name: seasonName.trim(),
        season: seasonYear.trim(),
        group_id: group.id,
        ...ownerInfo,
        ...seasonFields,
      });

      if (rosterDeadline) {
        try {
          await base44.entities.RosterSettings.create({
            league_id: newLeague.id,
            due_date: new Date(rosterDeadline + "T23:59:59").toISOString(),
            locked: false,
            updated_by: currentUser?.email || "",
          });
        } catch (rosterSettingsError) {
          console.warn("SEASON_SETUP_V1: could not create RosterSettings", rosterSettingsError);
        }
      }

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

      if (currentUser?.user_type === 'league_admin') {
        const mine = currentUser.assigned_league_ids || [];
        if (!mine.includes(newLeague.id)) {
          await base44.auth.updateMe({ assigned_league_ids: [...mine, newLeague.id] });
        }
      }
      try {
        const groupLeagueIds = groupSeasons.map(l => l.id);
        const allUsers = await base44.entities.User.list();
        const groupAdmins = allUsers.filter(u =>
          u.user_type === 'league_admin' &&
          u.id !== currentUser?.id &&
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
      } catch (propagationError) {
        console.warn('NEW_SEASON_ADMIN_V1: could not update other group admins', propagationError);
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
    if (!startDate) {
      setErrorMessage('Please choose a start date');
      return;
    }
    if (endDate && endDate < startDate) {
      setErrorMessage('End date cannot be before the start date');
      return;
    }
    if (registrationMode === 'open' && !registrationDeadline) {
      setErrorMessage('Please choose a registration deadline');
      return;
    }
    if (!rosterDeadline) {
      setErrorMessage('Please choose a roster deadline');
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="new-season-start">Start date</Label>
              <Input
                id="new-season-start"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-season-end">End date <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Input
                id="new-season-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
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

          <div data-marker="SEASON_SETUP_V1">
            <Label>How do teams join this season?</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setRegistrationMode("open")}
                className={modeCardClass("open")}
              >
                <span className="block text-sm font-medium text-slate-900">Open registration</span>
                <span className="block text-xs text-slate-500 mt-0.5">Coaches apply through a link. You approve each one.</span>
              </button>
              <button
                type="button"
                onClick={() => setRegistrationMode("closed")}
                className={modeCardClass("closed")}
              >
                <span className="block text-sm font-medium text-slate-900">I add the teams myself</span>
                <span className="block text-xs text-slate-500 mt-0.5">You create each team and send the coach a code.</span>
              </button>
            </div>
          </div>

          {registrationMode === "open" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="new-season-regdeadline">Registration deadline</Label>
                <Input
                  id="new-season-regdeadline"
                  type="date"
                  value={registrationDeadline}
                  onChange={(e) => setRegistrationDeadline(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">Last day coaches can apply.</p>
              </div>
              <div>
                <Label htmlFor="new-season-slots">Team slots <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input
                  id="new-season-slots"
                  type="number"
                  min="1"
                  value={teamSlots}
                  onChange={(e) => setTeamSlots(e.target.value)}
                  placeholder="e.g., 8"
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">A target, not a hard limit.</p>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="new-season-rosterdeadline">Roster deadline</Label>
            <Input
              id="new-season-rosterdeadline"
              type="date"
              value={rosterDeadline}
              onChange={(e) => setRosterDeadline(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">Last day coaches can edit their roster. Coach roster editing opens as soon as the season is created.</p>
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
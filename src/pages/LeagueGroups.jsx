import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Layers, Plus, Pencil, Trash2, X, ShieldAlert, CheckCircle2 } from "lucide-react";
import HelpButton from "../components/help/HelpButton";

export default function LeagueGroups() {
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [addTarget, setAddTarget] = useState(null);
  const [checkedIds, setCheckedIds] = useState([]);

  const { data: currentUser } = useQuery({
    queryKey: ["user"],
    queryFn: () => base44.auth.me(),
    initialData: null,
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["leagueGroups"],
    queryFn: () => base44.entities.LeagueGroup.list(),
  });

  const { data: leagues = [], isLoading: leaguesLoading } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
  });

  const isAppAdmin = currentUser?.user_type === "app_admin";

  const seasonsOf = (groupId) =>
    leagues
      .filter((l) => l.group_id === groupId)
      .sort((a, b) => String(b.season || "").localeCompare(String(a.season || "")));

  const ungrouped = leagues
    .filter((l) => !l.group_id)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const ownerLabel = (group, seasons) => {
    const current = seasons.find((s) => s.id === group.current_league_id) || seasons[0];
    if (!current) return "No seasons yet";
    return current.owner_name || current.owner_email || current.created_by || "Unknown owner";
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["leagueGroups"] });
    queryClient.invalidateQueries({ queryKey: ["leagues"] });
  };

  const ok = (msg) => setBanner({ type: "ok", msg });
  const fail = (msg) => setBanner({ type: "err", msg });

  const createGroup = async () => {
    if (!newName.trim()) return fail("Group name is required.");
    setBusy(true);
    try {
      await base44.entities.LeagueGroup.create({
        name: newName.trim(),
        description: newDescription.trim(),
      });
      setShowNewGroup(false);
      setNewName("");
      setNewDescription("");
      refresh();
      ok("Group created.");
    } catch (e) {
      fail("Could not create group: " + (e?.message || "unknown error"));
    } finally {
      setBusy(false);
    }
  };

  const saveRename = async () => {
    if (!renameValue.trim() || !renameTarget) return;
    setBusy(true);
    try {
      await base44.entities.LeagueGroup.update(renameTarget.id, { name: renameValue.trim() });
      setRenameTarget(null);
      refresh();
      ok("Group renamed.");
    } catch (e) {
      fail("Could not rename group: " + (e?.message || "unknown error"));
    } finally {
      setBusy(false);
    }
  };

  const deleteGroup = async (group) => {
    if (seasonsOf(group.id).length > 0) return fail("Remove all seasons from the group first.");
    if (!window.confirm(`Delete the empty group "${group.name}"?`)) return;
    setBusy(true);
    try {
      await base44.entities.LeagueGroup.delete(group.id);
      refresh();
      ok("Group deleted.");
    } catch (e) {
      fail("Could not delete group: " + (e?.message || "unknown error"));
    } finally {
      setBusy(false);
    }
  };

  const addSeasons = async () => {
    if (!addTarget || checkedIds.length === 0) return;
    setBusy(true);
    try {
      for (const id of checkedIds) {
        await base44.entities.League.update(id, { group_id: addTarget.id });
      }
      if (!addTarget.current_league_id) {
        await base44.entities.LeagueGroup.update(addTarget.id, { current_league_id: checkedIds[0] });
      }
      setAddTarget(null);
      setCheckedIds([]);
      refresh();
      ok("Seasons added to group.");
    } catch (e) {
      fail("Could not add seasons: " + (e?.message || "unknown error"));
    } finally {
      setBusy(false);
    }
  };

  const makeCurrent = async (group, leagueId) => {
    setBusy(true);
    try {
      await base44.entities.LeagueGroup.update(group.id, { current_league_id: leagueId });
      refresh();
      ok("Current season updated.");
    } catch (e) {
      fail("Could not update current season: " + (e?.message || "unknown error"));
    } finally {
      setBusy(false);
    }
  };

  const removeSeason = async (group, league) => {
    if (!window.confirm(`Remove "${league.name} (${league.season})" from ${group.name}? The league itself is not deleted.`)) return;
    setBusy(true);
    try {
      await base44.entities.League.update(league.id, { group_id: "" });
      if (group.current_league_id === league.id) {
        await base44.entities.LeagueGroup.update(group.id, { current_league_id: "" });
      }
      refresh();
      ok("Season removed from group.");
    } catch (e) {
      fail("Could not remove season: " + (e?.message || "unknown error"));
    } finally {
      setBusy(false);
    }
  };

  if (currentUser && !isAppAdmin) {
    return (
      <div className="p-6 max-w-3xl mx-auto" data-marker="LEAGUE_GROUPS_TOOL_V1">
        <Card className="border-red-200">
          <CardContent className="pt-6 flex items-center gap-3 text-red-700">
            <ShieldAlert className="w-6 h-6" />
            <p>This page is only available to the app administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-marker="LEAGUE_GROUPS_TOOL_V1">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Layers className="w-8 h-8 text-orange-600" />
          League Groups
          <HelpButton pageKey="leaguegroups" />
        </h1>
        <Button
          onClick={() => setShowNewGroup(true)}
          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Group
        </Button>
      </div>
      <p className="text-slate-600 mb-4">Group seasons under one league name and mark the current season.</p>

      {banner && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
            banner.type === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {banner.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          <span className="flex-1">{banner.msg}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {(groupsLoading || leaguesLoading) && <p className="text-slate-500 text-sm mb-4">Loading…</p>}

      <div className="grid gap-4 mb-8">
        {groups
          .slice()
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
          .map((group) => {
            const seasons = seasonsOf(group.id);
            return (
              <Card key={group.id} className="border-slate-200 shadow-lg">
                <CardHeader className="border-b border-slate-200 bg-white">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-xl">{group.name}</CardTitle>
                      <p className="text-sm text-slate-600 mt-1">
                        {ownerLabel(group, seasons)} · {seasons.length} season{seasons.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddTarget(group);
                          setCheckedIds([]);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add seasons
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRenameTarget(group);
                          setRenameValue(group.name || "");
                        }}
                        aria-label="Rename group"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {seasons.length === 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => deleteGroup(group)}
                          aria-label="Delete group"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {seasons.length === 0 ? (
                    <p className="text-sm text-slate-500">No seasons in this group yet. Use "Add seasons".</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {seasons.map((league) => {
                        const isCurrent = group.current_league_id === league.id;
                        return (
                          <div key={league.id} className="flex items-center justify-between gap-2 py-2 flex-wrap">
                            <span className="text-sm text-slate-900">
                              {league.name} <span className="text-slate-500">({league.season})</span>
                            </span>
                            <div className="flex items-center gap-2">
                              {isCurrent ? (
                                <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-medium">
                                  Current season
                                </span>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={busy}
                                    onClick={() => makeCurrent(group, league.id)}
                                  >
                                    Make current
                                  </Button>
                                  <span className="text-xs text-slate-400">Archived</span>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                                disabled={busy}
                                onClick={() => removeSeason(group, league)}
                                aria-label="Remove from group"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        {!groupsLoading && groups.length === 0 && (
          <p className="text-sm text-slate-500">No groups yet. Create one with "New Group".</p>
        )}
      </div>

      <h2 className="text-lg font-bold text-slate-900 mb-2">Ungrouped leagues</h2>
      <Card className="border-slate-200">
        <CardContent className="pt-4">
          {ungrouped.length === 0 ? (
            <p className="text-sm text-slate-500">Every league belongs to a group.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {ungrouped.map((league) => (
                <div key={league.id} className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-900">
                    {league.name} <span className="text-slate-500">({league.season})</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New league group</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Fin-Noy"
              />
            </div>
            <div>
              <Label htmlFor="group-desc">Description (optional)</Label>
              <Textarea
                id="group-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewGroup(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={createGroup}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              Create group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename group</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="rename-input">Group name</Label>
            <Input id="rename-input" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={saveRename}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!addTarget} onOpenChange={(open) => !open && setAddTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add seasons to {addTarget?.name}</DialogTitle>
          </DialogHeader>
          {ungrouped.length === 0 ? (
            <p className="text-sm text-slate-500">There are no ungrouped leagues to add.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-2">
              {ungrouped.map((league) => (
                <label key={league.id} className="flex items-center gap-3 py-1 cursor-pointer">
                  <Checkbox
                    checked={checkedIds.includes(league.id)}
                    onCheckedChange={(checked) =>
                      setCheckedIds((prev) =>
                        checked ? [...prev, league.id] : prev.filter((id) => id !== league.id)
                      )
                    }
                  />
                  <span className="text-sm">
                    {league.name} <span className="text-slate-500">({league.season})</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || checkedIds.length === 0}
              onClick={addSeasons}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              Add {checkedIds.length > 0 ? `(${checkedIds.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
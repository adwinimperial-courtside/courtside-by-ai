import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Plus, Trash2, Lock, ChevronRight, AlertTriangle, Flag, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import HelpButton from "../components/help/HelpButton";

// COACH_ROSTER_V1 — mobile-first roster editor for coaches. Coaches can add,
// edit, and remove players on their own team while the editing window is open.
// The window closes on whichever comes first: the league's roster deadline,
// a manual league lock by the admin, the team's first game (completed OR in
// progress), or the coach marking the roster as final ("Mark roster done").
// All writes go through the manageCoachRoster backend function, which
// re-checks the window server-side — this page's checks are for display only.

const NAVY = "#0B1F3A";
const ORANGE = "#F26B1F";
const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

export default function CoachRoster() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ["coachRosterMe"],
    queryFn: () => base44.auth.me(),
  });

  const { data: allLeagues = [] } = useQuery({
    queryKey: ["coachRosterLeagues"],
    queryFn: () => base44.entities.League.list(),
  });

  const [selectedLeagueId, setSelectedLeagueId] = useState(null);

  const userLeagues = useMemo(() => {
    if (!allLeagues.length || !currentUser?.assigned_league_ids?.length) return [];
    return allLeagues.filter((l) => currentUser.assigned_league_ids.includes(l.id));
  }, [allLeagues, currentUser]);

  useEffect(() => {
    if (userLeagues.length > 0 && !selectedLeagueId) {
      setSelectedLeagueId(
        currentUser?.default_league_id && userLeagues.some((l) => l.id === currentUser.default_league_id)
          ? currentUser.default_league_id
          : userLeagues[0].id
      );
    }
  }, [userLeagues, selectedLeagueId, currentUser]);

  // The coach's team: league_team_pairs first, UserLeagueIdentity as fallback.
  const linkedTeamId = useMemo(() => {
    const pairs = currentUser?.league_team_pairs || [];
    const p = pairs.find((pp) => pp && pp.league_id === selectedLeagueId);
    return p?.team_id || null;
  }, [currentUser, selectedLeagueId]);

  const { data: identityTeamId = null } = useQuery({
    queryKey: ["coachRosterIdentity", currentUser?.id, selectedLeagueId],
    enabled: !!currentUser?.id && !!selectedLeagueId && !linkedTeamId,
    queryFn: async () => {
      try {
        const ids = await base44.entities.UserLeagueIdentity.filter({
          user_id: currentUser.id,
          league_id: selectedLeagueId,
          role: "coach",
        });
        const withTeam = ids.find((i) => i.team_id);
        return withTeam?.team_id || null;
      } catch (_e) {
        return null;
      }
    },
  });

  const teamId = linkedTeamId || identityTeamId || null;

  const { data: teams = [] } = useQuery({
    queryKey: ["coachRosterTeams", selectedLeagueId],
    enabled: !!selectedLeagueId,
    queryFn: () => base44.entities.Team.filter({ league_id: selectedLeagueId }),
  });
  const currentTeam = useMemo(() => teams.find((t) => t.id === teamId) || null, [teams, teamId]);

  const { data: players = [], isLoading: playersLoading } = useQuery({
    queryKey: ["coachRosterPlayers", teamId],
    enabled: !!teamId,
    queryFn: () => base44.entities.Player.filter({ team_id: teamId }),
  });

  const { data: games = [] } = useQuery({
    queryKey: ["coachRosterGames", selectedLeagueId],
    enabled: !!selectedLeagueId,
    queryFn: () => base44.entities.Game.filter({ league_id: selectedLeagueId }),
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ["coachRosterSettings", selectedLeagueId],
    enabled: !!selectedLeagueId,
    queryFn: () => base44.entities.RosterSettings.filter({ league_id: selectedLeagueId }),
  });

  const { data: statusList = [] } = useQuery({
    queryKey: ["coachRosterStatus", teamId],
    enabled: !!teamId,
    queryFn: () => base44.entities.TeamRosterStatus.filter({ team_id: teamId }),
  });

  const settings = settingsList[0] || null;
  const teamStatus = statusList[0] || null;

  // ---- Window state (display only; the backend re-checks on every write) ----
  const teamHasPlayed = useMemo(() => {
    if (!teamId) return false;
    return games.some(
      (g) =>
        (g.status === "completed" || g.status === "in_progress") &&
        (g.home_team_id === teamId || g.away_team_id === teamId)
    );
  }, [games, teamId]);

  const dueDate = settings?.due_date ? new Date(settings.due_date) : null;
  const notOpened = !dueDate;
  const deadlinePassed = !!(dueDate && new Date() > dueDate);
  const manualLocked = settings?.locked === true;
  const markedDone = teamStatus?.done === true;
  const windowOpen = !!teamId && !teamHasPlayed && !notOpened && !deadlinePassed && !manualLocked && !markedDone;

  const lockReason = markedDone
    ? "You marked this roster as final. Only your league admin can reopen editing."
    : teamHasPlayed
    ? "Roster editing is locked after your first game. Contact your league admin for corrections."
    : manualLocked
    ? "Roster editing has been closed by your league admin."
    : notOpened
    ? "Roster editing is not open yet. Your league admin needs to set a roster deadline first."
    : deadlinePassed
    ? "The roster deadline has passed. Contact your league admin for changes."
    : null;

  const daysLeft = dueDate ? Math.max(0, Math.ceil((dueDate - new Date()) / 86400000)) : null;

  // ---- Editor rows ----
  const [rows, setRows] = useState([]);
  const [removedIds, setRemovedIds] = useState([]);
  const [expandedKey, setExpandedKey] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);

  useEffect(() => {
    if (!dirty) {
      const sorted = [...players].sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999));
      setRows(sorted.map((p) => ({ _key: p.id, id: p.id, name: p.name || "", jersey_number: String(p.jersey_number ?? ""), position: p.position || "PG" })));
      setRemovedIds([]);
    }
  }, [players, dirty]);

  // JERSEY_DEDUPE_V1 rule — unique numbers per team, #7 = #07, blanks ignored.
  const duplicateJerseys = useMemo(() => {
    const counts = {};
    rows.forEach((row) => {
      const jn = String(row.jersey_number ?? "").trim();
      if (jn === "") return;
      const n = parseInt(jn, 10);
      if (isNaN(n)) return;
      counts[n] = (counts[n] || 0) + 1;
    });
    return new Set(Object.keys(counts).filter((k) => counts[k] > 1).map(Number));
  }, [rows]);
  const hasDuplicates = duplicateJerseys.size > 0;
  const duplicateList = [...duplicateJerseys].sort((a, b) => a - b).map((n) => `#${n}`).join(", ");
  const isDupRow = (row) => {
    const jn = String(row.jersey_number ?? "").trim();
    if (jn === "") return false;
    const n = parseInt(jn, 10);
    return !isNaN(n) && duplicateJerseys.has(n);
  };

  const updateRow = (key, patch) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const addRow = () => {
    const key = `new-${Date.now()}`;
    setRows((prev) => [...prev, { _key: key, id: null, name: "", jersey_number: "", position: "PG" }]);
    setExpandedKey(key);
    setDirty(true);
  };

  const removeRow = (row) => {
    const label = row.name ? `Remove ${row.name} from your roster?` : "Remove this player?";
    if (!window.confirm(label)) return;
    if (row.id) setRemovedIds((prev) => [...prev, row.id]);
    setRows((prev) => prev.filter((r) => r._key !== row._key));
    setDirty(true);
  };

  const invokeManage = async (payload) => {
    try {
      const res = await base44.functions.invoke("manageCoachRoster", payload);
      if (res?.data?.error) return { ok: false, error: res.data.error };
      return { ok: true, data: res?.data };
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "Something went wrong. Please try again.";
      return { ok: false, error: msg };
    }
  };

  const doSave = async () => {
    if (hasDuplicates) {
      toast({ title: "Duplicate jersey numbers", description: `Two players share the same number (${duplicateList}). Make each number unique, then save.`, variant: "destructive" });
      return false;
    }
    setSaving(true);
    const result = await invokeManage({
      action: "save",
      leagueId: selectedLeagueId,
      teamId,
      roster: rows.map((r) => ({ id: r.id, name: r.name, jersey_number: r.jersey_number, position: r.position })),
      removedIds,
    });
    setSaving(false);
    if (!result.ok) {
      toast({ title: "Could not save", description: result.error, variant: "destructive" });
      return false;
    }
    setDirty(false);
    setRemovedIds([]);
    setExpandedKey(null);
    queryClient.invalidateQueries({ queryKey: ["coachRosterPlayers", teamId] });
    toast({ title: "Saved", description: "Your roster has been updated." });
    return true;
  };

  const doMarkDone = async () => {
    setMarkingDone(true);
    if (dirty) {
      const saved = await doSave();
      if (!saved) {
        setMarkingDone(false);
        return;
      }
    }
    const result = await invokeManage({ action: "markDone", leagueId: selectedLeagueId, teamId });
    setMarkingDone(false);
    if (!result.ok) {
      toast({ title: "Could not finish roster", description: result.error, variant: "destructive" });
      return;
    }
    setDoneOpen(false);
    setConfirmChecked(false);
    queryClient.invalidateQueries({ queryKey: ["coachRosterStatus", teamId] });
    toast({ title: "Roster marked final", description: "Your league admin has been notified. Good luck this season!" });
  };

  const filledCount = rows.filter((r) => String(r.name || "").trim() !== "").length;

  // ---- Render ----
  if (userLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      {/* Hero */}
      <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: NAVY }}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[17px] font-bold text-white leading-tight truncate">
              {currentTeam?.name || "My roster"}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="text-[12px] text-slate-400">
                My roster{filledCount ? ` · ${filledCount} player${filledCount !== 1 ? "s" : ""}` : ""}
              </div>
              <HelpButton pageKey="coachroster" />
            </div>
          </div>
          {windowOpen ? (
            <div className="flex-shrink-0 text-right">
              <span className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: ORANGE }}>
                {dueDate ? `Open until ${format(dueDate, "d.M.")}` : "Open"}
              </span>
              {daysLeft !== null && (
                <div className="text-[11px] text-slate-400 mt-1">{daysLeft} day{daysLeft !== 1 ? "s" : ""} left</div>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/10 text-slate-300 border border-white/15">
              <Lock className="w-3 h-3" /> {markedDone ? "Final" : "Locked"}
            </span>
          )}
        </div>
        {userLeagues.length > 1 && (
          <div className="mt-3">
            <Select value={selectedLeagueId || ""} onValueChange={(v) => { setSelectedLeagueId(v); setDirty(false); }}>
              <SelectTrigger className="w-full bg-white/10 border-white/15 text-white text-sm font-semibold rounded-xl h-auto py-2">
                <SelectValue placeholder="Choose a league" />
              </SelectTrigger>
              <SelectContent>
                {userLeagues.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}{l.season ? ` — ${l.season}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!teamId ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-500">
          Your account isn't linked to a team in this league yet. Ask your league admin to link you, then come back here.
        </div>
      ) : playersLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Marked-done celebration or lock banner */}
          {markedDone ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#16A34A" }} />
              <div>
                <div className="text-[14px] font-bold text-slate-900">Your roster is final</div>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  {teamStatus?.done_at ? `Marked final on ${format(new Date(teamStatus.done_at), "d.M.yyyy")}. ` : ""}
                  Your league admin has been notified. If something needs to change, ask them to reopen editing.
                </p>
              </div>
            </div>
          ) : !windowOpen && lockReason ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 flex items-start gap-3">
              <Lock className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-[14px] font-bold text-slate-900">Roster editing is closed</div>
                <p className="text-[13px] text-slate-500 mt-0.5">{lockReason}</p>
              </div>
            </div>
          ) : null}

          {/* Duplicate warning */}
          {windowOpen && hasDuplicates && (
            <div className="rounded-2xl p-3 mb-3 flex items-start gap-2.5" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
              <p className="text-[13px]" style={{ color: "#991B1B" }}>
                Duplicate jersey numbers: {duplicateList}. Make each number unique before saving.
              </p>
            </div>
          )}

          {/* Player cards */}
          <div className="space-y-2">
            {rows.map((row) => {
              const expanded = windowOpen && expandedKey === row._key;
              const dup = isDupRow(row);
              return (
                <div
                  key={row._key}
                  className="bg-white rounded-2xl p-3"
                  style={{ border: expanded ? `1.5px solid ${ORANGE}` : dup ? "1.5px solid #FCA5A5" : "1px solid #e2e8f0" }}
                >
                  {expanded ? (
                    <div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.jersey_number}
                          onChange={(e) => updateRow(row._key, { jersey_number: e.target.value })}
                          placeholder="#"
                          className="w-16 text-center text-[16px] font-bold border rounded-xl py-2.5 focus:outline-none"
                          style={{ borderColor: dup ? "#DC2626" : "#cbd5e1" }}
                        />
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateRow(row._key, { name: e.target.value })}
                          placeholder="Player name"
                          className="flex-1 min-w-0 text-[16px] border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none"
                        />
                      </div>
                      <div className="flex gap-2 mt-2 items-center">
                        <select
                          value={row.position}
                          onChange={(e) => updateRow(row._key, { position: e.target.value })}
                          className="flex-1 text-[14px] border border-slate-300 rounded-xl px-3 py-2.5 bg-white"
                        >
                          {POSITIONS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeRow(row)}
                          className="border rounded-xl px-3 py-2.5"
                          style={{ borderColor: "#FECACA", color: "#DC2626" }}
                          aria-label="Remove player"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => setExpandedKey(null)}
                        className="w-full mt-2 text-[14px] font-bold text-white rounded-xl py-2.5"
                        style={{ backgroundColor: NAVY }}
                      >
                        Done editing
                      </button>
                    </div>
                  ) : (
                    <button
                      className="w-full flex items-center gap-3 text-left"
                      onClick={() => windowOpen && setExpandedKey(row._key)}
                      disabled={!windowOpen}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-[15px] flex-shrink-0"
                        style={{ backgroundColor: dup ? "#DC2626" : NAVY }}
                      >
                        {String(row.jersey_number ?? "").trim() || "–"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-semibold text-slate-900 truncate">{row.name || "Unnamed player"}</div>
                        <div className="text-[12px] text-slate-500">{row.position}</div>
                      </div>
                      {windowOpen && <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {windowOpen && (
            <>
              <button
                onClick={addRow}
                className="w-full mt-3 border border-dashed border-slate-300 rounded-2xl py-3 text-[14px] font-semibold text-slate-600 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add player
              </button>

              <div className="border-t border-slate-200 mt-4 pt-3 space-y-2">
                <button
                  onClick={doSave}
                  disabled={saving || !dirty}
                  className="w-full text-[15px] font-bold rounded-xl py-3 border border-slate-300 bg-white text-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save changes
                </button>
                <button
                  onClick={() => { setConfirmChecked(false); setDoneOpen(true); }}
                  disabled={saving || hasDuplicates || filledCount === 0}
                  className="w-full text-[15px] font-bold text-white rounded-xl py-3 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: ORANGE }}
                >
                  <Flag className="w-4 h-4" /> Mark roster done
                </button>
                <p className="text-[12px] text-slate-400 text-center px-2">
                  Mark roster done tells your league admin your roster is final and closes editing for good.
                </p>
              </div>
            </>
          )}
        </>
      )}

      {/* Hard-confirm dialog */}
      <Dialog open={doneOpen} onOpenChange={(o) => { setDoneOpen(o); if (!o) setConfirmChecked(false); }}>
        <DialogContent className="max-w-[420px] rounded-2xl">
          <div className="flex items-center gap-2.5">
            <Flag className="w-5 h-5" style={{ color: ORANGE }} />
            <span className="text-[16px] font-bold text-slate-900">Finish your roster?</span>
          </div>
          <p className="text-[14px] text-slate-600 leading-relaxed">
            This tells your league admin that your roster is <strong className="text-slate-900">final</strong>.
          </p>
          <div className="rounded-xl p-3" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
            <p className="text-[13px] leading-relaxed flex items-start gap-1.5" style={{ color: "#92400E" }}>
              <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>After this, you cannot add, edit, or remove players anymore. Only your league admin can make changes or reopen editing for you.</span>
            </p>
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
            <p className="text-[13px] leading-relaxed" style={{ color: "#1E40AF" }}>
              Not sure yet? Just hit <strong>Save changes</strong> instead — your work is kept and you can come back anytime.
              {dueDate ? <> But remember: every roster must be final before <strong>{format(dueDate, "d.M.yyyy")}</strong>.</> : null}
            </p>
          </div>
          {dirty && (
            <p className="text-[12px] text-slate-500">Your latest edits will be saved first.</p>
          )}
          <label className="flex items-start gap-2 text-[13px] text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4"
            />
            <span>I have checked all names and jersey numbers. My roster is final.</span>
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setDoneOpen(false); setConfirmChecked(false); }}
              className="text-[13px] font-semibold border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-700"
            >
              Go back and check
            </button>
            <button
              onClick={doMarkDone}
              disabled={!confirmChecked || markingDone}
              className="text-[13px] font-bold text-white rounded-xl px-3.5 py-2.5 disabled:opacity-50 flex items-center gap-2"
              style={{ backgroundColor: ORANGE }}
            >
              {markingDone && <Loader2 className="w-4 h-4 animate-spin" />} Yes, my roster is final
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
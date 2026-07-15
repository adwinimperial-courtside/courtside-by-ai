import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock, Lock, LockOpen, Loader2, ChevronDown, ChevronUp, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

// ROSTER_DEADLINE_PANEL_V1 — admin controls for the coach roster editing
// window. Lets a league admin / app admin set the roster deadline, lock or
// unlock coach editing manually, see which teams have marked their roster
// final, and reopen editing for a team that finished by mistake.
// Settings live in RosterSettings (one record per league); per-team "final"
// state lives in TeamRosterStatus. Coach-side enforcement happens in the
// manageCoachRoster backend function — these controls just set the rules.

const ORANGE = "#F26B1F";

const toLocalInputValue = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function RosterDeadlinePanel({ leagueId, teams = [], currentUser }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expanded, setExpanded] = useState(false);
  const [dueInput, setDueInput] = useState("");
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);
  const [reopeningId, setReopeningId] = useState(null);

  const { data: settingsList = [] } = useQuery({
    queryKey: ["rosterSettings", leagueId],
    enabled: !!leagueId,
    queryFn: () => base44.entities.RosterSettings.filter({ league_id: leagueId }),
  });
  const settings = settingsList[0] || null;

  const { data: statusList = [] } = useQuery({
    queryKey: ["teamRosterStatus", leagueId],
    enabled: !!leagueId,
    queryFn: () => base44.entities.TeamRosterStatus.filter({ league_id: leagueId }),
  });

  useEffect(() => {
    setDueInput(toLocalInputValue(settings?.due_date));
  }, [settings?.due_date, leagueId]);

  const statusByTeam = useMemo(() => {
    const m = new Map();
    statusList.forEach((s) => m.set(s.team_id, s));
    return m;
  }, [statusList]);

  const doneCount = useMemo(
    () => teams.filter((t) => statusByTeam.get(t.id)?.done === true).length,
    [teams, statusByTeam]
  );

  const dueDate = settings?.due_date ? new Date(settings.due_date) : null;
  const deadlinePassed = !!(dueDate && new Date() > dueDate);
  const locked = settings?.locked === true;
  const windowOpen = !locked && !deadlinePassed;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["rosterSettings", leagueId] });
    queryClient.invalidateQueries({ queryKey: ["teamRosterStatus", leagueId] });
  };

  const upsertSettings = async (patch) => {
    const payload = { ...patch, updated_by: currentUser?.email || "" };
    if (settings) {
      await base44.entities.RosterSettings.update(settings.id, payload);
    } else {
      await base44.entities.RosterSettings.create({ league_id: leagueId, ...payload });
    }
  };

  const handleSaveDeadline = async () => {
    setSavingDeadline(true);
    try {
      const iso = dueInput ? new Date(dueInput).toISOString() : null;
      await upsertSettings({ due_date: iso });
      refresh();
      toast({
        title: iso ? "Deadline saved" : "Deadline removed",
        description: iso
          ? `Coaches can edit their rosters until ${format(new Date(iso), "d.M.yyyy HH:mm")}.`
          : "There is no roster deadline for this league now.",
      });
    } catch (e) {
      console.error("Saving deadline failed:", e);
      toast({ title: "Could not save deadline", description: "Please try again.", variant: "destructive" });
    } finally {
      setSavingDeadline(false);
    }
  };

  const handleToggleLock = async () => {
    const goingToLock = !locked;
    if (goingToLock && !window.confirm("Close roster editing for ALL teams in this league right now? Coaches will no longer be able to change their rosters.")) return;
    setTogglingLock(true);
    try {
      await upsertSettings({ locked: goingToLock });
      refresh();
      toast({
        title: goingToLock ? "Roster editing locked" : "Roster editing unlocked",
        description: goingToLock
          ? "Coaches can no longer edit their rosters in this league."
          : "Coaches can edit their rosters again (until the deadline).",
      });
    } catch (e) {
      console.error("Toggling lock failed:", e);
      toast({ title: "Could not update the lock", description: "Please try again.", variant: "destructive" });
    } finally {
      setTogglingLock(false);
    }
  };

  const handleReopen = async (team) => {
    const status = statusByTeam.get(team.id);
    if (!status) return;
    if (!window.confirm(`Reopen roster editing for ${team.name}? Their coach will be able to change the roster again (until the deadline or a lock).`)) return;
    setReopeningId(team.id);
    try {
      await base44.entities.TeamRosterStatus.update(status.id, {
        done: false,
        reopened_at: new Date().toISOString(),
        reopened_by: currentUser?.email || "",
      });
      refresh();
      toast({ title: "Editing reopened", description: `${team.name}'s coach can edit the roster again.` });
    } catch (e) {
      console.error("Reopening failed:", e);
      toast({ title: "Could not reopen", description: "Please try again.", variant: "destructive" });
    } finally {
      setReopeningId(null);
    }
  };

  const chip = locked
    ? { text: "Locked by admin", bg: "#FEF2F2", border: "#FECACA", color: "#991B1B" }
    : !dueDate
    ? { text: "Closed · set a deadline to open editing", bg: "#FFFBEB", border: "#FDE68A", color: "#92400E" }
    : deadlinePassed
    ? { text: "Deadline passed", bg: "#FEF2F2", border: "#FECACA", color: "#991B1B" }
    : { text: teams.length ? `Open · ${doneCount} of ${teams.length} teams done` : "Open", bg: "#F0FDF4", border: "#BBF7D0", color: "#166534" };

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [teams]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-slate-500" />
          <div>
            <div className="font-semibold text-slate-900 text-sm">Coach roster editing</div>
            <div className="text-xs text-slate-500">Coaches can add, edit, and remove players until the deadline, a lock, their team's first game, or marking their roster done.</div>
          </div>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: chip.bg, border: `1px solid ${chip.border}`, color: chip.color }}>
          {chip.text}
        </span>
      </div>

      <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-600">Open until</span>
        <input
          type="datetime-local"
          value={dueInput}
          onChange={(e) => setDueInput(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={handleSaveDeadline}
          disabled={savingDeadline || toLocalInputValue(settings?.due_date) === dueInput}
        >
          {savingDeadline ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save deadline"}
        </Button>
        {(locked || (dueDate && !deadlinePassed)) && (
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={handleToggleLock}
            disabled={togglingLock}
          >
            {togglingLock ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : locked ? (
              <><LockOpen className="w-4 h-4 mr-1.5" /> Unlock editing</>
            ) : (
              <><Lock className="w-4 h-4 mr-1.5" /> Lock now</>
            )}
          </Button>
        )}
        {teams.length > 0 && (
          <button
            className="text-sm font-medium ml-auto inline-flex items-center gap-1"
            style={{ color: ORANGE }}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <>Hide teams <ChevronUp className="w-4 h-4" /></> : <>Show teams <ChevronDown className="w-4 h-4" /></>}
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-slate-100">
          {sortedTeams.map((team) => {
            const status = statusByTeam.get(team.id);
            const isDone = status?.done === true;
            return (
              <div key={team.id} className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-50 first:border-t-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{team.name}</div>
                  {isDone && status?.done_at && (
                    <div className="text-xs text-slate-500">
                      Final since {format(new Date(status.done_at), "d.M.yyyy")}
                      {status.coach_name ? ` · ${status.coach_name}` : ""}
                      {typeof status.player_count === "number" ? ` · ${status.player_count} players` : ""}
                    </div>
                  )}
                </div>
                {isDone ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534" }}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Roster done
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => handleReopen(team)}
                      disabled={reopeningId === team.id}
                    >
                      {reopeningId === team.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen</>}
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 flex-shrink-0">Still editing</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
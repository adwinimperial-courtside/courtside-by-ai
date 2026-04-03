import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Eye, Check, X, ChevronDown, ChevronUp, AlertTriangle, Link2, Users } from "lucide-react";
import PlayerLeagueMatchModal from "@/components/admin/PlayerLeagueMatchModal";

const norm = (v) => (v || "").trim().toLowerCase().replace(/\s+/g, " ");

export default function BulkIdentityMatching({ leagues = [], allUsers = [] }) {
  const queryClient = useQueryClient();
  const [targetLeagueId, setTargetLeagueId] = useState("");
  const [sourceLeagueId, setSourceLeagueId] = useState("");
  const [preview, setPreview] = useState(null); // { ready, review, unmatched, conflicts }
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [approvals, setApprovals] = useState({}); // rowKey -> "approved"|"skipped"
  const [expanded, setExpanded] = useState({ ready: true, review: true, unmatched: false, conflicts: true });
  const [modalPlayer, setModalPlayer] = useState(null); // open existing modal for a user
  const [overrideUser, setOverrideUser] = useState({}); // rowKey -> user override from modal

  const { data: allTeams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list("-created_date", 2000) });

  const runPreview = async () => {
    if (!targetLeagueId || !sourceLeagueId) return;
    setIsPreviewing(true);
    setPreview(null);
    setApprovals({});
    setOverrideUser({});

    try {
      const targetTeams = allTeams.filter(t => t.league_id === targetLeagueId);
      const sourceTeams = allTeams.filter(t => t.league_id === sourceLeagueId);

      const [allPlayers, sourceIdentities] = await Promise.all([
        base44.entities.Player.list("-created_date", 5000),
        base44.entities.UserLeagueIdentity.filter({ league_id: sourceLeagueId }, "-created_date", 2000),
      ]);
      const targetTeamIds = new Set(targetTeams.map(t => t.id));
      const targetPlayers = allPlayers.filter(p => targetTeamIds.has(p.team_id));

      // Fetch existing target identities to detect conflicts
      const existingTargetIdentities = await base44.entities.UserLeagueIdentity.filter({ league_id: targetLeagueId }, "-created_date", 2000);

      // Build lookup: normalized source player name -> source identity list
      const sourceByName = {};
      for (const si of sourceIdentities) {
        const key = norm(si.matched_player_name);
        if (!key) continue;
        if (!sourceByName[key]) sourceByName[key] = [];
        sourceByName[key].push(si);
      }

      const ready = [], review = [], unmatched = [], conflicts = [];
      const approvedUserIds = new Set(); // track approved matches to detect conflicts

      for (const player of targetPlayers) {
        const team = targetTeams.find(t => t.id === player.team_id);
        const key = norm(player.name);
        const matches = sourceByName[key] || [];
        const existingTargetIdentity = existingTargetIdentities.find(i => i.matched_player_id === player.id || norm(i.matched_player_name) === key);

        const rowKey = player.id;

        if (matches.length === 0) {
          unmatched.push({ rowKey, player, team, reason: "No name match in source league" });
          continue;
        }

        // Deduplicate by user_id
        const byUser = {};
        for (const m of matches) {
          if (!m.user_id) continue;
          byUser[m.user_id] = m;
        }
        const uniqueMatches = Object.values(byUser);

        if (uniqueMatches.length === 0) {
          unmatched.push({ rowKey, player, team, reason: "Source identity has no linked user" });
          continue;
        }

        if (uniqueMatches.length > 1) {
          const users = uniqueMatches.map(m => allUsers.find(u => u.id === m.user_id)).filter(Boolean);
          conflicts.push({ rowKey, player, team, matches: uniqueMatches, users, reason: `${uniqueMatches.length} different users matched same name` });
          continue;
        }

        const si = uniqueMatches[0];
        const user = allUsers.find(u => u.id === si.user_id);

        if (!user) {
          unmatched.push({ rowKey, player, team, reason: "Matched user not found in system" });
          continue;
        }

        if (existingTargetIdentity && existingTargetIdentity.user_id && existingTargetIdentity.user_id !== user.id) {
          conflicts.push({ rowKey, player, team, matches: [si], users: [user], existingUser: allUsers.find(u => u.id === existingTargetIdentity.user_id), reason: "Target already linked to a different user" });
          continue;
        }

        const sourceTeam = sourceTeams.find(t => t.id === si.team_id);
        const normTeamMatch = sourceTeam && targetTeams.some(t => norm(t.name) === norm(sourceTeam.name));

        if (normTeamMatch) {
          ready.push({ rowKey, player, team, identity: si, user, sourceTeam, confidence: "high", reason: "Exact name + matching team" });
        } else {
          review.push({ rowKey, player, team, identity: si, user, sourceTeam, confidence: "medium", reason: "Exact name, team differs" });
        }
      }

      // Detect cross-row conflicts: same user approved for multiple rows
      const userToRows = {};
      for (const r of ready) {
        const uid = r.user.id;
        if (!userToRows[uid]) userToRows[uid] = [];
        userToRows[uid].push(r);
      }
      const dupReady = [], cleanReady = [];
      for (const r of ready) {
        if (userToRows[r.user.id].length > 1) {
          conflicts.push({ ...r, reason: "Same user matched to multiple target players" });
          // don't push to cleanReady
        } else {
          cleanReady.push(r);
        }
      }

      const initApprovals = {};
      for (const r of cleanReady) initApprovals[r.rowKey] = "approved";

      setPreview({ ready: cleanReady, review, unmatched, conflicts });
      setApprovals(initApprovals);
    } finally {
      setIsPreviewing(false);
    }
  };

  const setApproval = (rowKey, val) => setApprovals(s => ({ ...s, [rowKey]: val }));

  const approvedCount = preview
    ? [...(preview.ready || []), ...(preview.review || [])].filter(r => approvals[r.rowKey] === "approved").length
    : 0;

  const applyApproved = async () => {
    const allRows = [...(preview?.ready || []), ...(preview?.review || [])];
    const toApply = allRows.filter(r => approvals[r.rowKey] === "approved");
    if (!toApply.length) { alert("No approved matches to apply."); return; }

    setIsSaving(true);
    try {
      const matches = toApply.map(r => {
        const user = overrideUser[r.rowKey] || r.user;
        return {
          userId: user.id,
          playerId: r.player.id,
          playerName: r.player.name,
          teamId: r.team?.id || null,
          confidence: r.confidence || "medium",
          matchMethod: overrideUser[r.rowKey] ? "manual_admin" : "normalized_name",
        };
      });

      const res = await base44.functions.invoke("applyRosterMatches", { targetLeagueId, matches });
      const { applied, errors } = res.data;
      queryClient.invalidateQueries({ queryKey: ["userLeagueIdentities"] });
      queryClient.invalidateQueries({ queryKey: ["player_users"] });
      if (errors?.length) {
        alert(`Applied ${applied}. ${errors.length} error(s): ${errors.map(e => e.error).join(", ")}`);
      } else {
        alert(`Successfully applied ${applied} match(es).`);
      }
      setPreview(null);
      setApprovals({});
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = (section) => setExpanded(s => ({ ...s, [section]: !s[section] }));

  return (
    <div className="border border-blue-200 rounded-xl bg-blue-50/40 p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-blue-600" />
        <h2 className="font-bold text-slate-900 text-lg">Bulk League Identity Matching</h2>
        <Badge className="bg-blue-100 text-blue-700 text-xs">Preview Only Until Applied</Badge>
      </div>

      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4 text-sm text-amber-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
        <span>No changes are saved until you click <strong>Apply Approved Matches</strong>. Use the modal below for manual per-user fixes.</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Target League <span className="text-red-500">*</span></label>
          <Select value={targetLeagueId} onValueChange={v => { setTargetLeagueId(v); setPreview(null); }}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="New league needing assignments" /></SelectTrigger>
            <SelectContent>{leagues.filter(l => l.id !== sourceLeagueId).map(l => <SelectItem key={l.id} value={l.id}>{l.name} ({l.season})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">Source League <span className="text-red-500">*</span></label>
          <Select value={sourceLeagueId} onValueChange={v => { setSourceLeagueId(v); setPreview(null); }}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Existing league to copy from" /></SelectTrigger>
            <SelectContent>{leagues.filter(l => l.id !== targetLeagueId).map(l => <SelectItem key={l.id} value={l.id}>{l.name} ({l.season})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={runPreview} disabled={!targetLeagueId || !sourceLeagueId || isPreviewing} className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-sm gap-2 w-full">
            <Eye className="w-4 h-4" />
            {isPreviewing ? "Calculating..." : "Preview Bulk Matches"}
          </Button>
        </div>
      </div>

      {preview && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex flex-wrap gap-3 text-sm py-3 border-t border-blue-200">
            {[
              { label: "Ready", val: preview.ready.length, cls: "bg-green-100 text-green-800" },
              { label: "Needs Review", val: preview.review.length, cls: "bg-yellow-100 text-yellow-800" },
              { label: "Unmatched", val: preview.unmatched.length, cls: "bg-slate-100 text-slate-600" },
              { label: "Conflicts", val: preview.conflicts.length, cls: "bg-red-100 text-red-800" },
              { label: "Approved", val: approvedCount, cls: "bg-blue-100 text-blue-800 font-bold" },
            ].map(s => (
              <div key={s.label} className={`rounded-lg px-3 py-1.5 text-center min-w-[80px] ${s.cls}`}>
                <div className="text-lg font-bold">{s.val}</div>
                <div className="text-xs">{s.label}</div>
              </div>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { const a = {}; preview.ready.forEach(r => { a[r.rowKey] = "approved"; }); setApprovals(s => ({ ...s, ...a })); }}>
                Approve All Ready
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => { const a = {}; preview.ready.forEach(r => { a[r.rowKey] = "skipped"; }); setApprovals(s => ({ ...s, ...a })); }}>
                Clear Ready
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 gap-1" disabled={approvedCount === 0 || isSaving} onClick={applyApproved}>
                <Check className="w-3 h-3" />
                {isSaving ? "Applying..." : `Apply ${approvedCount} Approved`}
              </Button>
            </div>
          </div>

          {/* Ready section */}
          {preview.ready.length > 0 && (
            <BulkSection title={`Ready to Confirm (${preview.ready.length})`} color="green" expanded={expanded.ready} onToggle={() => toggle("ready")}>
              <BulkTable rows={preview.ready} approvals={approvals} onApproval={setApproval} onOpenModal={setModalPlayer} overrideUser={overrideUser} showActions />
            </BulkSection>
          )}

          {/* Review section */}
          {preview.review.length > 0 && (
            <BulkSection title={`Needs Review (${preview.review.length})`} color="yellow" expanded={expanded.review} onToggle={() => toggle("review")}>
              <BulkTable rows={preview.review} approvals={approvals} onApproval={setApproval} onOpenModal={setModalPlayer} overrideUser={overrideUser} showActions needsReview />
            </BulkSection>
          )}

          {/* Unmatched */}
          {preview.unmatched.length > 0 && (
            <BulkSection title={`Unmatched (${preview.unmatched.length})`} color="slate" expanded={expanded.unmatched} onToggle={() => toggle("unmatched")}>
              <UnmatchedTable rows={preview.unmatched} onOpenModal={setModalPlayer} allUsers={allUsers} />
            </BulkSection>
          )}

          {/* Conflicts */}
          {preview.conflicts.length > 0 && (
            <BulkSection title={`Conflicts — Manual Fix Required (${preview.conflicts.length})`} color="red" expanded={expanded.conflicts} onToggle={() => toggle("conflicts")}>
              <ConflictTable rows={preview.conflicts} onOpenModal={setModalPlayer} allUsers={allUsers} />
            </BulkSection>
          )}
        </div>
      )}

      {/* Existing modal passthrough */}
      {modalPlayer && (
        <PlayerLeagueMatchModal
          player={modalPlayer}
          onClose={() => {
            setModalPlayer(null);
            queryClient.invalidateQueries({ queryKey: ["userLeagueIdentities"] });
            queryClient.invalidateQueries({ queryKey: ["player_users"] });
          }}
        />
      )}
    </div>
  );
}

function BulkSection({ title, color, expanded, onToggle, children }) {
  const colors = {
    green: "border-green-200 bg-green-50/40",
    yellow: "border-yellow-200 bg-yellow-50/40",
    slate: "border-slate-200 bg-slate-50/40",
    red: "border-red-200 bg-red-50/40",
  };
  const titleColors = {
    green: "text-green-800",
    yellow: "text-yellow-800",
    slate: "text-slate-700",
    red: "text-red-800",
  };
  return (
    <div className={`border rounded-lg overflow-hidden ${colors[color]}`}>
      <button className={`w-full flex items-center justify-between px-4 py-2.5 font-semibold text-sm ${titleColors[color]} hover:opacity-80`} onClick={onToggle}>
        {title}
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && <div className="border-t border-inherit">{children}</div>}
    </div>
  );
}

function BulkTable({ rows, approvals, onApproval, onOpenModal, overrideUser, showActions, needsReview }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-white/60">
          <tr>
            {["Approval", "Target Player", "Team", "Matched User", "Source Team", "Confidence", "Reason", ""].map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/80">
          {rows.map(row => {
            const st = approvals[row.rowKey] || "pending";
            const user = row.user;
            return (
              <tr key={row.rowKey} className={st === "approved" ? "bg-green-50" : st === "skipped" ? "opacity-50 bg-white" : "bg-white"}>
                <td className="px-3 py-2">
                  {st === "approved" ? (
                    <button onClick={() => onApproval(row.rowKey, "skipped")} className="flex items-center gap-1 text-green-700 bg-green-100 border border-green-300 rounded-full px-2 py-0.5 hover:bg-green-200">
                      <Check className="w-3 h-3" /> Approved
                    </button>
                  ) : st === "skipped" ? (
                    <button onClick={() => onApproval(row.rowKey, "approved")} className="flex items-center gap-1 text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 hover:bg-slate-200">
                      <X className="w-3 h-3" /> Skipped
                    </button>
                  ) : (
                    <button onClick={() => onApproval(row.rowKey, "approved")} className="flex items-center gap-1 text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 hover:bg-blue-100">
                      Approve?
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 font-medium text-slate-800">{row.player?.name}</td>
                <td className="px-3 py-2 text-slate-500">{row.team?.name || "—"}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">{user?.full_name || "—"}</div>
                  <div className="text-slate-400">{user?.email}</div>
                </td>
                <td className="px-3 py-2 text-slate-500">{row.sourceTeam?.name || "—"}</td>
                <td className="px-3 py-2">
                  <Badge className={row.confidence === "high" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                    {row.confidence}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-slate-400">{row.reason}</td>
                <td className="px-3 py-2">
                  {needsReview && (
                    <Button size="sm" variant="outline" className="h-6 text-xs gap-1 text-blue-600 border-blue-200" onClick={() => onOpenModal(user)}>
                      <Link2 className="w-3 h-3" /> Fix
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UnmatchedTable({ rows, onOpenModal, allUsers }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-white/60">
          <tr>
            {["Target Player", "Team", "Reason", ""].map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/80">
          {rows.map(row => (
            <tr key={row.rowKey} className="bg-white">
              <td className="px-3 py-2 font-medium text-slate-800">{row.player?.name}</td>
              <td className="px-3 py-2 text-slate-500">{row.team?.name || "—"}</td>
              <td className="px-3 py-2 text-slate-400">{row.reason}</td>
              <td className="px-3 py-2">
                <Button size="sm" variant="outline" className="h-6 text-xs gap-1 text-slate-600" onClick={() => {
                  // Try to find a user by matching player name
                  const candidate = allUsers.find(u => (u.display_name || "").toLowerCase().includes((row.player?.name || "").toLowerCase()));
                  if (candidate) onOpenModal(candidate);
                  else alert("No user candidate found. Search manually using Match Leagues button below.");
                }}>
                  <Link2 className="w-3 h-3" /> Manual Fix
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConflictTable({ rows, onOpenModal, allUsers }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-white/60">
          <tr>
            {["Target Player", "Team", "Conflicting Users", "Reason", ""].map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/80">
          {rows.map(row => (
            <tr key={row.rowKey} className="bg-red-50">
              <td className="px-3 py-2 font-medium text-slate-800">{row.player?.name}</td>
              <td className="px-3 py-2 text-slate-500">{row.team?.name || "—"}</td>
              <td className="px-3 py-2">
                {(row.users || []).map(u => (
                  <div key={u.id} className="text-slate-700">{u.full_name} <span className="text-slate-400">({u.email})</span></div>
                ))}
                {row.existingUser && <div className="text-red-600 mt-1">Currently linked: {row.existingUser.full_name}</div>}
              </td>
              <td className="px-3 py-2 text-red-600">{row.reason}</td>
              <td className="px-3 py-2">
                <Button size="sm" variant="outline" className="h-6 text-xs gap-1 text-red-600 border-red-200" onClick={() => {
                  const u = row.users?.[0];
                  if (u) onOpenModal(u);
                }}>
                  <Link2 className="w-3 h-3" /> Resolve
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
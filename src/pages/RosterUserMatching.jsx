import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Key, Link2, AlertTriangle, CheckCircle2, HelpCircle, XCircle, Eye, Check, X, Search } from "lucide-react";

const normalize = (str) => (str || "").trim().toLowerCase().replace(/\s+/g, " ");

function calcConfidence(targetPlayer, sourceIdentity, sourceTeams, targetTeams) {
  const nameMatch = normalize(targetPlayer.name) === normalize(sourceIdentity.matched_player_name);
  if (!nameMatch) return null;
  const sourceTeam = sourceTeams.find(t => t.id === sourceIdentity.team_id);
  const targetTeam = targetTeams.find(t => t.id === targetPlayer.team_id);
  if (sourceTeam && targetTeam && normalize(sourceTeam.name) === normalize(targetTeam.name)) return "high";
  return "medium";
}

// Row approval statuses: "approved" | "skipped" | "pending"
export default function RosterUserMatching() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [targetLeagueId, setTargetLeagueId] = useState("");
  const [sourceLeagueId, setSourceLeagueId] = useState("");
  const [previewRows, setPreviewRows] = useState(null); // null = not yet previewed
  const [approvalState, setApprovalState] = useState({}); // rowIndex -> "approved"|"skipped"|"pending"
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchOverride, setSearchOverride] = useState({}); // rowIndex -> search query
  const [userSearchResults, setUserSearchResults] = useState({}); // rowIndex -> [users]
  const [overrideUser, setOverrideUser] = useState({}); // rowIndex -> user object

  useEffect(() => {
    base44.auth.me().then(u => { setCurrentUser(u); setUserLoaded(true); }).catch(() => setUserLoaded(true));
  }, []);

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
    enabled: currentUser?.user_type === "app_admin",
  });

  const { data: allTeams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list("-created_date", 2000),
    enabled: currentUser?.user_type === "app_admin",
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsersForMatching"],
    queryFn: () => base44.entities.User.list("-created_date", 2000),
    enabled: currentUser?.user_type === "app_admin",
  });

  if (!userLoaded) return null;

  if (currentUser?.user_type !== "app_admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center max-w-md">
          <Key className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">This tool is restricted to app owners only.</p>
        </div>
      </div>
    );
  }

  const targetLeague = leagues.find(l => l.id === targetLeagueId);
  const sourceLeague = leagues.find(l => l.id === sourceLeagueId);

  const runPreview = async () => {
    if (!targetLeagueId || !sourceLeagueId) return;
    setIsPreviewing(true);
    setPreviewRows(null);
    setApprovalState({});
    setSearchOverride({});
    setUserSearchResults({});
    setOverrideUser({});

    try {
      const targetTeams = allTeams.filter(t => t.league_id === targetLeagueId);
      const sourceTeams = allTeams.filter(t => t.league_id === sourceLeagueId);

      const [targetPlayers, sourceIdentities] = await Promise.all([
        base44.entities.Player.filter(
          { team_id: { $in: targetTeams.map(t => t.id) } },
          "-created_date", 2000
        ),
        base44.entities.UserLeagueIdentity.filter({ league_id: sourceLeagueId }, "-created_date", 2000),
      ]);

      const rows = [];
      const newApprovalState = {};

      for (const player of targetPlayers) {
        const team = targetTeams.find(t => t.id === player.team_id);
        const nameMatches = sourceIdentities.filter(
          id => normalize(id.matched_player_name) === normalize(player.name)
        );

        if (nameMatches.length === 0) {
          rows.push({ player, team, status: "unmatched", identity: null, user: null, confidence: null, reason: "No name match in source league", sourceTeam: null });
          newApprovalState[rows.length - 1] = "skipped";
          continue;
        }

        let bestIdentity = null;
        let bestConfidence = null;
        for (const identity of nameMatches) {
          const conf = calcConfidence(player, identity, sourceTeams, targetTeams);
          if (conf === "high") { bestIdentity = identity; bestConfidence = "high"; break; }
          if (conf === "medium" && !bestIdentity) { bestIdentity = identity; bestConfidence = "medium"; }
        }

        const user = bestIdentity ? allUsers.find(u => u.id === bestIdentity.user_id) : null;
        const sourceTeam = bestIdentity ? sourceTeams.find(t => t.id === bestIdentity.team_id) : null;

        if (bestConfidence === "high") {
          rows.push({ player, team, status: "auto_matched", identity: bestIdentity, user, sourceTeam, confidence: "high", reason: "Exact name + matching team name" });
          newApprovalState[rows.length - 1] = "approved";
        } else if (bestConfidence === "medium") {
          rows.push({ player, team, status: "needs_review", identity: bestIdentity, user, sourceTeam, confidence: "medium", reason: "Exact name, team name differs" });
          newApprovalState[rows.length - 1] = "pending";
        } else {
          rows.push({ player, team, status: "unmatched", identity: null, user: null, confidence: null, reason: "Name found but no valid match context", sourceTeam: null });
          newApprovalState[rows.length - 1] = "skipped";
        }
      }

      setPreviewRows(rows);
      setApprovalState(newApprovalState);
    } finally {
      setIsPreviewing(false);
    }
  };

  const setRowApproval = (idx, val) => setApprovalState(s => ({ ...s, [idx]: val }));

  const searchUsers = (idx, query) => {
    setSearchOverride(s => ({ ...s, [idx]: query }));
    if (!query.trim()) { setUserSearchResults(s => ({ ...s, [idx]: [] })); return; }
    const q = normalize(query);
    const results = allUsers.filter(u =>
      normalize(u.full_name).includes(q) || normalize(u.email).includes(q)
    ).slice(0, 8);
    setUserSearchResults(s => ({ ...s, [idx]: results }));
  };

  const selectOverrideUser = (idx, user) => {
    setOverrideUser(s => ({ ...s, [idx]: user }));
    setSearchOverride(s => ({ ...s, [idx]: "" }));
    setUserSearchResults(s => ({ ...s, [idx]: [] }));
    setRowApproval(idx, "approved");
  };

  const getEffectiveUser = (idx, row) => overrideUser[idx] || row.user;

  const approvedCount = previewRows ? previewRows.filter((_, i) => approvalState[i] === "approved").length : 0;
  const skippedCount = previewRows ? previewRows.filter((_, i) => approvalState[i] === "skipped").length : 0;

  const applyApproved = async () => {
    const toApply = previewRows
      .map((row, idx) => ({ ...row, idx }))
      .filter(r => approvalState[r.idx] === "approved");

    if (!toApply.length) { alert("No approved matches to apply."); return; }
    if (!confirm(`You are about to apply ${toApply.length} approved match(es) to the target league. Continue?`)) return;

    setIsSaving(true);
    try {
      for (const match of toApply) {
        const user = getEffectiveUser(match.idx, match);
        if (!user) continue;

        const identity = overrideUser[match.idx] ? null : match.identity;

        const existingIdentities = await base44.entities.UserLeagueIdentity.filter({
          user_id: user.id, league_id: targetLeagueId
        });

        const identityData = {
          user_id: user.id,
          league_id: targetLeagueId,
          team_id: match.team?.id || null,
          matched_player_name: match.player.name,
          matched_player_id: match.player.id,
          match_status: "matched",
          match_confidence: match.confidence || "medium",
          match_method: overrideUser[match.idx] ? "manual_admin" : "normalized_name",
          matched_at: new Date().toISOString(),
          matched_by: currentUser.email,
        };

        if (existingIdentities.length > 0) {
          await base44.entities.UserLeagueIdentity.update(existingIdentities[0].id, identityData);
        } else {
          await base44.entities.UserLeagueIdentity.create(identityData);
        }

        const existingLeagueIds = user.assigned_league_ids || [];
        if (!existingLeagueIds.includes(targetLeagueId)) {
          await base44.entities.User.update(user.id, {
            assigned_league_ids: [...existingLeagueIds, targetLeagueId],
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["userLeagueIdentities"] });
      queryClient.invalidateQueries({ queryKey: ["allUsersForMatching"] });
      alert(`Successfully applied ${toApply.length} match(es) to ${targetLeague?.name}.`);
      setPreviewRows(null);
      setApprovalState({});
    } catch (err) {
      alert("Error applying matches: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const autoMatchedRows = previewRows?.map((r, i) => ({ ...r, idx: i })).filter(r => r.status === "auto_matched") || [];
  const reviewRows = previewRows?.map((r, i) => ({ ...r, idx: i })).filter(r => r.status === "needs_review") || [];
  const unmatchedRows = previewRows?.map((r, i) => ({ ...r, idx: i })).filter(r => r.status === "unmatched") || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link2 className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900">Roster User Matching</h1>
          </div>
          <p className="text-slate-600">Preview proposed matches, approve them individually, then apply in one step.</p>
        </div>

        {/* Config card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <strong>Safety Notice:</strong> This tool will only use identities from the selected source league. No changes are saved until you click <strong>Apply Approved Matches</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">Target League <span className="text-red-500">*</span></label>
              <p className="text-xs text-slate-500 mb-2">The new league that needs player-user assignments</p>
              <Select value={targetLeagueId} onValueChange={v => { setTargetLeagueId(v); setPreviewRows(null); }}>
                <SelectTrigger><SelectValue placeholder="Select target league" /></SelectTrigger>
                <SelectContent>
                  {leagues.filter(l => l.id !== sourceLeagueId).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name} ({l.season})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">Source League <span className="text-red-500">*</span></label>
              <p className="text-xs text-slate-500 mb-2">Existing league where those players already played</p>
              <Select value={sourceLeagueId} onValueChange={v => { setSourceLeagueId(v); setPreviewRows(null); }}>
                <SelectTrigger><SelectValue placeholder="Select source league" /></SelectTrigger>
                <SelectContent>
                  {leagues.filter(l => l.id !== targetLeagueId).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name} ({l.season})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={runPreview}
              disabled={!targetLeagueId || !sourceLeagueId || isPreviewing}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              {isPreviewing ? "Calculating..." : "Preview Matches"}
            </Button>
            <p className="text-xs text-slate-400 italic">Preview only. No changes are saved until you click Apply Approved Matches.</p>
          </div>
        </div>

        {/* Preview results */}
        {previewRows && (
          <div className="space-y-6">
            {/* Summary bar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-bold text-slate-900 mb-4">Preview Summary — {targetLeague?.name}</h2>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center text-sm mb-5">
                {[
                  { label: "Total Players", val: previewRows.length, cls: "bg-slate-50 text-slate-700" },
                  { label: "Auto Matched", val: autoMatchedRows.length, cls: "bg-green-50 text-green-800" },
                  { label: "Needs Review", val: reviewRows.length, cls: "bg-yellow-50 text-yellow-800" },
                  { label: "Unmatched", val: unmatchedRows.length, cls: "bg-slate-100 text-slate-600" },
                  { label: "Approved", val: approvedCount, cls: "bg-blue-50 text-blue-800 font-bold" },
                  { label: "Skipped", val: skippedCount, cls: "bg-slate-50 text-slate-500" },
                ].map(s => (
                  <div key={s.label} className={`rounded-lg border p-3 ${s.cls}`}>
                    <div className="text-2xl font-bold">{s.val}</div>
                    <div className="text-xs mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={applyApproved}
                  disabled={approvedCount === 0 || isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {isSaving ? "Applying..." : `Apply ${approvedCount} Approved Match${approvedCount !== 1 ? "es" : ""}`}
                </Button>
                {approvedCount === 0 && (
                  <p className="text-xs text-slate-400">Approve at least one match to enable this button.</p>
                )}
              </div>
            </div>

            {/* Auto-matched section */}
            {autoMatchedRows.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    Auto Matched ({autoMatchedRows.length})
                    <span className="text-xs font-normal text-slate-400 ml-1">— pre-approved, editable below</span>
                  </h2>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => autoMatchedRows.forEach(r => setRowApproval(r.idx, "approved"))}>Select All</Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => autoMatchedRows.forEach(r => setRowApproval(r.idx, "skipped"))}>Skip All</Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Approval", "Target Team", "Target Player", "Matched User", "Source Team", "Source Name", "Reason"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {autoMatchedRows.map(row => (
                        <tr key={row.idx} className={approvalState[row.idx] === "approved" ? "bg-green-50" : "bg-white hover:bg-slate-50"}>
                          <td className="px-4 py-3">
                            <ApprovalToggle value={approvalState[row.idx]} onChange={v => setRowApproval(row.idx, v)} />
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.team?.name || "—"}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{row.player?.name}</td>
                          <td className="px-4 py-3">
                            <UserCell user={getEffectiveUser(row.idx, row)} />
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.sourceTeam?.name || "—"}</td>
                          <td className="px-4 py-3 text-slate-600">{row.identity?.matched_player_name || "—"}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Needs review section */}
            {reviewRows.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h2 className="font-bold text-slate-900 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-yellow-600" />
                    Needs Review ({reviewRows.length})
                    <span className="text-xs font-normal text-slate-400 ml-1">— not pre-approved, review each row</span>
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Approval", "Target Team", "Target Player", "Suggested User", "Source Team", "Source Name", "Reason / Action"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reviewRows.map(row => (
                        <tr key={row.idx} className={
                          approvalState[row.idx] === "approved" ? "bg-green-50" :
                          approvalState[row.idx] === "skipped" ? "bg-slate-50 opacity-60" :
                          "bg-white hover:bg-slate-50"
                        }>
                          <td className="px-4 py-3">
                            <ApprovalToggle value={approvalState[row.idx]} onChange={v => setRowApproval(row.idx, v)} />
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.team?.name || "—"}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{row.player?.name}</td>
                          <td className="px-4 py-3">
                            {overrideUser[row.idx] ? (
                              <div className="flex items-center gap-2">
                                <UserCell user={overrideUser[row.idx]} />
                                <button className="text-xs text-red-400 hover:text-red-600" onClick={() => { setOverrideUser(s => { const n = {...s}; delete n[row.idx]; return n; }); setRowApproval(row.idx, "pending"); }}>
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <UserCell user={row.user} />
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.sourceTeam?.name || "—"}</td>
                          <td className="px-4 py-3 text-slate-600">{row.identity?.matched_player_name || "—"}</td>
                          <td className="px-4 py-3">
                            <UserSearchInline
                              idx={row.idx}
                              searchQuery={searchOverride[row.idx] || ""}
                              searchResults={userSearchResults[row.idx] || []}
                              onSearch={(q) => searchUsers(row.idx, q)}
                              onSelect={(u) => selectOverrideUser(row.idx, u)}
                              reason={row.reason}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Unmatched section */}
            {unmatchedRows.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h2 className="font-bold text-slate-900 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-slate-400" />
                    Unmatched ({unmatchedRows.length})
                    <span className="text-xs font-normal text-slate-400 ml-1">— no identity found in source league</span>
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Approval", "Target Team", "Target Player", "Assign User", "Reason"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {unmatchedRows.map(row => (
                        <tr key={row.idx} className={
                          approvalState[row.idx] === "approved" ? "bg-green-50" : "bg-white hover:bg-slate-50"
                        }>
                          <td className="px-4 py-3">
                            <ApprovalToggle value={approvalState[row.idx]} onChange={v => setRowApproval(row.idx, v)} disabled={!overrideUser[row.idx]} />
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.team?.name || "—"}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{row.player?.name}</td>
                          <td className="px-4 py-3">
                            {overrideUser[row.idx] ? (
                              <div className="flex items-center gap-2">
                                <UserCell user={overrideUser[row.idx]} />
                                <button className="text-xs text-red-400 hover:text-red-600" onClick={() => { setOverrideUser(s => { const n = {...s}; delete n[row.idx]; return n; }); setRowApproval(row.idx, "skipped"); }}>
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <UserSearchInline
                                idx={row.idx}
                                searchQuery={searchOverride[row.idx] || ""}
                                searchResults={userSearchResults[row.idx] || []}
                                onSearch={(q) => searchUsers(row.idx, q)}
                                onSelect={(u) => selectOverrideUser(row.idx, u)}
                                reason={null}
                                placeholder="Search user to assign..."
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bottom apply button */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
              <Button
                onClick={applyApproved}
                disabled={approvedCount === 0 || isSaving}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {isSaving ? "Applying..." : `Apply ${approvedCount} Approved Match${approvedCount !== 1 ? "es" : ""}`}
              </Button>
              <p className="text-xs text-slate-400 italic">
                Only approved rows will be saved. Skipped and unmatched rows are not affected.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ApprovalToggle({ value, onChange, disabled }) {
  if (value === "approved") {
    return (
      <button
        onClick={() => !disabled && onChange("skipped")}
        className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 border border-green-300 rounded-full px-2.5 py-1 hover:bg-green-200 transition-colors"
      >
        <Check className="w-3 h-3" /> Approved
      </button>
    );
  }
  if (value === "skipped") {
    return (
      <button
        onClick={() => !disabled && onChange("approved")}
        disabled={disabled}
        className="flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1 hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <X className="w-3 h-3" /> Skipped
      </button>
    );
  }
  // pending
  return (
    <button
      onClick={() => !disabled && onChange("approved")}
      disabled={disabled}
      className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1 hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <HelpCircle className="w-3 h-3" /> Approve?
    </button>
  );
}

function UserCell({ user }) {
  if (!user) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <div>
      <div className="font-medium text-slate-800 text-xs">{user.full_name}</div>
      <div className="text-slate-400 text-xs">{user.email}</div>
    </div>
  );
}

function UserSearchInline({ idx, searchQuery, searchResults, onSearch, onSelect, reason, placeholder }) {
  return (
    <div className="space-y-1">
      {reason && <p className="text-xs text-slate-400">{reason}</p>}
      <div className="relative">
        <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          placeholder={placeholder || "Search another user..."}
          className="h-7 text-xs pl-6 w-44"
        />
      </div>
      {searchResults.length > 0 && (
        <div className="absolute z-10 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto w-64">
          {searchResults.map(u => (
            <button
              key={u.id}
              onClick={() => onSelect(u)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-slate-100 last:border-0"
            >
              <div className="font-medium text-slate-800">{u.full_name}</div>
              <div className="text-slate-400">{u.email}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
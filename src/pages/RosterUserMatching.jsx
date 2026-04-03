import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Key, Link2, AlertTriangle, CheckCircle2, HelpCircle, XCircle } from "lucide-react";

const normalize = (str) => (str || "").trim().toLowerCase().replace(/\s+/g, " ");

function getConfidence(targetPlayer, sourceIdentity, sourceTeams, targetTeams) {
  const nameMatch = normalize(targetPlayer.name) === normalize(sourceIdentity.matched_player_name);
  if (!nameMatch) return null;

  // Boost confidence if teams appear to correspond
  const sourceTeam = sourceTeams.find(t => t.id === sourceIdentity.team_id);
  const targetTeam = targetTeams.find(t => t.id === targetPlayer.team_id);
  if (sourceTeam && targetTeam && normalize(sourceTeam.name) === normalize(targetTeam.name)) {
    return "high";
  }
  return "medium";
}

export default function RosterUserMatching() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [targetLeagueId, setTargetLeagueId] = useState("");
  const [sourceLeagueId, setSourceLeagueId] = useState("");
  const [results, setResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
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

  const runMatching = async () => {
    if (!targetLeagueId || !sourceLeagueId) return;
    setIsRunning(true);
    setResults(null);

    try {
      const [targetPlayers, sourceIdentities] = await Promise.all([
        base44.entities.Player.filter({ team_id: { $in: allTeams.filter(t => t.league_id === targetLeagueId).map(t => t.id) } }, "-created_date", 2000),
        base44.entities.UserLeagueIdentity.filter({ league_id: sourceLeagueId }, "-created_date", 2000),
      ]);

      const sourceTeams = allTeams.filter(t => t.league_id === sourceLeagueId);
      const targetTeams = allTeams.filter(t => t.league_id === targetLeagueId);

      const matchResults = [];

      for (const player of targetPlayers) {
        const team = targetTeams.find(t => t.id === player.team_id);

        // Find all source identities with a normalized name match
        const nameMatches = sourceIdentities.filter(identity =>
          normalize(identity.matched_player_name) === normalize(player.name)
        );

        if (nameMatches.length === 0) {
          matchResults.push({ player, team, status: "unmatched", identity: null, user: null, confidence: null, reason: "No name match in source league" });
          continue;
        }

        // Pick best match
        let bestIdentity = null;
        let bestConfidence = null;

        for (const identity of nameMatches) {
          const conf = getConfidence(player, identity, sourceTeams, targetTeams);
          if (conf === "high") { bestIdentity = identity; bestConfidence = "high"; break; }
          if (conf === "medium" && !bestIdentity) { bestIdentity = identity; bestConfidence = "medium"; }
        }

        if (!bestIdentity) {
          matchResults.push({ player, team, status: "unmatched", identity: null, user: null, confidence: null, reason: "Name found but no valid match context" });
          continue;
        }

        const user = allUsers.find(u => u.id === bestIdentity.user_id);
        const sourceTeam = sourceTeams.find(t => t.id === bestIdentity.team_id);

        if (bestConfidence === "high") {
          matchResults.push({ player, team, status: "auto_matched", identity: bestIdentity, user, sourceTeam, confidence: "high", reason: "Exact name + matching team name" });
        } else {
          matchResults.push({ player, team, status: "needs_review", identity: bestIdentity, user, sourceTeam, confidence: "medium", reason: "Exact name, team name differs" });
        }
      }

      setResults(matchResults);
    } finally {
      setIsRunning(false);
    }
  };

  const applyMatches = async (toApply) => {
    if (!toApply.length) return;
    if (!confirm(`Apply ${toApply.length} match(es) to the target league? This will create/update UserLeagueIdentity records and update user league assignments.`)) return;
    setIsSaving(true);
    try {
      for (const match of toApply) {
        const { player, team, identity, user } = match;
        if (!user || !identity) continue;

        // Check existing identity for target league
        const existingIdentities = await base44.entities.UserLeagueIdentity.filter({ user_id: user.id, league_id: targetLeagueId });

        const identityData = {
          user_id: user.id,
          league_id: targetLeagueId,
          team_id: team?.id || null,
          matched_player_name: player.name,
          matched_player_id: player.id,
          match_status: "matched",
          match_confidence: match.confidence,
          match_method: "normalized_name",
          matched_at: new Date().toISOString(),
          matched_by: currentUser.email,
        };

        if (existingIdentities.length > 0) {
          await base44.entities.UserLeagueIdentity.update(existingIdentities[0].id, identityData);
        } else {
          await base44.entities.UserLeagueIdentity.create(identityData);
        }

        // Add target league to user's assigned_league_ids if not already there
        const existingLeagueIds = user.assigned_league_ids || [];
        if (!existingLeagueIds.includes(targetLeagueId)) {
          await base44.entities.User.update(user.id, {
            assigned_league_ids: [...existingLeagueIds, targetLeagueId],
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["userLeagueIdentities"] });
      queryClient.invalidateQueries({ queryKey: ["allUsersForMatching"] });

      alert(`Successfully applied ${toApply.length} match(es).`);
      setResults(null);
    } catch (err) {
      alert("Error applying matches: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const autoMatched = results?.filter(r => r.status === "auto_matched") || [];
  const needsReview = results?.filter(r => r.status === "needs_review") || [];
  const unmatched = results?.filter(r => r.status === "unmatched") || [];

  const StatusBadge = ({ status, confidence }) => {
    if (status === "auto_matched") return <Badge className="bg-green-100 text-green-800 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Auto Match ({confidence})</Badge>;
    if (status === "needs_review") return <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1"><HelpCircle className="w-3 h-3" />Review ({confidence})</Badge>;
    return <Badge className="bg-slate-100 text-slate-600 flex items-center gap-1"><XCircle className="w-3 h-3" />Unmatched</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link2 className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900">Roster User Matching</h1>
          </div>
          <p className="text-slate-600">Safely auto-link existing users to a new league using identities from one selected source league only.</p>
        </div>

        {/* Config card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <strong>Safety Notice:</strong> This tool will only use identities from the selected source league. It will not search across all leagues automatically. No changes are applied until you confirm.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">Target League <span className="text-red-500">*</span></label>
              <p className="text-xs text-slate-500 mb-2">The new league that needs player-user assignments</p>
              <Select value={targetLeagueId} onValueChange={v => { setTargetLeagueId(v); setResults(null); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target league" />
                </SelectTrigger>
                <SelectContent>
                  {leagues.filter(l => l.id !== sourceLeagueId).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name} ({l.season})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">Source League <span className="text-red-500">*</span></label>
              <p className="text-xs text-slate-500 mb-2">Existing league where those players already played</p>
              <Select value={sourceLeagueId} onValueChange={v => { setSourceLeagueId(v); setResults(null); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source league" />
                </SelectTrigger>
                <SelectContent>
                  {leagues.filter(l => l.id !== targetLeagueId).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name} ({l.season})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={runMatching}
            disabled={!targetLeagueId || !sourceLeagueId || isRunning}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isRunning ? "Running..." : "Run Matching"}
          </Button>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Auto Matched", count: autoMatched.length, color: "bg-green-50 border-green-200 text-green-800" },
                { label: "Needs Review", count: needsReview.length, color: "bg-yellow-50 border-yellow-200 text-yellow-800" },
                { label: "Unmatched", count: unmatched.length, color: "bg-slate-50 border-slate-200 text-slate-700" },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border p-4 text-center ${s.color}`}>
                  <div className="text-3xl font-bold">{s.count}</div>
                  <div className="text-sm font-medium mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Auto matched table */}
            {autoMatched.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="font-bold text-slate-900 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-600" />Auto Matched ({autoMatched.length})</h2>
                  <Button
                    onClick={() => applyMatches(autoMatched)}
                    disabled={isSaving}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm"
                    size="sm"
                  >
                    {isSaving ? "Applying..." : `Apply ${autoMatched.length} Auto Match(es)`}
                  </Button>
                </div>
                <ResultTable rows={autoMatched} sourceLeague={sourceLeague} targetLeague={targetLeague} />
              </div>
            )}

            {/* Needs review table */}
            {needsReview.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="font-bold text-slate-900 flex items-center gap-2"><HelpCircle className="w-5 h-5 text-yellow-600" />Needs Review ({needsReview.length})</h2>
                  <Button
                    onClick={() => applyMatches(needsReview)}
                    disabled={isSaving}
                    variant="outline"
                    className="text-yellow-700 border-yellow-300 hover:bg-yellow-50 text-sm"
                    size="sm"
                  >
                    Apply Review Matches
                  </Button>
                </div>
                <ResultTable rows={needsReview} sourceLeague={sourceLeague} targetLeague={targetLeague} />
              </div>
            )}

            {/* Unmatched */}
            {unmatched.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h2 className="font-bold text-slate-900 flex items-center gap-2"><XCircle className="w-5 h-5 text-slate-500" />Unmatched ({unmatched.length})</h2>
                  <p className="text-xs text-slate-500 mt-1">These players have no matching identity in the source league. Assign them manually.</p>
                </div>
                <ResultTable rows={unmatched} sourceLeague={sourceLeague} targetLeague={targetLeague} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultTable({ rows, sourceLeague, targetLeague }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Target Player</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Target Team</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Matched User</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Source Roster Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Source Team</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">{row.player?.name}</td>
              <td className="px-4 py-3 text-slate-600">{row.team?.name || "—"}</td>
              <td className="px-4 py-3">
                {row.user ? (
                  <div>
                    <div className="font-medium text-slate-800">{row.user.full_name}</div>
                    <div className="text-xs text-slate-400">{row.user.email}</div>
                  </div>
                ) : <span className="text-slate-300">—</span>}
              </td>
              <td className="px-4 py-3 text-slate-600">{row.identity?.matched_player_name || "—"}</td>
              <td className="px-4 py-3 text-slate-600">{row.sourceTeam?.name || "—"}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
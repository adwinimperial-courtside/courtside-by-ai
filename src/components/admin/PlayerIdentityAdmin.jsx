import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, User } from "lucide-react";

// Heuristic: does a name look like a real full name (vs a username)?
function looksLikeRealName(name) {
  if (!name || typeof name !== "string") return false;
  const t = name.trim();
  // Must have a space, no underscores, digits, or common username chars
  return t.includes(" ") && !/[_\d@#$%^&*]/.test(t);
}

const STATUS_COLORS = {
  completed: "bg-green-100 text-green-800",
  missing: "bg-yellow-100 text-yellow-800",
};

const ROLE_COLORS = {
  player: "bg-green-100 text-green-800",
  coach: "bg-blue-100 text-blue-800",
  league_admin: "bg-yellow-100 text-yellow-800",
  viewer: "bg-purple-100 text-purple-800",
};

export default function PlayerIdentityAdmin() {
  const [roleFilter, setRoleFilter] = useState("player");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isRepairing, setIsRepairing] = useState(false);
  const queryClient = useQueryClient();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["all_applications_identity", roleFilter],
    queryFn: () => {
      const query = roleFilter !== "all" ? { requested_role: roleFilter } : {};
      return base44.entities.UserApplication.filter(query, "-created_date", 1000);
    },
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
  });

  const filtered = applications.filter(app => {
    if (statusFilter === "missing_display_name") return !app.display_name;
    if (statusFilter === "needs_review") return app.player_name_status === "missing";
    if (statusFilter === "completed") return app.player_name_status === "completed";
    return true;
  });

  const getLeagueNames = (app) => {
    const ids = app.league_ids?.length ? app.league_ids : app.league_id ? [app.league_id] : [];
    return ids.map(id => leagues.find(l => l.id === id)?.name || id).join(", ") || "—";
  };

  const formatDate = (val) => {
    const d = val ? new Date(val) : null;
    return d && !isNaN(d) ? d.toLocaleDateString() : "—";
  };

  // One-time repair: set player_name_status='missing' and prefill display_name/handle
  // based on whether user_name looks like a real name or a username.
  // Only runs on player applications where status is NOT already 'completed'.
  const handleRepair = async () => {
    const targets = applications.filter(
      a => a.requested_role === "player" && a.player_name_status !== "completed"
    );
    if (!confirm(
      `Run player identity repair on ${targets.length} player application(s)?\n\n` +
      `• Sets player_name_status = "missing"\n` +
      `• Prefills display_name if name looks like a real name\n` +
      `• Prefills handle if name looks like a username\n` +
      `• Never overwrites existing display_name or handle values`
    )) return;

    setIsRepairing(true);
    try {
      let count = 0;
      for (const app of targets) {
        const name = (app.user_name || "").trim();
        const updates = { player_name_status: "missing" };

        // Only prefill if not already set
        if (!app.display_name && !app.handle && name) {
          if (looksLikeRealName(name)) {
            updates.display_name = name;
          } else {
            updates.handle = name;
          }
        }
        await base44.entities.UserApplication.update(app.id, updates);
        count++;
      }
      queryClient.invalidateQueries({ queryKey: ["all_applications_identity"] });
      alert(`✅ Repaired ${count} player application(s).`);
    } catch (err) {
      alert("Repair failed: " + err.message);
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <User className="w-5 h-5 text-green-600" />
              Player Identity Management
            </CardTitle>
            <p className="text-sm text-slate-600 mt-1">
              Manage display names and identity for player accounts
            </p>
          </div>
          <Button
            onClick={handleRepair}
            disabled={isRepairing}
            variant="outline"
            className="text-green-700 border-green-300 hover:bg-green-50"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRepairing ? "animate-spin" : ""}`} />
            {isRepairing ? "Running Repair…" : "Run Identity Repair"}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-4 items-center">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="player">Player</SelectItem>
              <SelectItem value="coach">Coach</SelectItem>
              <SelectItem value="league_admin">League Admin</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-52 h-8 text-sm">
              <SelectValue placeholder="Player Name Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="missing_display_name">Missing Display Name</SelectItem>
              <SelectItem value="needs_review">Needs Review (missing)</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-sm text-slate-400">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <p className="text-center text-slate-500 py-10">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-500 py-10">No records match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  {[
                    "Signup Name",
                    "Display Name",
                    "Handle",
                    "Role",
                    "Email",
                    "Created On",
                    "Assigned Leagues",
                    "Player Name Status",
                  ].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(app => (
                  <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                    {/* Signup Name */}
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                      {app.user_name || <span className="text-slate-300 italic">—</span>}
                    </td>

                    {/* Display Name */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {app.display_name ? (
                        <span className="text-slate-800">{app.display_name}</span>
                      ) : (
                        <span className="text-slate-300 italic">not set</span>
                      )}
                    </td>

                    {/* Handle */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {app.handle ? (
                        <span className="text-slate-500">@{app.handle}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={ROLE_COLORS[app.requested_role] || "bg-slate-100 text-slate-600"}
                      >
                        {app.requested_role || "—"}
                      </Badge>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {app.user_email || "—"}
                    </td>

                    {/* Created On */}
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(app.applied_at || app.created_date)}
                    </td>

                    {/* Assigned Leagues */}
                    <td className="px-4 py-3 text-slate-600 max-w-[200px]">
                      <span className="block truncate" title={getLeagueNames(app)}>
                        {getLeagueNames(app)}
                      </span>
                    </td>

                    {/* Player Name Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {app.requested_role === "player" ? (
                        <Badge
                          className={
                            STATUS_COLORS[app.player_name_status] ||
                            "bg-slate-100 text-slate-500"
                          }
                        >
                          {app.player_name_status || "not set"}
                        </Badge>
                      ) : (
                        <span className="text-slate-300 text-xs">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
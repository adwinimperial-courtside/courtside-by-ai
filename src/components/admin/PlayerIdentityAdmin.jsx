import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RefreshCw, User, Pencil, Check, X, Link2 } from "lucide-react";
import PlayerLeagueMatchModal from "@/components/admin/PlayerLeagueMatchModal";

function looksLikeRealName(name) {
  if (!name || typeof name !== "string") return false;
  const t = name.trim();
  return t.includes(" ") && !/[_\d@#$%^&*]/.test(t);
}

const STATUS_COLORS = {
  completed: "bg-green-100 text-green-800",
  missing: "bg-yellow-100 text-yellow-800",
};

export default function PlayerIdentityAdmin() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [isRepairing, setIsRepairing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [matchingPlayer, setMatchingPlayer] = useState(null);
  const queryClient = useQueryClient();

  const { data: players = [], isLoading } = useQuery({
    queryKey: ["player_users"],
    queryFn: () => base44.entities.User.filter({ user_type: "player" }, "-created_date", 1000),
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list("-created_date", 1000),
  });

  const filtered = players.filter(p => {
    if (statusFilter === "missing_display_name") return !p.display_name;
    if (statusFilter === "needs_review") return p.player_name_status === "missing";
    if (statusFilter === "completed") return p.player_name_status === "completed";
    return true;
  });

  const getLeagueTeamLabel = (player) => {
    const pairs = player.league_team_pairs || [];
    if (!pairs.length) {
      const leagueIds = player.assigned_league_ids || [];
      if (!leagueIds.length) return "—";
      return leagueIds.map(id => leagues.find(l => l.id === id)?.name || id).join(", ");
    }
    return pairs.map(pair => {
      const league = leagues.find(l => l.id === pair.league_id);
      const team = teams.find(t => t.id === pair.team_id);
      return [league?.name, team?.name].filter(Boolean).join(" / ") || pair.league_id;
    }).join("; ");
  };

  const formatDate = (val) => {
    const d = val ? new Date(val) : null;
    return d && !isNaN(d) ? d.toLocaleDateString() : "—";
  };

  const startEdit = (player) => {
    setEditingId(player.id);
    setEditValues({
      display_name: player.display_name || "",
      handle: player.handle || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async (player) => {
    const updates = {
      display_name: editValues.display_name.trim(),
      handle: editValues.handle.trim(),
      player_name_status: editValues.display_name.trim() ? "completed" : "missing",
    };
    await base44.auth.updateMe ? null : null; // no-op placeholder
    await base44.entities.User.update(player.id, updates);
    queryClient.invalidateQueries({ queryKey: ["player_users"] });
    setEditingId(null);
    setEditValues({});
  };

  // Repair: set player_name_status on all players who haven't completed it
  const handleRepair = async () => {
    const targets = players.filter(p => p.player_name_status !== "completed");
    if (!confirm(
      `Run identity repair on ${targets.length} player(s)?\n\n` +
      `• Sets player_name_status = "missing" if no display_name\n` +
      `• Sets player_name_status = "completed" if display_name already set\n` +
      `• Prefills display_name from full_name if it looks like a real name\n` +
      `• Never overwrites existing display_name or handle values`
    )) return;

    setIsRepairing(true);
    try {
      for (const p of targets) {
        const updates = {};
        if (!p.display_name && p.full_name) {
          if (looksLikeRealName(p.full_name)) {
            updates.display_name = p.full_name.trim();
            updates.player_name_status = "completed";
          } else {
            if (!p.handle) updates.handle = p.full_name.trim();
            updates.player_name_status = "missing";
          }
        } else if (p.display_name) {
          updates.player_name_status = "completed";
        } else {
          updates.player_name_status = "missing";
        }
        await base44.entities.User.update(p.id, updates);
      }
      queryClient.invalidateQueries({ queryKey: ["player_users"] });
      alert(`✅ Repaired ${targets.length} player(s).`);
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
              All users with player role — {players.length} total
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

        <div className="flex flex-wrap gap-2 mt-4 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-52 h-8 text-sm">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="missing_display_name">Missing Display Name</SelectItem>
              <SelectItem value="needs_review">Needs Review</SelectItem>
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
                  {["Full Name", "Display Name", "Handle", "Email", "Joined", "League / Team", "Status", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(player => {
                  const isEditing = editingId === player.id;
                  return (
                    <tr key={player.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                        {player.full_name || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing ? (
                          <Input
                            value={editValues.display_name}
                            onChange={e => setEditValues(v => ({ ...v, display_name: e.target.value }))}
                            className="h-7 text-sm w-36"
                            placeholder="Display name"
                          />
                        ) : player.display_name ? (
                          <span className="text-slate-800">{player.display_name}</span>
                        ) : (
                          <span className="text-slate-300 italic">not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing ? (
                          <Input
                            value={editValues.handle}
                            onChange={e => setEditValues(v => ({ ...v, handle: e.target.value }))}
                            className="h-7 text-sm w-28"
                            placeholder="Handle"
                          />
                        ) : player.handle ? (
                          <span className="text-slate-500">@{player.handle}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {player.email || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDate(player.created_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[200px]">
                        <span className="block truncate" title={getLeagueTeamLabel(player)}>
                          {getLeagueTeamLabel(player)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className={STATUS_COLORS[player.player_name_status] || "bg-slate-100 text-slate-500"}>
                          {player.player_name_status || "not set"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => saveEdit(player)}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400" onClick={cancelEdit}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-slate-700" onClick={() => startEdit(player)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
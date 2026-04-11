import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RefreshCw, User, ChevronRight } from "lucide-react";
import BulkIdentityMatching from "@/components/admin/BulkIdentityMatching";
import PlayerIdentityDetailPanel from "@/components/admin/PlayerIdentityDetailPanel";

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
  const [nameSearch, setNameSearch] = useState("");
  const [isRepairing, setIsRepairing] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const queryClient = useQueryClient();

  const { data: players = [], isLoading } = useQuery({
    queryKey: ["player_users"],
    queryFn: async () => {
      const [playerUsers, coachUsers] = await Promise.all([
        base44.entities.User.filter({ user_type: "player" }, "-created_date", 1000),
        base44.entities.User.filter({ user_type: "coach" }, "-created_date", 1000),
      ]);
      return [...playerUsers, ...coachUsers];
    },
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list("-created_date", 1000),
  });

  const { data: identities = [] } = useQuery({
    queryKey: ["userLeagueIdentities"],
    queryFn: () => base44.entities.UserLeagueIdentity.list("-created_date", 5000),
  });

  const filtered = players.filter(p => {
    if (statusFilter === "missing_display_name" && p.display_name) return false;
    if (statusFilter === "needs_review" && p.player_name_status !== "missing") return false;
    if (statusFilter === "completed" && p.player_name_status !== "completed") return false;
    if (nameSearch.trim()) {
      const q = nameSearch.trim().toLowerCase();
      const matchName = (p.full_name || "").toLowerCase().includes(q);
      const matchDisplay = (p.display_name || "").toLowerCase().includes(q);
      const matchEmail = (p.email || "").toLowerCase().includes(q);
      if (!matchName && !matchDisplay && !matchEmail) return false;
    }
    return true;
  });

  const getLeagueTeamLabel = (player) => {
    const pairs = player.league_team_pairs || [];
    if (!pairs.length) {
      const leagueIds = player.assigned_league_ids || [];
      if (!leagueIds.length) return "None";
      return leagueIds.map(id => leagues.find(l => l.id === id)?.name || id).join(", ");
    }
    return pairs.map(pair => {
      const league = leagues.find(l => l.id === pair.league_id);
      const team = teams.find(t => t.id === pair.team_id);
      return [league?.name, team?.name].filter(Boolean).join(" / ") || pair.league_id;
    }).join("; ");
  };

  const getMatchStatus = (player) => {
    const leagueIds = player.assigned_league_ids || [];
    if (!leagueIds.length) return { label: "No Leagues", color: "bg-slate-100 text-slate-700" };
    
    const playerIdentities = identities.filter(i => i.user_id === player.id && leagueIds.includes(i.league_id));
    if (!playerIdentities.length) return { label: "No Leagues", color: "bg-slate-100 text-slate-700" };
    
    const matched = playerIdentities.filter(i => i.match_status === "matched").length;
    const total = playerIdentities.length;
    
    if (matched === total) return { label: "All Matched", color: "bg-green-100 text-green-800" };
    if (matched === 0) return { label: "Not Matched", color: "bg-red-100 text-red-800" };
    return { label: `${matched}/${total} Matched`, color: "bg-yellow-100 text-yellow-800" };
  };

  const formatDate = (val) => {
    const d = val ? new Date(val) : null;
    return d && !isNaN(d) ? d.toLocaleDateString() : "";
  };



  const handleRepair = async () => {
    const targets = players.filter(p => p.player_name_status !== "completed");
    if (!confirm(`Run identity repair on ${targets.length} player(s)?`)) return;
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
      alert(`Repaired ${targets.length} player(s).`);
    } catch (err) {
      alert("Repair failed: " + err.message);
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div>
      <BulkIdentityMatching leagues={leagues} allUsers={players} />

      {selectedPlayer && (
        <PlayerIdentityDetailPanel
          player={selectedPlayer}
          leagues={leagues}
          teams={teams}
          identities={identities}
          onClose={() => setSelectedPlayer(null)}
          onSaved={() => setSelectedPlayer(null)}
        />
      )}

      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <User className="w-5 h-5 text-green-600" />
                Identity Management
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Players and coaches &mdash; {players.length} total
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
              {isRepairing ? "Running Repair..." : "Run Identity Repair"}
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
            <Input
              value={nameSearch}
              onChange={e => setNameSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="h-8 text-sm w-56"
            />
            <span className="text-sm text-slate-400">
              {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center text-slate-500 py-10">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-500 py-10">No records match the current filters.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map(player => {
                const matchStatus = getMatchStatus(player);
                const hasDisplayName = !!player.display_name;
                return (
                  <button
                    key={player.id}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                    onClick={() => setSelectedPlayer(player)}
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm flex-shrink-0">
                      {(player.full_name || player.email || "?")[0].toUpperCase()}
                    </div>

                    {/* Name block */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm truncate">
                          {player.full_name || <span className="text-slate-400 italic">No name</span>}
                        </span>
                        {player.display_name && (
                          <span className="text-xs text-slate-500 truncate">({player.display_name})</span>
                        )}
                        {player.handle && (
                          <span className="text-xs text-slate-400">@{player.handle}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{player.email}</p>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={`text-xs ${STATUS_COLORS[player.player_name_status] || "bg-slate-100 text-slate-500"}`}>
                        {player.player_name_status || "not set"}
                      </Badge>
                      <Badge className={`text-xs ${matchStatus.color}`}>
                        {matchStatus.label}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
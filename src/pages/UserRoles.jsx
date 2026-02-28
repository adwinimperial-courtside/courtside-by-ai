import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users, Eye, Key, Search, ArrowUpDown, BarChart3 } from "lucide-react";

const TABS = ["overview", "league_owners", "coaches", "players", "viewers"];
const TAB_LABELS = {
  overview: "Overview",
  league_owners: "League Owners",
  coaches: "Coaches",
  players: "Players",
  viewers: "Viewers",
};
const TAB_USER_TYPE = {
  league_owners: "league_admin",
  coaches: "coach",
  players: "player",
  viewers: "viewer",
};

function UserTable({ users, leagues, emptyMessage }) {
  const [sortConfig, setSortConfig] = useState({ key: "created_date", direction: "desc" });

  const sorted = useMemo(() => {
    const arr = [...users];
    arr.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (sortConfig.key === "created_date") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else {
        aVal = (aVal || "").toLowerCase();
        bVal = (bVal || "").toLowerCase();
      }
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [users, sortConfig]);

  const handleSort = (key) =>
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

  const getLeagueNames = (leagueIds) => {
    if (!leagueIds || leagueIds.length === 0) return "None";
    return leagueIds
      .map((id) => leagues.find((l) => l.id === id)?.name || "Unknown")
      .join(", ");
  };

  const SortBtn = ({ col }) => (
    <button onClick={() => handleSort(col)} className="flex items-center gap-1 font-semibold hover:text-slate-900">
      {col === "full_name" ? "Name" : col === "email" ? "Email" : "Created On"}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead><SortBtn col="full_name" /></TableHead>
            <TableHead><SortBtn col="email" /></TableHead>
            <TableHead><SortBtn col="created_date" /></TableHead>
            <TableHead>Assigned Leagues</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length > 0 ? (
            sorted.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell className="text-slate-600">{user.email}</TableCell>
                <TableCell className="text-slate-600">{new Date(user.created_date).toLocaleDateString()}</TableCell>
                <TableCell className="text-slate-600">{getLeagueNames(user.assigned_league_ids)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-slate-500">{emptyMessage}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function UserRoles() {
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ["user"],
    queryFn: () => base44.auth.me(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
    enabled: currentUser?.user_type === "app_admin",
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
    enabled: currentUser?.user_type === "app_admin",
  });

  if (currentUser && currentUser.user_type !== "app_admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center max-w-md">
          <Key className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const counts = {
    league_owners: users.filter((u) => u.user_type === "league_admin").length,
    coaches: users.filter((u) => u.user_type === "coach").length,
    players: users.filter((u) => u.user_type === "player").length,
    viewers: users.filter((u) => u.user_type === "viewer").length,
  };
  const totalUsers = counts.league_owners + counts.coaches + counts.players + counts.viewers;

  // Users per league
  const usersPerLeague = useMemo(() => {
    return leagues
      .map((league) => {
        const leagueUsers = users.filter(
          (u) =>
            u.assigned_league_ids?.includes(league.id) &&
            ["league_admin", "coach", "player", "viewer"].includes(u.user_type)
        );
        return {
          id: league.id,
          name: league.name,
          total: leagueUsers.length,
          owners: leagueUsers.filter((u) => u.user_type === "league_admin").length,
          coaches: leagueUsers.filter((u) => u.user_type === "coach").length,
          players: leagueUsers.filter((u) => u.user_type === "player").length,
          viewers: leagueUsers.filter((u) => u.user_type === "viewer").length,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [leagues, users]);

  // Filtered users for role tabs
  const roleUsers = useMemo(() => {
    if (activeTab === "overview") return [];
    const userType = TAB_USER_TYPE[activeTab];
    const filtered = users.filter((u) => u.user_type === userType);
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [users, activeTab, search]);

  const kpiCards = [
    { label: "League Owners", count: counts.league_owners, color: "bg-purple-50 border-purple-200", textColor: "text-purple-700", tab: "league_owners" },
    { label: "Coaches", count: counts.coaches, color: "bg-green-50 border-green-200", textColor: "text-green-700", tab: "coaches" },
    { label: "Players", count: counts.players, color: "bg-indigo-50 border-indigo-200", textColor: "text-indigo-700", tab: "players" },
    { label: "Viewers", count: counts.viewers, color: "bg-blue-50 border-blue-200", textColor: "text-blue-700", tab: "viewers" },
  ];

  const tabBadgeColor = {
    league_owners: "bg-purple-500",
    coaches: "bg-green-500",
    players: "bg-indigo-500",
    viewers: "bg-blue-500",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">User Roles</h1>
            <p className="text-slate-600 text-sm">Manage and view users by role</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSearch(""); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                activeTab === tab
                  ? "bg-slate-900 text-white shadow"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {TAB_LABELS[tab]}
              {tab !== "overview" && counts[tab] > 0 && (
                <span className={`${activeTab === tab ? "bg-white/20" : tabBadgeColor[tab]} text-white text-xs px-1.5 py-0.5 rounded-full font-semibold`}>
                  {counts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search (role tabs only) */}
        {activeTab !== "overview" && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={`Search ${TAB_LABELS[activeTab]}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {kpiCards.map((kpi) => (
                <button
                  key={kpi.tab}
                  onClick={() => setActiveTab(kpi.tab)}
                  className={`${kpi.color} border-2 rounded-xl p-4 text-center hover:opacity-80 transition-opacity cursor-pointer`}
                >
                  <div className={`text-3xl font-bold ${kpi.textColor}`}>{kpi.count}</div>
                  <div className="text-sm text-slate-600 mt-1">{kpi.label}</div>
                </button>
              ))}
              <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-slate-900">{totalUsers}</div>
                <div className="text-sm text-slate-600 mt-1">Total Users</div>
              </div>
            </div>

            {/* Users per League */}
            <Card className="border-slate-200 shadow-lg">
              <CardHeader className="border-b border-slate-200 bg-slate-50">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-slate-600" />
                  Users per League
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="pl-6">League</TableHead>
                        <TableHead className="text-center">Owners</TableHead>
                        <TableHead className="text-center">Coaches</TableHead>
                        <TableHead className="text-center">Players</TableHead>
                        <TableHead className="text-center">Viewers</TableHead>
                        <TableHead className="text-center font-bold pr-6">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersPerLeague.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium pl-6">{row.name}</TableCell>
                          <TableCell className="text-center text-purple-700 font-semibold">{row.owners || "—"}</TableCell>
                          <TableCell className="text-center text-green-700 font-semibold">{row.coaches || "—"}</TableCell>
                          <TableCell className="text-center text-indigo-700 font-semibold">{row.players || "—"}</TableCell>
                          <TableCell className="text-center text-blue-700 font-semibold">{row.viewers || "—"}</TableCell>
                          <TableCell className="text-center font-bold text-slate-900 pr-6">
                            <Badge className="bg-slate-100 text-slate-800">{row.total}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {usersPerLeague.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-slate-500">No leagues found</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ROLE TABS */}
        {activeTab !== "overview" && (
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="border-b border-slate-200 bg-white">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{TAB_LABELS[activeTab]}</CardTitle>
                <Badge className="bg-slate-100 text-slate-800 text-base px-3 py-1">
                  {roleUsers.length} {search ? "found" : "total"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <UserTable
                users={roleUsers}
                leagues={leagues}
                emptyMessage={search ? `No ${TAB_LABELS[activeTab].toLowerCase()} match your search` : `No ${TAB_LABELS[activeTab].toLowerCase()} found`}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
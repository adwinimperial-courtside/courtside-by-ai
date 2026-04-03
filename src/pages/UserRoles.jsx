import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Key, Users, Search, ArrowUpDown, BarChart3, ChevronDown, ChevronRight, ArrowDown } from "lucide-react";

const TABS = ["overview", "by_team", "league_owners", "coaches", "players", "viewers"];
const TAB_LABELS = {
  overview: "Overview",
  by_team: "By League & Team",
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

function MobileUserCard({ user, leagues }) {
  const getLeagueNames = (leagueIds) => {
    if (!leagueIds || leagueIds.length === 0) return null;
    return leagueIds.map((id) => leagues.find((l) => l.id === id)?.name || "Unknown").join(", ");
  };
  const leagueNames = getLeagueNames(user.assigned_league_ids);

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0">
      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-sm font-semibold text-slate-600">
          {(user.full_name || "?")[0].toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 text-sm truncate">{user.full_name || "—"}</div>
        <div className="text-xs text-slate-500 truncate">{user.email}</div>
        {leagueNames && (
          <div className="text-xs text-slate-400 mt-0.5 truncate">{leagueNames}</div>
        )}
      </div>
      <div className="text-xs text-slate-400 flex-shrink-0 mt-1">
        {new Date(user.created_date).toLocaleDateString()}
      </div>
    </div>
  );
}

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
    return leagueIds.map((id) => leagues.find((l) => l.id === id)?.name || "Unknown").join(", ");
  };

  const SortBtn = ({ col }) => {
    const isActive = sortConfig.key === col;
    const label = col === "full_name" ? "Name" : col === "email" ? "Email" : "Created On";
    return (
      <button onClick={() => handleSort(col)} className="flex items-center gap-1 font-semibold hover:text-slate-900">
        {label}
        {isActive ? (
          <ArrowDown className={`w-3 h-3 transition-transform ${sortConfig.direction === "asc" ? "rotate-180" : ""}`} />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
        )}
        {col === "created_date" && isActive && sortConfig.direction === "desc" && (
          <span className="text-xs font-normal text-slate-400 ml-1">(newest)</span>
        )}
      </button>
    );
  };

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

function MobileLeagueRow({ row }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="font-medium text-slate-900 text-sm max-w-[65%] leading-snug">{row.name}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge className="bg-slate-800 text-white text-xs">{row.total}</Badge>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-2">
          <div className="bg-purple-50 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-purple-700">{row.owners}</div>
            <div className="text-xs text-slate-500">Owners</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-green-700">{row.coaches}</div>
            <div className="text-xs text-slate-500">Coaches</div>
          </div>
          <div className="bg-indigo-50 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-indigo-700">{row.players}</div>
            <div className="text-xs text-slate-500">Players</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-blue-700">{row.viewers}</div>
            <div className="text-xs text-slate-500">Viewers</div>
          </div>
        </div>
      )}
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
    queryKey: ["userRolesPageUsers"],
    queryFn: () => base44.entities.User.list('-created_date', 500),
    enabled: currentUser?.user_type === "app_admin",
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
    enabled: currentUser?.user_type === "app_admin",
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list("-created_date", 1000),
    enabled: currentUser?.user_type === "app_admin",
  });

  const { data: identities = [] } = useQuery({
    queryKey: ["userLeagueIdentities"],
    queryFn: () => base44.entities.UserLeagueIdentity.list("-created_date", 5000),
    enabled: currentUser?.user_type === "app_admin",
  });

  const byTeamData = useMemo(() => {
    return leagues.map(league => {
      const leagueTeams = teams.filter(t => t.league_id === league.id);
      const leagueIdentities = identities.filter(i => i.league_id === league.id && i.match_status === 'matched');
      const leagueUsers = users.filter(u =>
        u.assigned_league_ids?.includes(league.id) &&
        ['league_admin', 'coach', 'player', 'viewer'].includes(u.user_type)
      );

      const teamRows = leagueTeams.map(team => {
        const teamIdentities = leagueIdentities.filter(i => i.team_id === team.id);
        const teamUsers = teamIdentities
          .map(i => {
            const user = users.find(u => u.id === i.user_id);
            return user ? { ...user, matched_player_name: i.matched_player_name } : null;
          })
          .filter(Boolean);
        // also add coaches/admins assigned to this league (no team match needed)
        return { team, users: teamUsers };
      });

      // unassigned = users in league but no identity match to a team
      const matchedUserIds = new Set(leagueIdentities.map(i => i.user_id));
      const unassigned = leagueUsers.filter(u => u.user_type !== 'player' || !matchedUserIds.has(u.id));

      return { league, teamRows, unassigned, leagueUsers };
    }).filter(l => l.leagueUsers.length > 0 || l.teamRows.some(t => t.users.length > 0));
  }, [leagues, teams, identities, users]);

  const counts = {
    league_owners: users.filter((u) => u.user_type === "league_admin").length,
    coaches: users.filter((u) => u.user_type === "coach").length,
    players: users.filter((u) => u.user_type === "player").length,
    viewers: users.filter((u) => u.user_type === "viewer").length,
  };
  const totalUsers = users.length;

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

  // Sort by created_date DESC (newest first) by default
  const roleUsers = useMemo(() => {
    if (activeTab === "overview") return [];
    const userType = TAB_USER_TYPE[activeTab];
    let filtered = users.filter((u) => u.user_type === userType);
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort(
      (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
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

  const getMobileSelectLabel = (tab) => {
    if (tab === "overview" || tab === "by_team") return TAB_LABELS[tab];
    const count = counts[tab];
    return `${TAB_LABELS[tab]}${count > 0 ? ` (${count})` : ""}`;
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">User Roles</h1>
            <p className="text-slate-600 text-sm">Manage and view users by role</p>
          </div>
        </div>

        {/* MOBILE: Dropdown selector */}
        <div className="md:hidden mb-6 w-full">
          <Select
            value={activeTab}
            onValueChange={(val) => { setActiveTab(val); setSearch(""); }}
          >
            <SelectTrigger className="w-full bg-white border-slate-200 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABS.map((tab) => (
                <SelectItem key={tab} value={tab}>
                  {getMobileSelectLabel(tab)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* DESKTOP: Tab strip */}
        <div className="hidden md:flex mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-1 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSearch(""); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 whitespace-nowrap ${
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

            {/* Mobile compact KPI rows */}
            <div className="md:hidden bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {kpiCards.map((kpi, i) => (
                <button
                  key={kpi.tab}
                  onClick={() => setActiveTab(kpi.tab)}
                  className={`w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors ${i < kpiCards.length - 1 ? "border-b border-slate-100" : ""}`}
                >
                  <span className="text-sm font-medium text-slate-700">{kpi.label}</span>
                  <span className={`text-lg font-bold ${kpi.textColor}`}>{kpi.count}</span>
                </button>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
                <span className="text-sm font-semibold text-slate-700">Total Users</span>
                <span className="text-lg font-bold text-slate-900">{totalUsers}</span>
              </div>
            </div>

            {/* Desktop KPI grid */}
            <div className="hidden md:grid md:grid-cols-5 gap-4">
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

              {/* Mobile: expandable rows */}
              <div className="md:hidden">
                {usersPerLeague.length > 0 ? (
                  usersPerLeague.map((row) => <MobileLeagueRow key={row.id} row={row} />)
                ) : (
                  <div className="text-center py-8 text-slate-500 text-sm">No leagues found</div>
                )}
              </div>

              {/* Desktop: full table */}
              <CardContent className="hidden md:block pt-4 p-0">
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

        {/* BY LEAGUE & TEAM TAB */}
        {activeTab === "by_team" && (
          <div className="space-y-6">
            {byTeamData.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500">No data yet</div>
            ) : byTeamData.map(({ league, teamRows, unassigned }) => (
              <Card key={league.id} className="border-slate-200 shadow-lg">
                <CardHeader className="border-b border-slate-200 bg-slate-50">
                  <CardTitle className="text-lg">{league.name} <span className="text-slate-400 font-normal text-sm ml-1">{league.season}</span></CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {teamRows.filter(t => t.users.length > 0).map(({ team, users: teamUsers }) => (
                    <div key={team.id} className="border-b border-slate-100 last:border-b-0">
                      <div className="flex items-center gap-2 px-5 py-2 bg-white">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: team.color || '#f97316' }} />
                        <span className="font-semibold text-slate-800 text-sm">{team.name}</span>
                        <Badge className="bg-slate-100 text-slate-600 text-xs ml-auto">{teamUsers.length}</Badge>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="pl-8">Player Name</TableHead>
                              <TableHead>Account Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Role</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {teamUsers.map(user => (
                              <TableRow key={user.id}>
                                <TableCell className="pl-8 font-medium text-slate-800">{user.matched_player_name || '—'}</TableCell>
                                <TableCell className="text-slate-600">{user.full_name}</TableCell>
                                <TableCell className="text-slate-500 text-xs">{user.email}</TableCell>
                                <TableCell>
                                  <Badge className={{
                                    player: 'bg-indigo-100 text-indigo-800',
                                    coach: 'bg-green-100 text-green-800',
                                    league_admin: 'bg-purple-100 text-purple-800',
                                    viewer: 'bg-blue-100 text-blue-800',
                                  }[user.user_type] || 'bg-slate-100 text-slate-700'}>
                                    {user.user_type?.replace('_', ' ')}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                  {unassigned.filter(u => u.user_type !== 'player').length > 0 && (
                    <div className="border-t border-slate-200">
                      <div className="px-5 py-2 bg-slate-50">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">League-level (no team)</span>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableBody>
                            {unassigned.filter(u => u.user_type !== 'player').map(user => (
                              <TableRow key={user.id}>
                                <TableCell className="pl-8 font-medium text-slate-800">{user.full_name}</TableCell>
                                <TableCell className="text-slate-500 text-xs">{user.email}</TableCell>
                                <TableCell>
                                  <Badge className={{
                                    coach: 'bg-green-100 text-green-800',
                                    league_admin: 'bg-purple-100 text-purple-800',
                                    viewer: 'bg-blue-100 text-blue-800',
                                  }[user.user_type] || 'bg-slate-100 text-slate-700'}>
                                    {user.user_type?.replace('_', ' ')}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ROLE TABS */}
        {activeTab !== "overview" && activeTab !== "by_team" && (
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="border-b border-slate-200 bg-white">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{TAB_LABELS[activeTab]}</CardTitle>
                <Badge className="bg-slate-100 text-slate-800 text-base px-3 py-1">
                  {roleUsers.length} {search ? "found" : "total"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 md:pt-6 p-0 md:p-6">
              {/* Mobile: compact cards */}
              <div className="md:hidden">
                {roleUsers.length > 0 ? (
                  roleUsers.map((user) => (
                    <MobileUserCard key={user.id} user={user} leagues={leagues} />
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    {search ? `No ${TAB_LABELS[activeTab].toLowerCase()} match your search` : `No ${TAB_LABELS[activeTab].toLowerCase()} found`}
                  </div>
                )}
              </div>
              {/* Desktop: table */}
              <div className="hidden md:block">
                <UserTable
                  users={roleUsers}
                  leagues={leagues}
                  emptyMessage={search ? `No ${TAB_LABELS[activeTab].toLowerCase()} match your search` : `No ${TAB_LABELS[activeTab].toLowerCase()} found`}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
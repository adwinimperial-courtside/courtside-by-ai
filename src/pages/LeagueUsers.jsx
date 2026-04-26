import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, ChevronDown, ChevronUp } from "lucide-react";

const ROLE_COLORS = {
  player: "bg-blue-100 text-blue-800",
  coach: "bg-green-100 text-green-800",
  league_admin: "bg-purple-100 text-purple-800",
  viewer: "bg-slate-100 text-slate-700",
};

const ROLE_LABELS = {
  player: "Player",
  coach: "Coach",
  league_admin: "League Admin",
  viewer: "Viewer",
};

function UserRow({ user, teams, leagues, adminLeagueIds, userLeagueIdentities = [], selectedLeague, userApplications = [] }) {
  const [expanded, setExpanded] = useState(false);

  // Get this user's league identities filtered to leagues the admin manages
  const relevantLeagueIds = (user.assigned_league_ids || []).filter(id => adminLeagueIds.includes(id));

  // For player/coach: show their team within each relevant league
  const leagueDetails = relevantLeagueIds.map(lid => {
    const league = leagues.find(l => l.id === lid);
    return { league, leagueId: lid };
  });

  // Determine the effective role: use per-league role from ULI when a specific league is selected,
  // otherwise use the most "specific" role across all relevant leagues (prefer player/coach over viewer)
  const getEffectiveRole = () => {
    if (selectedLeague && selectedLeague !== "all") {
      const uli = userLeagueIdentities.find(u => u.league_id === selectedLeague && u.role);
      return uli?.role || user.user_type;
    }
    // No league filter: find most specific role across all identities
    const rolePriority = ["league_admin", "coach", "player", "viewer"];
    const roles = userLeagueIdentities.filter(u => u.role).map(u => u.role);
    for (const r of rolePriority) {
      if (roles.includes(r)) return r;
    }
    return user.user_type;
  };
  const effectiveRole = getEffectiveRole();

  // For players: find their primary matched player name and team
  const isPlayer = effectiveRole === "player";
  const primaryIdentity = userLeagueIdentities.find(uli => uli.matched_player_name);
  const playerDisplayName = primaryIdentity?.matched_player_name || user.display_name || null;
  const playerTeamId = primaryIdentity?.team_id || (user.league_team_pairs?.[0]?.team_id);
  const playerTeam = playerTeamId ? teams.find(t => t.id === playerTeamId) : null;

  return (
    <div className="border-b border-slate-100 last:border-0">
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {(() => {
          const app = userApplications.find(a => a.user_id === user.id && a.user_name);
          const fullNameLooksReal = user.full_name && user.full_name.includes(" ");
          const primaryName = fullNameLooksReal ? user.full_name : (app?.user_name || user.full_name || "—");
          const secondaryName = user.display_name && user.display_name !== primaryName ? user.display_name : null;
          const avatarLetter = (isPlayer && playerDisplayName ? playerDisplayName : primaryName)?.charAt(0)?.toUpperCase() || "?";
          return (
            <>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-semibold text-sm flex-shrink-0">
                {avatarLetter}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {isPlayer && playerDisplayName ? playerDisplayName : primaryName}
                </p>
                {secondaryName && (
                  <p className="text-xs text-slate-400 truncate">{secondaryName}</p>
                )}
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
          {isPlayer && playerTeam && (
            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-medium mt-0.5">
              {playerTeam.name}
            </span>
          )}
              </div>
            </>
          );
        })()}
        <Badge className={`${ROLE_COLORS[effectiveRole] || "bg-slate-100 text-slate-600"} text-xs flex-shrink-0`}>
          {ROLE_LABELS[effectiveRole] || effectiveRole}
        </Badge>
        <div className="text-slate-400 flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 bg-slate-50/60">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Assigned Leagues</p>
          {leagueDetails.length === 0 ? (
            <p className="text-sm text-slate-400">No leagues assigned</p>
          ) : (
            <div className="space-y-1">
              {leagueDetails.map(({ league, leagueId }) => {
                const leagueTeams = teams.filter(t => t.league_id === leagueId);
                return (
                  <div key={leagueId} className="flex items-center gap-2 text-sm">
                    <span className="text-slate-700 font-medium">{league?.name || "Unknown League"}</span>
                    {league?.season && <span className="text-slate-400 text-xs">({league.season})</span>}
                  </div>
                );
              })}
            </div>
          )}
          {(user.user_type === "player" || user.user_type === "coach") && user.display_name && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Display Name</p>
              <p className="text-sm text-slate-700">{user.display_name}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LeagueUsers() {
  const [search, setSearch] = useState("");
  const [selectedLeague, setSelectedLeague] = useState("all");
  const [selectedRole, setSelectedRole] = useState("all");

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const isAppAdmin = currentUser?.user_type === 'app_admin';
  const isLeagueAdmin = currentUser?.user_type === 'league_admin';
  const adminLeagueIds = currentUser?.assigned_league_ids || [];

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['leagueUsersPage'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getLeagueUsers', {});
      return res.data.users || [];
    },
    enabled: isAppAdmin || isLeagueAdmin,
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ['allLeagues'],
    queryFn: () => base44.entities.League.list(),
    enabled: isAppAdmin || isLeagueAdmin,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['allTeams'],
    queryFn: () => base44.entities.Team.list(),
    enabled: isAppAdmin || isLeagueAdmin,
  });

  const { data: userLeagueIdentities = [] } = useQuery({
    queryKey: ['allUserLeagueIdentities'],
    queryFn: () => base44.entities.UserLeagueIdentity.list(),
    enabled: isAppAdmin || isLeagueAdmin,
  });

  const { data: userApplications = [] } = useQuery({
    queryKey: ['allUserApplications'],
    queryFn: () => base44.entities.UserApplication.list(),
    enabled: isAppAdmin || isLeagueAdmin,
  });

  if (currentUser && !isAppAdmin && !isLeagueAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
          <Users className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  // Which leagues are visible to this admin
  const visibleLeagues = isAppAdmin
    ? leagues
    : leagues.filter(l => adminLeagueIds.includes(l.id));

  // Filter users: only those assigned to at least one of the admin's leagues, exclude app_admins
  const relevantUsers = allUsers.filter(u => {
    if (u.user_type === 'app_admin') return false;
    const userLeagues = u.assigned_league_ids || [];
    const targetIds = isAppAdmin ? leagues.map(l => l.id) : adminLeagueIds;
    return userLeagues.some(id => targetIds.includes(id));
  });

  // Apply filters
  const filtered = relevantUsers.filter(u => {
    const matchSearch = !search.trim() ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());

    const userULIs = userLeagueIdentities.filter(uli => uli.user_id === u.id);

    const matchRole = selectedRole === "all" || (() => {
      if (selectedLeague && selectedLeague !== "all") {
        const uli = userULIs.find(x => x.league_id === selectedLeague && x.role);
        return (uli?.role || u.user_type) === selectedRole;
      }
      return userULIs.some(x => x.role === selectedRole) || u.user_type === selectedRole;
    })();

    const matchLeague = selectedLeague === "all" ||
      (u.assigned_league_ids || []).includes(selectedLeague);

    return matchSearch && matchRole && matchLeague;
  });

  const sorted = [...filtered].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

  const roleCounts = filtered.reduce((acc, u) => {
    acc[u.user_type] = (acc[u.user_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">League Users</h1>
            <p className="text-slate-500 text-sm">
              {isAppAdmin ? "All leagues" : `${visibleLeagues.length} league${visibleLeagues.length !== 1 ? 's' : ''} you manage`}
            </p>
          </div>
        </div>

        {/* Role summary chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(roleCounts).map(([role, count]) => (
            <div key={role} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[role] || 'bg-slate-100 text-slate-600'}`}>
              {ROLE_LABELS[role] || role}: {count}
            </div>
          ))}
          {Object.keys(roleCounts).length === 0 && !isLoading && (
            <span className="text-sm text-slate-400">No users found</span>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-white shadow-sm"
            />
          </div>
          <Select value={selectedLeague} onValueChange={setSelectedLeague}>
            <SelectTrigger className="w-full sm:w-48 bg-white shadow-sm">
              <SelectValue placeholder="All Leagues" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Leagues</SelectItem>
              {[...visibleLeagues].sort((a, b) => a.name.localeCompare(b.name)).map(l => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-full sm:w-40 bg-white shadow-sm">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="player">Player</SelectItem>
              <SelectItem value="coach">Coach</SelectItem>
              <SelectItem value="league_admin">League Admin</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* User list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No users found{search ? ` for "${search}"` : ''}.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {sorted.map(user => (
              <UserRow
                key={user.id}
                user={user}
                teams={teams}
                leagues={leagues}
                adminLeagueIds={isAppAdmin ? leagues.map(l => l.id) : adminLeagueIds}
                userLeagueIdentities={userLeagueIdentities.filter(uli => uli.user_id === user.id)}
                selectedLeague={selectedLeague}
                userApplications={userApplications.filter(a => a.user_id === user.id)}
              />
            ))}
            <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
              {sorted.length} user{sorted.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
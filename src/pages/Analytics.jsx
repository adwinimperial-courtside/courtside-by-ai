import React, { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Key, TrendingUp, Users, Clock, Search, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const ROLE_LABELS = {
  league_admin: "League Owner",
  coach: "Coach",
  player: "Player",
  viewer: "Viewer",
};

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function RoleBadge({ role }) {
  const colors = {
    league_admin: "bg-purple-100 text-purple-700",
    coach: "bg-green-100 text-green-700",
    player: "bg-indigo-100 text-indigo-700",
    viewer: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[role] || "bg-slate-100 text-slate-600"}`}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

export default function Analytics() {
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
    staleTime: 10 * 60000, // 10 minutes
  });

  const { data: todayData, isLoading: loadingToday, refetch: refetchToday } = useQuery({
    queryKey: ["analytics_today"],
    queryFn: () => base44.functions.invoke("getLoginAnalytics", { action: "today" }).then(r => r.data),
    enabled: currentUser?.role === "admin",
    refetchInterval: 60000,
    staleTime: 30000, // 30 seconds
  });

  const { data: dailyData, isLoading: loadingDaily } = useQuery({
    queryKey: ["analytics_daily"],
    queryFn: () => base44.functions.invoke("getLoginAnalytics", { action: "daily_active" }).then(r => r.data),
    enabled: currentUser?.role === "admin",
    staleTime: 5 * 60000, // 5 minutes
  });

  const { data: searchData, isLoading: loadingSearch } = useQuery({
    queryKey: ["analytics_search_users", userSearch],
    queryFn: () => base44.functions.invoke("getLoginAnalytics", { action: "search_users", query: userSearch }).then(r => r.data),
    enabled: currentUser?.role === "admin" && userSearch.length >= 1,
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ["analytics_history", selectedUser?.email],
    queryFn: () => base44.functions.invoke("getLoginAnalytics", { action: "user_history", email: selectedUser?.email }).then(r => r.data),
    enabled: !!selectedUser?.email && currentUser?.role === "admin",
  });

  if (currentUser && currentUser.role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center max-w-md">
          <Key className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">This page is only accessible to app administrators.</p>
        </div>
      </div>
    );
  }

  const logins = todayData?.logins || [];
  const dailyRows = dailyData?.rows || [];
  const searchUsers = searchData?.users || [];
  const historyEvents = historyData?.events || [];

  const todayTotal = logins.length;
  const todayUnique = new Set(logins.map(l => l.email)).size;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6 overflow-x-hidden">
      <div className="max-w-5xl mx-auto w-full space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Analytics</h1>
              <p className="text-slate-600 text-sm">Login activity & user engagement</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchToday()} className="gap-2 text-slate-600">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>

        {/* Today summary KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-orange-600">{todayTotal}</div>
              <div className="text-xs text-slate-500 mt-1">Logins Today</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-indigo-600">{todayUnique}</div>
              <div className="text-xs text-slate-500 mt-1">Unique Users Today</div>
            </CardContent>
          </Card>
        </div>

        {/* Section A: Logins Today */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-5 h-5 text-orange-500" />
              Logins Today
              {todayTotal > 0 && <Badge className="bg-orange-100 text-orange-700 ml-1">{todayTotal}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingToday ? (
              <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>
            ) : logins.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">No logins recorded today yet</div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-slate-500 text-xs">
                        <th className="px-4 py-2.5 font-semibold">Time</th>
                        <th className="px-4 py-2.5 font-semibold">Full Name</th>
                        <th className="px-4 py-2.5 font-semibold">Email</th>
                        <th className="px-4 py-2.5 font-semibold">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logins.map((l, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-mono text-slate-700">{formatTime(l.time)}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">{l.full_name || "—"}</td>
                          <td className="px-4 py-2.5 text-slate-600">{l.email}</td>
                          <td className="px-4 py-2.5"><RoleBadge role={l.user_type} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile list */}
                <div className="md:hidden divide-y divide-slate-100">
                  {logins.map((l, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="text-xs font-mono text-slate-400 w-12 flex-shrink-0">{formatTime(l.time)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 text-sm truncate">{l.full_name || l.email}</div>
                        <div className="text-xs text-slate-500 truncate">{l.email}</div>
                      </div>
                      <RoleBadge role={l.user_type} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Section B: Daily Active Users (Last 14 days) */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Daily Active Users — Last 14 Days
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingDaily ? (
              <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-slate-500 text-xs">
                        <th className="px-4 py-2.5 font-semibold">Date</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Unique Users</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Total Logins</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyRows.map((row) => (
                        <tr key={row.date} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-700">{formatDate(row.date + "T12:00:00Z")}</td>
                          <td className="px-4 py-2.5 text-right">
                            {row.unique_users > 0 ? (
                              <span className="font-bold text-indigo-600">{row.unique_users}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {row.total_logins > 0 ? (
                              <span className="font-bold text-slate-700">{row.total_logins}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile list */}
                <div className="md:hidden divide-y divide-slate-100">
                  {dailyRows.map((row) => (
                    <div key={row.date} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-slate-700">{formatDate(row.date + "T12:00:00Z")}</span>
                      <div className="flex items-center gap-4 text-right">
                        <div className="text-xs text-slate-400">
                          <div className="font-bold text-indigo-600 text-sm">{row.unique_users}</div>
                          <div>unique</div>
                        </div>
                        <div className="text-xs text-slate-400">
                          <div className="font-bold text-slate-700 text-sm">{row.total_logins}</div>
                          <div>total</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Section C: User Drilldown */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="w-5 h-5 text-slate-500" />
              User Login History
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setSelectedUser(null); }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                className="pl-9"
              />
              {/* Search dropdown */}
              {searchFocused && userSearch.length >= 1 && (
                <div className="absolute z-10 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                  {loadingSearch ? (
                    <div className="p-3 text-slate-400 text-sm">Searching…</div>
                  ) : searchUsers.length === 0 ? (
                    <div className="p-3 text-slate-400 text-sm">No users found</div>
                  ) : (
                    searchUsers.map((u) => (
                      <button
                        key={u.id}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-2"
                        onMouseDown={() => { setSelectedUser(u); setUserSearch(u.full_name || u.email); }}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 text-sm truncate">{u.full_name}</div>
                          <div className="text-xs text-slate-500 truncate">{u.email}</div>
                        </div>
                        <RoleBadge role={u.user_type} />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedUser && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-slate-600">{(selectedUser.full_name || "?")[0].toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">{selectedUser.full_name}</div>
                    <div className="text-sm text-slate-500">{selectedUser.email}</div>
                  </div>
                  <div className="ml-auto flex-shrink-0">
                    <RoleBadge role={selectedUser.user_type} />
                  </div>
                </div>

                {loadingHistory ? (
                  <div className="py-6 text-center text-slate-400 text-sm">Loading login history…</div>
                ) : historyEvents.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-sm">No login history found</div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex justify-between">
                      <span>Date</span>
                      <span>Time</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                      {historyEvents.map((e, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-sm text-slate-700">{formatDate(e.time)}</span>
                          <span className="text-sm font-mono text-slate-500">{formatTime(e.time)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-slate-50 px-4 py-2 text-xs text-slate-400 text-right">
                      {historyEvents.length} login{historyEvents.length !== 1 ? "s" : ""} shown (last 30)
                    </div>
                  </div>
                )}
              </div>
            )}

            {!selectedUser && userSearch.length === 0 && (
              <div className="py-6 text-center text-slate-400 text-sm">Search for a user to see their login history</div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
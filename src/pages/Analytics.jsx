import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Key, TrendingUp, TrendingDown, Clock, Search, RefreshCw, Flame, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

// ANALYTICS_PAGE_V2

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

function formatShortDay(dateStr) {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString([], { month: "short", day: "numeric" });
}

function relativeDay(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (diffDays <= 0) return "today " + formatTime(iso);
  if (diffDays === 1) return "yesterday";
  return diffDays + " days ago";
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

function TrendChip({ pct }) {
  if (pct === null || !isFinite(pct)) return <div className="text-xs text-slate-400 mt-1">no comparison yet</div>;
  const up = pct >= 0;
  return (
    <div className={`text-xs mt-1 inline-flex items-center gap-1 font-medium ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {Math.abs(Math.round(pct))}% vs 7-day avg
    </div>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <div className="font-semibold text-slate-900 mb-1">{d.label}</div>
      <div className="text-indigo-600 font-medium">{d.unique} unique users</div>
      <div className="text-slate-500">{d.total} total logins</div>
    </div>
  );
}

export default function Analytics() {
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = currentUser?.role === "admin" || currentUser?.user_type === "app_admin";

  const { data: todayData, isLoading: loadingToday, refetch: refetchToday } = useQuery({
    queryKey: ["analytics_today"],
    queryFn: () => base44.functions.invoke("getLoginAnalytics", { action: "today" }).then(r => r.data),
    enabled: isAdmin,
    refetchInterval: 60000,
  });

  const { data: dailyData, isLoading: loadingDaily } = useQuery({
    queryKey: ["analytics_daily"],
    queryFn: () => base44.functions.invoke("getLoginAnalytics", { action: "daily_active" }).then(r => r.data),
    enabled: isAdmin,
  });

  const { data: activeData, isLoading: loadingActive } = useQuery({
    queryKey: ["analytics_most_active"],
    queryFn: () => base44.functions.invoke("getLoginAnalytics", { action: "most_active" }).then(r => r.data),
    enabled: isAdmin,
  });

  const { data: searchData, isLoading: loadingSearch } = useQuery({
    queryKey: ["analytics_search_users", userSearch],
    queryFn: () => base44.functions.invoke("getLoginAnalytics", { action: "search_users", query: userSearch }).then(r => r.data),
    enabled: isAdmin && userSearch.length >= 1,
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ["analytics_history", selectedUser?.email],
    queryFn: () => base44.functions.invoke("getLoginAnalytics", { action: "user_history", email: selectedUser?.email }).then(r => r.data),
    enabled: !!selectedUser?.email && isAdmin,
  });

  if (currentUser && !isAdmin) {
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
  const weeklyUnique = dailyData?.weekly_unique ?? null;
  const leaders = activeData?.leaders || [];
  const searchUsers = searchData?.users || [];
  const historyEvents = historyData?.events || [];

  const todayTotal = logins.length;
  const todayUnique = new Set(logins.map(l => l.email)).size;

  // Trend vs the average of the previous 7 days (rows are sorted newest first; index 0 is today)
  const prev7 = dailyRows.slice(1, 8);
  const avgOf = (arr, key) => arr.length ? arr.reduce((s, r) => s + r[key], 0) / arr.length : 0;
  const avgLogins = avgOf(prev7, "total_logins");
  const avgUnique = avgOf(prev7, "unique_users");
  const loginsTrend = avgLogins > 0 ? ((todayTotal - avgLogins) / avgLogins) * 100 : null;
  const uniqueTrend = avgUnique > 0 ? ((todayUnique - avgUnique) / avgUnique) * 100 : null;

  // Chart data, oldest to newest
  const chartData = [...dailyRows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r, i, arr) => ({
      label: formatShortDay(r.date),
      unique: r.unique_users,
      total: r.total_logins,
      isToday: i === arr.length - 1,
    }));

  // Group today's logins per user
  const groupedToday = Object.values(
    logins.reduce((acc, l) => {
      const k = l.email || "unknown";
      if (!acc[k]) acc[k] = { ...l, sessions: 0, last: l.time };
      acc[k].sessions += 1;
      if (l.time > acc[k].last) acc[k].last = l.time;
      return acc;
    }, {})
  ).sort((a, b) => new Date(b.last) - new Date(a.last));

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

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">Logins Today</div>
              <div className="text-3xl font-bold text-orange-600 mt-1">{todayTotal}</div>
              <TrendChip pct={loginsTrend} />
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">Unique Users Today</div>
              <div className="text-3xl font-bold text-indigo-600 mt-1">{todayUnique}</div>
              <TrendChip pct={uniqueTrend} />
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">Active This Week</div>
              <div className="text-3xl font-bold text-slate-800 mt-1">{weeklyUnique ?? "—"}</div>
              <div className="text-xs text-slate-400 mt-1">unique users, last 7 days</div>
            </CardContent>
          </Card>
        </div>

        {/* Daily active users chart */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              Daily Active Users — Last 14 Days
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loadingDaily ? (
              <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>
            ) : (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                    <Bar dataKey="unique" radius={[4, 4, 0, 0]}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.isToday ? "#F26B1F" : "#818cf8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* Most active users */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="w-5 h-5 text-orange-500" />
                Most Active Users — Last 30 Days
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingActive ? (
                <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>
              ) : leaders.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">No activity recorded yet</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {leaders.map((u, i) => (
                    <div key={u.email || i} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-6 text-sm font-semibold text-slate-400 flex-shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 text-sm truncate">{u.full_name || u.email}</div>
                        <div className="text-xs text-slate-400">last seen {relativeDay(u.last_seen)}</div>
                      </div>
                      <RoleBadge role={u.user_type} />
                      <div className="text-sm font-semibold text-slate-800 flex-shrink-0 w-20 text-right">
                        {u.sessions} <span className="text-xs font-normal text-slate-400">sessions</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Logins today, grouped per user */}
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
              ) : groupedToday.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">No logins recorded today yet</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {groupedToday.map((u, i) => (
                    <div key={u.email || i} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 text-sm truncate">{u.full_name || u.email}</div>
                        <div className="text-xs text-slate-500 truncate">{u.email}</div>
                      </div>
                      <RoleBadge role={u.user_type} />
                      <div className="text-xs text-slate-500 flex-shrink-0 w-16 text-right">{u.sessions} session{u.sessions !== 1 ? "s" : ""}</div>
                      <div className="text-xs font-mono text-slate-400 flex-shrink-0 w-12 text-right">{formatTime(u.last)}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* User drilldown */}
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
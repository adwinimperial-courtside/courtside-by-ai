import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Key, RefreshCw, Download, AlertTriangle, SlidersHorizontal, Search } from "lucide-react";

const FEATURE_LABELS = {
  tactical_briefing: "Coach briefing",
  story_builder: "Story Builder",
  season_recap: "Season recap",
  league_leaders: "League leaders",
};

const FEATURE_LIMITS = {
  tactical_briefing: { field: "briefings_generated", limit: 10 },
  story_builder: { field: "stories_generated", limit: 20 },
  season_recap: { field: "recaps_generated", limit: null },
};

const FEATURE_COLORS = {
  tactical_briefing: "bg-orange-500",
  story_builder: "bg-indigo-500",
  season_recap: "bg-emerald-500",
  league_leaders: "bg-sky-500",
};

const ROLE_LABELS = {
  app_admin: "App admin",
  ops_admin: "Ops admin",
  league_admin: "League Owner",
  coach: "Coach",
  player: "Player",
  viewer: "Fan",
  video_admin: "Video admin",
};

const DEFAULT_INPUT_RATE = 3;
const DEFAULT_OUTPUT_RATE = 15;
const DEFAULT_CHARS_PER_TOKEN = 4;

function monthLabel(monthYear) {
  if (!monthYear) return "\u2014";
  const [y, m] = monthYear.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString([], { month: "long", year: "numeric" });
}

function recentMonths(count) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function formatWhen(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms) {
  if (!ms) return "\u2014";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatMoney(v) {
  if (!isFinite(v)) return "$0.00";
  if (v > 0 && v < 0.01) return "<$0.01";
  return `$${v.toFixed(2)}`;
}

function MetricCard({ label, value, sub, tone = "text-slate-800" }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="text-xs text-slate-500">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${tone}`}>{value}</div>
        {sub ? <div className="text-xs text-slate-400 mt-1">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

function StatusPill({ ok }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
      {ok ? "OK" : "Failed"}
    </span>
  );
}

export default function AIUsage() {
  const [month, setMonth] = useState(recentMonths(1)[0]);
  const [featureFilter, setFeatureFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [showRates, setShowRates] = useState(false);
  const [inputRate, setInputRate] = useState(DEFAULT_INPUT_RATE);
  const [outputRate, setOutputRate] = useState(DEFAULT_OUTPUT_RATE);
  const [charsPerToken, setCharsPerToken] = useState(DEFAULT_CHARS_PER_TOKEN);
  const [visibleRows, setVisibleRows] = useState(50);

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = currentUser?.role === "admin" || currentUser?.user_type === "app_admin";

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["ai_usage_logs", month],
    queryFn: () => base44.entities.AIUsageLog.filter({ month_year: month }),
    enabled: isAdmin && !!month,
  });

  const { data: counters = [] } = useQuery({
    queryKey: ["ai_usage_counters", month],
    queryFn: () => base44.entities.AIUsageCounter.filter({ month_year: month }),
    enabled: isAdmin && !!month,
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ["ai_usage_leagues"],
    queryFn: () => base44.entities.League.list(),
    enabled: isAdmin,
  });

  const leagueNameById = useMemo(() => {
    const map = {};
    leagues.forEach((l) => { map[l.id] = [l.name, l.season].filter(Boolean).join(" \u00b7 ") || l.id; });
    return map;
  }, [leagues]);

  const sorted = useMemo(
    () => [...logs].sort((a, b) => String(b.occurred_at || "").localeCompare(String(a.occurred_at || ""))),
    [logs]
  );

  const totals = useMemo(() => {
    let generations = 0;
    let failures = 0;
    let cost = 0;
    const users = new Set();
    const byFeature = {};
    const byLeague = {};

    sorted.forEach((r) => {
      generations += 1;
      if (r.success === false) failures += 1;
      if (r.user_email) users.add(r.user_email);

      const inTokens = (Number(r.prompt_chars) || 0) / (charsPerToken || 4);
      const outTokens = (Number(r.response_chars) || 0) / (charsPerToken || 4);
      cost += (inTokens / 1e6) * (Number(inputRate) || 0) + (outTokens / 1e6) * (Number(outputRate) || 0);

      const f = r.feature || "unknown";
      byFeature[f] = (byFeature[f] || 0) + 1;

      const lid = r.league_id || "";
      if (lid) byLeague[lid] = (byLeague[lid] || 0) + 1;
    });

    return {
      generations,
      failures,
      cost,
      activeUsers: users.size,
      byFeature: Object.entries(byFeature).sort((a, b) => b[1] - a[1]),
      byLeague: Object.entries(byLeague).sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  }, [sorted, inputRate, outputRate, charsPerToken]);

  const nearLimit = useMemo(() => {
    const out = [];
    counters.forEach((c) => {
      Object.entries(FEATURE_LIMITS).forEach(([feature, cfg]) => {
        if (!cfg.limit) return;
        const used = Number(c[cfg.field]) || 0;
        if (used >= cfg.limit * 0.8) {
          out.push({
            id: `${c.id}-${feature}`,
            email: c.created_by || "unknown",
            feature,
            used,
            limit: cfg.limit,
          });
        }
      });
    });
    return out.sort((a, b) => (b.used / b.limit) - (a.used / a.limit));
  }, [counters]);

  const filtered = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return sorted.filter((r) => {
      if (featureFilter !== "all" && r.feature !== featureFilter) return false;
      if (leagueFilter !== "all" && (r.league_id || "") !== leagueFilter) return false;
      if (outcomeFilter === "ok" && r.success === false) return false;
      if (outcomeFilter === "failed" && r.success !== false) return false;
      if (q && !String(r.user_email || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sorted, featureFilter, leagueFilter, outcomeFilter, userSearch]);

  const downloadCSV = () => {
    if (!filtered.length) return;
    const rows = filtered.map((r) => ({
      when: r.occurred_at || "",
      user: r.user_email || "",
      role: r.user_type || "",
      feature: r.feature || "",
      league: leagueNameById[r.league_id] || r.league_id || "",
      target_id: r.target_id || "",
      model: r.model || "",
      success: r.success === false ? "failed" : "ok",
      error_message: r.error_message || "",
      prompt_chars: r.prompt_chars ?? "",
      response_chars: r.response_chars ?? "",
      duration_ms: r.duration_ms ?? "",
    }));
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => `"${String(r[h]).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-usage-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  const maxFeatureCount = totals.byFeature.length ? totals.byFeature[0][1] : 0;
  const maxLeagueCount = totals.byLeague.length ? totals.byLeague[0][1] : 0;
  const capWarning = logs.length >= 1400;

  return (
    <div data-marker="AI_USAGE_PAGE_V1" className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6 overflow-x-hidden">
      <div className="max-w-5xl mx-auto w-full space-y-6">

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">AI Usage</h1>
              <p className="text-slate-600 text-sm">Every AI generation across the platform</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={(e) => { setMonth(e.target.value); setVisibleRows(50); }}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
            >
              {recentMonths(12).map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 text-slate-600">
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {capWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>This month is close to the 1,500 row limit base44 returns in one fetch. Figures below may be incomplete.</span>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Generations" value={isLoading ? "\u2014" : totals.generations} sub={monthLabel(month)} tone="text-orange-600" />
          <MetricCard label="Estimated cost" value={isLoading ? "\u2014" : formatMoney(totals.cost)} sub="approximate, see notes" tone="text-indigo-600" />
          <MetricCard label="Active users" value={isLoading ? "\u2014" : totals.activeUsers} sub="generated at least once" />
          <MetricCard
            label="Failures"
            value={isLoading ? "\u2014" : totals.failures}
            sub={totals.generations ? `${Math.round((totals.failures / totals.generations) * 100)}% of generations` : "none recorded"}
            tone={totals.failures > 0 ? "text-red-600" : "text-slate-800"}
          />
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <button
              type="button"
              onClick={() => setShowRates(!showRates)}
              className="flex items-center gap-2 text-sm font-medium text-slate-700"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Cost assumptions
              <span className="text-xs font-normal text-slate-400">
                ({showRates ? "hide" : "show"})
              </span>
            </button>
            {showRates && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-slate-500">
                  base44 does not report token counts, so tokens are estimated from character length.
                  base44 also bills its own credits rather than model tokens, so treat this as a guide to
                  relative cost between features, not as an invoice. Defaults are Claude Sonnet 4.6 list
                  pricing in US dollars per million tokens.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="text-xs text-slate-500">
                    Input $ / million tokens
                    <Input
                      type="number"
                      step="0.01"
                      value={inputRate}
                      onChange={(e) => setInputRate(e.target.value)}
                      className="mt-1 h-8 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Output $ / million tokens
                    <Input
                      type="number"
                      step="0.01"
                      value={outputRate}
                      onChange={(e) => setOutputRate(e.target.value)}
                      className="mt-1 h-8 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Characters per token
                    <Input
                      type="number"
                      step="0.1"
                      value={charsPerToken}
                      onChange={(e) => setCharsPerToken(e.target.value)}
                      className="mt-1 h-8 text-sm"
                    />
                  </label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center text-slate-500 py-12 text-sm">Loading usage...</div>
        ) : totals.generations === 0 ? (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-10 text-center">
              <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-slate-800">No AI generations in {monthLabel(month)}</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Nothing has been generated this month yet. Logging started on 4 August 2026, so earlier
                months will be empty even where AI was used.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">By feature</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  {totals.byFeature.map(([feature, count]) => (
                    <div key={feature}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-700">{FEATURE_LABELS[feature] || feature}</span>
                        <span className="text-slate-500 tabular-nums">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${FEATURE_COLORS[feature] || "bg-slate-400"}`}
                          style={{ width: `${maxFeatureCount ? (count / maxFeatureCount) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Top leagues</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  {totals.byLeague.length === 0 ? (
                    <p className="text-sm text-slate-400">No league-specific generations this month.</p>
                  ) : (
                    totals.byLeague.map(([leagueId, count]) => (
                      <div key={leagueId}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-slate-700 truncate pr-2">{leagueNameById[leagueId] || leagueId}</span>
                          <span className="text-slate-500 tabular-nums flex-shrink-0">{count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-slate-700"
                            style={{ width: `${maxLeagueCount ? (count / maxLeagueCount) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Close to their monthly limit</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {nearLimit.length === 0 ? (
                  <p className="text-sm text-slate-400">Nobody is near a limit this month.</p>
                ) : (
                  <div className="space-y-2">
                    {nearLimit.map((n) => (
                      <div key={n.id} className="flex items-center justify-between text-sm">
                        <div className="min-w-0 pr-3">
                          <div className="text-slate-800 truncate">{n.email}</div>
                          <div className="text-xs text-slate-500">{FEATURE_LABELS[n.feature] || n.feature}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${n.used >= n.limit ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {n.used} of {n.limit} used
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-3">
                  App admins are exempt from limits and never appear here.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Generation log</CardTitle>
                  <Button size="sm" variant="outline" onClick={downloadCSV} className="h-8 text-xs gap-1">
                    <Download className="w-3 h-3" /> CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
                  <select
                    value={featureFilter}
                    onChange={(e) => setFeatureFilter(e.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
                  >
                    <option value="all">All features</option>
                    {totals.byFeature.map(([f]) => (
                      <option key={f} value={f}>{FEATURE_LABELS[f] || f}</option>
                    ))}
                  </select>
                  <select
                    value={leagueFilter}
                    onChange={(e) => setLeagueFilter(e.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
                  >
                    <option value="all">All leagues</option>
                    <option value="">No league</option>
                    {totals.byLeague.map(([lid]) => (
                      <option key={lid} value={lid}>{leagueNameById[lid] || lid}</option>
                    ))}
                  </select>
                  <select
                    value={outcomeFilter}
                    onChange={(e) => setOutcomeFilter(e.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
                  >
                    <option value="all">Any outcome</option>
                    <option value="ok">Succeeded</option>
                    <option value="failed">Failed</option>
                  </select>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <Input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search user"
                      className="h-9 pl-8 text-sm"
                    />
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No generations match these filters.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                            <th className="py-2 pr-3 font-medium">Who</th>
                            <th className="py-2 pr-3 font-medium">What</th>
                            <th className="py-2 pr-3 font-medium">Where</th>
                            <th className="py-2 pr-3 font-medium">When</th>
                            <th className="py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.slice(0, visibleRows).map((r) => (
                            <tr key={r.id} className="border-b border-slate-100 align-top">
                              <td className="py-2 pr-3">
                                <div className="text-slate-800 break-all">{r.user_email || "\u2014"}</div>
                                <div className="text-xs text-slate-500">{ROLE_LABELS[r.user_type] || r.user_type || "\u2014"}</div>
                              </td>
                              <td className="py-2 pr-3">
                                <div className="text-slate-800">{FEATURE_LABELS[r.feature] || r.feature}</div>
                                <div className="text-xs text-slate-500">{r.model || "\u2014"}</div>
                              </td>
                              <td className="py-2 pr-3">
                                <div className="text-slate-800">
                                  {r.league_id ? (leagueNameById[r.league_id] || r.league_id) : "\u2014"}
                                </div>
                                <div className="text-xs text-slate-500 break-all">{r.target_id || "\u2014"}</div>
                              </td>
                              <td className="py-2 pr-3 whitespace-nowrap">
                                <div className="text-slate-800">{formatWhen(r.occurred_at)}</div>
                                <div className="text-xs text-slate-500">{formatDuration(Number(r.duration_ms) || 0)}</div>
                              </td>
                              <td className="py-2">
                                <StatusPill ok={r.success !== false} />
                                {r.success === false && r.error_message ? (
                                  <div className="text-xs text-red-600 mt-1 max-w-[220px] break-words">{r.error_message}</div>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-slate-400">
                        Showing {Math.min(visibleRows, filtered.length)} of {filtered.length}
                      </span>
                      {visibleRows < filtered.length && (
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setVisibleRows(visibleRows + 100)}>
                          Show more
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
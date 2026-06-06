import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Radar, Trophy, Users, UserCircle, Calendar, ClipboardList, Activity, Key, TrendingUp, AlertTriangle, Flame, Crown, ArrowRight, UserPlus, CalendarPlus, Shield, Trash2, Pencil } from "lucide-react";

export default function CommandCenter() {
  const { data: currentUser } = useQuery({ queryKey: ["user"], queryFn: () => base44.auth.me(), initialData: null });
  const isAdmin = currentUser?.user_type === "app_admin";

  const { data: leagues = [] } = useQuery({ queryKey: ["cc_leagues"], queryFn: () => base44.entities.League.list("-created_date", 200), enabled: isAdmin, staleTime: 60000 });
  const { data: teams = [] } = useQuery({ queryKey: ["cc_teams"], queryFn: () => base44.entities.Team.list("-created_date", 500), enabled: isAdmin, staleTime: 60000 });
  const { data: players = [] } = useQuery({ queryKey: ["cc_players"], queryFn: () => base44.entities.Player.list("-created_date", 500), enabled: isAdmin, staleTime: 120000 });
  const { data: games = [] } = useQuery({ queryKey: ["cc_games"], queryFn: () => base44.entities.Game.list("-game_date", 500), enabled: isAdmin, staleTime: 30000, refetchInterval: 60000 });
  const { data: applications = [] } = useQuery({ queryKey: ["cc_apps"], queryFn: () => base44.entities.UserApplication.list(), enabled: isAdmin, staleTime: 30000, refetchInterval: 60000 });
  const { data: users = [] } = useQuery({ queryKey: ["cc_users"], queryFn: () => base44.entities.User.list("-created_date", 500), enabled: isAdmin, staleTime: 120000 });
  const { data: auditLogs = [] } = useQuery({ queryKey: ["cc_audit"], queryFn: () => base44.entities.LeagueAuditLog.list("-performed_at", 50), enabled: isAdmin, staleTime: 60000 });
  const { data: deletions = [] } = useQuery({ queryKey: ["cc_deletions"], queryFn: () => base44.entities.DeletionLog.list("-deletion_date", 30), enabled: isAdmin, staleTime: 60000 });

  const teamName = (id) => teams.find((t) => t.id === id)?.name || "TBD";
  const leagueName = (id) => leagues.find((l) => l.id === id)?.name || "Unknown league";

  const now = new Date();
  const DAY = 86400000;
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const weekAhead = new Date(now.getTime() + 7 * DAY);

  const gamesThisWeek = games.filter((g) => g.created_date && new Date(g.created_date) >= weekAgo).length;
  const liveGames = games.filter((g) => g.status === "in_progress");
  const upcoming = games
    .filter((g) => g.status === "scheduled" && g.game_date && new Date(g.game_date) >= now && new Date(g.game_date) <= weekAhead)
    .sort((a, b) => new Date(a.game_date) - new Date(b.game_date))
    .slice(0, 8);
  const pendingCount = applications.filter((a) => a.status === "Pending").length;

  // Per-league aggregates
  const leagueAgg = leagues.map((L) => {
    const lGames = games.filter((g) => g.league_id === L.id);
    const tCount = teams.filter((t) => t.league_id === L.id).length;
    const gamesLast7 = lGames.filter((g) => g.created_date && new Date(g.created_date) >= weekAgo).length;
    const dates = lGames.map((g) => (g.game_date ? new Date(g.game_date).getTime() : 0)).filter(Boolean);
    const lastGame = dates.length ? new Date(Math.max(...dates)) : null;
    return { id: L.id, name: L.name, gameCount: lGames.length, teamCount: tCount, gamesLast7, lastGame };
  });
  const rising = leagueAgg.filter((a) => a.gamesLast7 > 0).sort((a, b) => b.gamesLast7 - a.gamesLast7).slice(0, 3);
  const power = [...leagueAgg].sort((a, b) => b.gameCount - a.gameCount).slice(0, 3);
  const stalled = leagueAgg
    .filter((a) => a.gameCount === 0 || a.teamCount === 0 || (a.lastGame && now - a.lastGame > 14 * DAY))
    .sort((a, b) => (a.lastGame ? a.lastGame.getTime() : 0) - (b.lastGame ? b.lastGame.getTime() : 0))
    .slice(0, 4);
  const recentSignups = applications.filter((a) => a.created_date && new Date(a.created_date) >= new Date(now.getTime() - 2 * DAY)).length;

  // Activity feed
  const feed = [
    ...leagues.map((l) => ({ date: l.created_date, type: "league", text: `New league "${l.name}" created` })),
    ...teams.map((t) => ({ date: t.created_date, type: "team", text: `Team "${t.name}" added` })),
    ...games.map((g) => ({ date: g.created_date, type: "game", text: `Game scheduled — ${teamName(g.home_team_id)} vs ${teamName(g.away_team_id)}` })),
    ...applications.map((a) => ({ date: a.created_date, type: "signup", text: `New signup — ${a.user_name || a.user_email} (${a.requested_role})` })),
    ...auditLogs.map((a) => ({ date: a.performed_at, type: "edit", text: `${a.performed_by_name || a.performed_by} ${a.action === "delete" ? "deleted" : "edited"} ${a.league_name || "a league"}` })),
    ...deletions.map((d) => ({ date: d.deletion_date, type: "delete", text: `${d.deleted_by} deleted ${d.entity_type}${d.entity_details ? ` (${d.entity_details})` : ""}` })),
  ].filter((f) => f.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

  const feedIcon = { league: Trophy, team: Shield, game: CalendarPlus, signup: UserPlus, edit: Pencil, delete: Trash2 };

  // Funnel
  const approvedCount = applications.filter((a) => a.status === "Approved").length;
  const activeLeagues = leagueAgg.filter((a) => a.gameCount > 0).length;
  const funnel = [
    { label: "Signed up", value: users.length },
    { label: "Applied", value: applications.length },
    { label: "Approved", value: approvedCount },
    { label: "Active leagues", value: activeLeagues },
  ];
  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);

  // Channel attribution
  const channelLabels = { facebook_group: "Facebook group", referral: "Referral", search: "Search", another_league: "Another league", other: "Other" };
  const channelCounts = {};
  applications.forEach((a) => { if (a.heard_from) channelCounts[a.heard_from] = (channelCounts[a.heard_from] || 0) + 1; });
  const channelTotal = Object.values(channelCounts).reduce((s, n) => s + n, 0) || 1;
  const channels = Object.entries(channelCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: channelLabels[k] || k, pct: Math.round((v / channelTotal) * 100) }));

  // Region
  const countryCounts = {};
  applications.forEach((a) => { if (a.country) countryCounts[a.country] = (countryCounts[a.country] || 0) + 1; });
  const regionMax = Math.max(...Object.values(countryCounts), 1);
  const regions = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ label: k, count: v }));

  if (currentUser && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <Key className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
            <p className="text-slate-600">You don't have permission to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Leagues", value: leagues.length, icon: Trophy },
    { label: "Teams", value: teams.length, icon: Users },
    { label: "Players", value: players.length, icon: UserCircle },
    { label: "Games (total)", value: games.length, delta: `+${gamesThisWeek} this week`, icon: Calendar },
    { label: "Live now", value: liveGames.length, icon: Activity, accent: "text-red-600" },
    { label: "Pending approvals", value: pendingCount, icon: ClipboardList, accent: "text-orange-600" },
  ];

  const fmtDate = (d) => {
    const dt = new Date(d);
    const today = new Date();
    const tmr = new Date(Date.now() + DAY);
    const sameDay = (a, b) => a.toDateString() === b.toDateString();
    const t = dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay(dt, today)) return `Today ${t}`;
    if (sameDay(dt, tmr)) return `Tomorrow ${t}`;
    return dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + ` ${t}`;
  };
  const ago = (d) => {
    const m = Math.floor((now - new Date(d)) / 60000);
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  };

  const OppCard = ({ title, icon: Icon, color, children }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-4 border-l-4" style={{ borderLeftColor: color }}>
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color }}>
        <Icon className="w-4 h-4" /> {title}
      </h3>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Radar className="w-8 h-8 text-orange-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Command Center</h1>
              <p className="text-slate-600 text-sm">What's happening across all leagues</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <s.icon className={`w-4 h-4 ${s.accent || "text-slate-400"}`} />
              <div className={`text-2xl font-bold mt-2 ${s.accent || "text-slate-900"}`}>{s.value.toLocaleString()}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              {s.delta && <div className="text-xs text-green-600 mt-1">{s.delta}</div>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Live now</h2>
            {liveGames.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">No games in progress right now.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {liveGames.map((g) => (
                  <Link key={g.id} to={`${createPageUrl("LiveBoxScore")}?gameId=${g.id}`} className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                        {teamName(g.home_team_id)} vs {teamName(g.away_team_id)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{leagueName(g.league_id)}</div>
                    </div>
                    <div className="text-lg font-bold text-slate-900 tabular-nums">{(g.home_score ?? 0)}–{(g.away_score ?? 0)}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Today &amp; upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">No games scheduled in the next 7 days.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcoming.map((g) => (
                  <div key={g.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{teamName(g.home_team_id)} vs {teamName(g.away_team_id)}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{leagueName(g.league_id)}</div>
                    </div>
                    <div className="text-xs text-slate-500 text-right">{fmtDate(g.game_date)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Opportunities &amp; risks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <OppCard title="Rising leagues" icon={TrendingUp} color="#16a34a">
            {rising.length === 0 ? <p className="text-xs text-slate-400">No standout activity this week.</p> :
              rising.map((r) => <div key={r.id} className="text-xs text-slate-600 py-0.5"><span className="font-medium text-slate-900">{r.name}</span> — {r.gamesLast7} games this week</div>)}
            <p className="text-xs font-medium text-green-700 mt-2">→ Ask for a testimonial or referral</p>
          </OppCard>
          <OppCard title="Stalled — at risk" icon={AlertTriangle} color="#d97706">
            {stalled.length === 0 ? <p className="text-xs text-slate-400">Nothing stalled. Nice.</p> :
              stalled.map((s) => <div key={s.id} className="text-xs text-slate-600 py-0.5"><span className="font-medium text-slate-900">{s.name}</span> — {s.gameCount === 0 ? "no games yet" : s.teamCount === 0 ? "no teams yet" : "inactive 14+ days"}</div>)}
            <p className="text-xs font-medium text-amber-700 mt-2">→ Send a nudge</p>
          </OppCard>
          <OppCard title="Hot leads" icon={Flame} color="#F26B1F">
            <div className="text-xs text-slate-600 py-0.5"><span className="font-medium text-slate-900">{pendingCount}</span> applications pending approval</div>
            <div className="text-xs text-slate-600 py-0.5"><span className="font-medium text-slate-900">{recentSignups}</span> new signups in the last 48h</div>
            <Link to={createPageUrl("RequestManagement")} className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 mt-2">Follow up now <ArrowRight className="w-3 h-3" /></Link>
          </OppCard>
          <OppCard title="Power leagues" icon={Crown} color="#2563eb">
            {power.length === 0 ? <p className="text-xs text-slate-400">No leagues yet.</p> :
              power.map((p) => <div key={p.id} className="text-xs text-slate-600 py-0.5"><span className="font-medium text-slate-900">{p.name}</span> — {p.teamCount} teams · {p.gameCount} games</div>)}
            <p className="text-xs font-medium text-blue-700 mt-2">→ Nurture · first for billing</p>
          </OppCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Signup funnel</h2>
            {funnel.map((f) => (
              <div key={f.label} className="flex items-center gap-3 my-2 text-sm">
                <span className="w-28 text-slate-600 flex-shrink-0">{f.label}</span>
                <span className="flex-1 h-4 bg-slate-100 rounded overflow-hidden"><span className="block h-full bg-orange-500 rounded" style={{ width: `${Math.max((f.value / funnelMax) * 100, 2)}%` }} /></span>
                <span className="w-12 text-right tabular-nums text-slate-700">{f.value}</span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Where they came from</h2>
            {channels.length === 0 ? <p className="text-xs text-slate-400 mb-3">No channel data yet.</p> :
              channels.map((c) => (
                <div key={c.label} className="flex items-center gap-3 my-1.5 text-sm">
                  <span className="w-28 text-slate-600 flex-shrink-0">{c.label}</span>
                  <span className="flex-1 h-4 bg-slate-100 rounded overflow-hidden"><span className="block h-full bg-orange-500 rounded" style={{ width: `${Math.max(c.pct, 2)}%` }} /></span>
                  <span className="w-12 text-right tabular-nums text-slate-700">{c.pct}%</span>
                </div>
              ))}
            <div className="border-t border-slate-100 mt-3 pt-3">
              <p className="text-xs font-medium text-slate-500 mb-2">By country</p>
              {regions.length === 0 ? <p className="text-xs text-slate-400">No country data yet.</p> :
                regions.map((r) => (
                  <div key={r.label} className="flex items-center gap-3 my-1.5 text-sm">
                    <span className="w-28 text-slate-600 flex-shrink-0 truncate">{r.label}</span>
                    <span className="flex-1 h-4 bg-slate-100 rounded overflow-hidden"><span className="block h-full bg-blue-500 rounded" style={{ width: `${Math.max((r.count / regionMax) * 100, 2)}%` }} /></span>
                    <span className="w-12 text-right tabular-nums text-slate-700">{r.count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent activity</h2>
          {feed.length === 0 ? <p className="text-sm text-slate-400 py-2">No recent activity.</p> :
            <div className="divide-y divide-slate-100">
              {feed.map((f, i) => {
                const Icon = feedIcon[f.type] || Activity;
                return (
                  <div key={i} className="flex items-center gap-3 py-2.5 text-sm">
                    <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-700">{f.text}</span>
                    <span className="ml-auto text-xs text-slate-400 flex-shrink-0">{ago(f.date)}</span>
                  </div>
                );
              })}
            </div>}
        </div>
      </div>
    </div>
  );
}
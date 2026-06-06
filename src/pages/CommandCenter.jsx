import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Radar, Trophy, Users, UserCircle, Calendar, ClipboardList, Activity, Key } from "lucide-react";

export default function CommandCenter() {
  const { data: currentUser } = useQuery({
    queryKey: ["user"],
    queryFn: () => base44.auth.me(),
    initialData: null,
  });

  const isAdmin = currentUser?.user_type === "app_admin";

  const { data: leagues = [] } = useQuery({
    queryKey: ["cc_leagues"],
    queryFn: () => base44.entities.League.list("-created_date", 500),
    enabled: isAdmin,
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["cc_teams"],
    queryFn: () => base44.entities.Team.list("-created_date", 2000),
    enabled: isAdmin,
  });
  const { data: players = [] } = useQuery({
    queryKey: ["cc_players"],
    queryFn: () => base44.entities.Player.list("-created_date", 5000),
    enabled: isAdmin,
  });
  const { data: games = [] } = useQuery({
    queryKey: ["cc_games"],
    queryFn: () => base44.entities.Game.list("-game_date", 2000),
    enabled: isAdmin,
    refetchInterval: 30000,
  });
  const { data: applications = [] } = useQuery({
    queryKey: ["cc_apps"],
    queryFn: () => base44.entities.UserApplication.list(),
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const teamName = (id) => teams.find((t) => t.id === id)?.name || "TBD";
  const leagueName = (id) => leagues.find((l) => l.id === id)?.name || "Unknown league";

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const gamesThisWeek = games.filter((g) => g.created_date && new Date(g.created_date) >= weekAgo).length;
  const liveGames = games.filter((g) => g.status === "in_progress");
  const upcoming = games
    .filter((g) => g.status === "scheduled" && g.game_date && new Date(g.game_date) >= now && new Date(g.game_date) <= weekAhead)
    .sort((a, b) => new Date(a.game_date) - new Date(b.game_date))
    .slice(0, 8);
  const pendingCount = applications.filter((a) => a.status === "Pending").length;

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
    const tmr = new Date(Date.now() + 86400000);
    const sameDay = (a, b) => a.toDateString() === b.toDateString();
    const t = dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay(dt, today)) return `Today ${t}`;
    if (sameDay(dt, tmr)) return `Tomorrow ${t}`;
    return dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + ` ${t}`;
  };

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
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
      </div>
    </div>
  );
}
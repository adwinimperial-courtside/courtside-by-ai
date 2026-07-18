import React from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, 
  Trophy, 
  Calendar, 
  Users, 
  Target, 
  User,
  Clock,
  RefreshCw,
  UserCheck,
  Wifi,
  Shirt,
  Camera,
  Pencil,
  Smartphone,
  Home,
  Link,
  ClipboardList,
  Timer,
  LayoutDashboard
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import PlayerProfile from "@/pages/PlayerProfile"; // PROFILE_SHORTCUTS_V1 — players land on the trophy room
import CoachHomePanel from "@/components/home/CoachHomePanel"; // COACH_HOME_WIREUP_V1

export default function Landing() {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const role = currentUser?.user_type;
  const firstName = currentUser?.full_name?.split(" ")[0] || null;

  const isOrganiser = role === "app_admin" || role === "league_admin";

  const { data: reqData } = useQuery({
    queryKey: ['dash_pending_requests'],
    queryFn: async () => { const r = await base44.functions.invoke('getReviewRequests', {}); return r?.data || r; },
    enabled: isOrganiser,
    staleTime: 30000,
  });
  const pendingRequestsCount = (reqData?.requests || []).length;

  const { data: usersData } = useQuery({
    queryKey: ['dash_league_users'],
    queryFn: async () => { const r = await base44.functions.invoke('getLeagueUsers', {}); return r?.data || r; },
    enabled: isOrganiser,
    staleTime: 60000,
  });
  const myLeagueIds = currentUser?.assigned_league_ids || [];
  const leagueUsersCount = role === "app_admin"
    ? (usersData?.users || []).length
    : (usersData?.users || []).filter(u => Array.isArray(u.assigned_league_ids) && u.assigned_league_ids.some(id => myLeagueIds.includes(id))).length;

  const getRoleLabel = () => {
    if (role === "app_admin" || role === "league_admin") return "League organiser";
    if (role === "coach") return "Coach";
    if (role === "player") return "Player";
    if (role === "viewer") return "Viewer";
    return "Member";
  };

  const getStatChip = () => {
    if (role === "app_admin" || role === "league_admin") {
      const count = currentUser?.assigned_league_ids?.length ?? 0;
      return `${count} Active league${count !== 1 ? "s" : ""}`;
    }
    if (role === "coach") return "Coach insights ready";
    if (role === "player") return "Your stats are live";
    return "Follow the action";
  };

  const getTagline = () => {
    if (role === "app_admin" || role === "league_admin") return "Your leagues are live. Stats are tracking.";
    if (role === "coach") return "Study the numbers. Prepare your game plan.";
    if (role === "player") return "Track your progress. Earn your recognition.";
    return "Follow every game. Live stats and standings.";
  };

  const getQuickCards = () => {
    if (role === "app_admin" || role === "league_admin") return [
      { icon: Calendar, color: "#F26B1F", bg: "bg-orange-100", title: "Schedule", subtitle: "View & manage games", href: "/schedule" },
      { icon: Trophy, color: "#D97706", bg: "bg-amber-100", title: "Standings", subtitle: "League standings", href: "/standings" },
      { icon: Users, color: "#3B82F6", bg: "bg-blue-100", title: "League users", subtitle: "Manage members", href: "/leagueusers", count: leagueUsersCount },
      { icon: UserCheck, color: "#16A34A", bg: "bg-green-100", title: "User Requests", subtitle: "Approve new members", href: "/requestmanagement", count: pendingRequestsCount, accent: true },
    ];
    if (role === "coach") return [
      { icon: Target, color: "#9333EA", bg: "bg-purple-100", title: "Coach insights", subtitle: "Analyse matchups", href: "/coachinsights" },
      { icon: Calendar, color: "#F26B1F", bg: "bg-orange-100", title: "Schedule", subtitle: "Upcoming games", href: "/schedule" },
      { icon: BarChart3, color: "#16A34A", bg: "bg-green-100", title: "Statistics", subtitle: "Team & player stats", href: "/statistics" },
    ];
    if (role === "player") return [
      { icon: User, color: "#F26B1F", bg: "bg-orange-100", title: "My profile", subtitle: "Your stats & awards", href: "/playerprofile" },
      { icon: BarChart3, color: "#3B82F6", bg: "bg-blue-100", title: "Statistics", subtitle: "League leaders", href: "/statistics" },
      { icon: Calendar, color: "#16A34A", bg: "bg-green-100", title: "Schedule", subtitle: "Upcoming games", href: "/schedule" },
    ];
    return [
      { icon: Calendar, color: "#F26B1F", bg: "bg-orange-100", title: "Schedule", subtitle: "Upcoming games", href: "/schedule" },
      { icon: Trophy, color: "#D97706", bg: "bg-amber-100", title: "Standings", subtitle: "League standings", href: "/standings" },
      { icon: BarChart3, color: "#3B82F6", bg: "bg-blue-100", title: "Statistics", subtitle: "Player leaders", href: "/statistics" },
    ];
  };

  // PLAYER_HOME_WIREUP_V1 — players get the dedicated cockpit; admin/coach/viewer unchanged.
  if (role === "player") return <PlayerProfile />; // PROFILE_SHORTCUTS_V1
  if (role === "coach") return <CoachHomePanel currentUser={currentUser} />; // COACH_HOME_WIREUP_V1

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Dashboard Card */}
      <section className="bg-slate-100 px-4 sm:px-6 pt-6 pb-0">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl p-5 sm:p-8 md:p-10" style={{ backgroundColor: "#0B1F3A" }}>
            {/* Top row: avatar + greeting + stat chip */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-full font-black text-white text-lg sm:text-xl flex-shrink-0"
                  style={{ backgroundColor: "#F26B1F", width: 40, height: 40, minWidth: 40 }}
                >
                  {currentUser?.full_name?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-medium">{getRoleLabel()}</div>
                  <div className="text-lg sm:text-xl font-bold text-white leading-tight">
                    {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
                  </div>
                </div>
              </div>
              <div
                className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 ml-2"
                style={{ backgroundColor: "rgba(242,107,31,0.15)", color: "#F26B1F", border: "1px solid rgba(242,107,31,0.4)" }}
              >
                {getStatChip()}
              </div>
            </div>

            {/* Tagline */}
            <p className="text-sm text-slate-400 mb-6">{getTagline()}</p>

            {/* Quick action cards */}
            <div className={`grid grid-cols-1 ${getQuickCards().length >= 4 ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-3`}>
              {getQuickCards().map((card, idx) => {
                const Icon = card.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => window.location.href = card.href}
                    className="relative flex items-center gap-3 sm:flex-col sm:items-start rounded-xl p-3 sm:p-4 text-left transition-all hover:opacity-80 min-h-[44px]"
                    style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    {card.count > 0 && (
                      <span className="absolute top-2.5 right-2.5 min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center" style={card.accent ? { backgroundColor: "#F26B1F", color: "#fff" } : { backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}>
                        {card.count}
                      </span>
                    )}
                    <div className={`flex items-center justify-center rounded-lg flex-shrink-0 ${card.bg}`} style={{ width: 36, height: 36, minWidth: 36 }}>
                      <Icon style={{ color: card.color, width: 18, height: 18 }} />
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-bold text-white">{card.title}</div>
                      <div className="text-xs text-slate-400">{card.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-slate-50 py-7">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-0 text-center">
            {[
              { number: "900+", label: "Completed games" },
              { number: "30+", label: "Leagues" },
              { number: "350+", label: "Users" },
              { number: "200+", label: "Teams" },
            ].map((stat, idx) => (
              <div key={idx} className={`flex-1 ${idx > 0 ? "sm:border-l sm:border-slate-200" : ""}`}>
                <div className="text-3xl font-black" style={{ color: "#F26B1F" }}>{stat.number}</div>
                <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's New */}
      <section className="bg-slate-100 px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">What's New</div>
          <div className="space-y-3">
            {/* WHATS_NEW_V3 */}
            {[
              ...(role === "league_admin" || role === "app_admin" ? [
                {
                  icon: Link,
                  bg: "bg-blue-100",
                  color: "#3B82F6",
                  title: "Your Own League Sign-Up Link",
                  badge: "New",
                  date: "Jul 16, 2026",
                  desc: "Create a registration campaign and share one link — players, coaches and viewers sign up through it and land straight in your approval queue. Coaches redeem a one-time code you hand out",
                },
                {
                  icon: ClipboardList,
                  bg: "bg-teal-100",
                  color: "#0D9488",
                  title: "Coaches Manage Their Own Rosters",
                  badge: "New",
                  date: "Jul 15, 2026",
                  desc: "Coaches can now add, edit and remove players on their own team — no more roster emails to you. You set the deadline, lock editing anytime, and every change is logged in a full roster history",
                },
              ] : []),
              {
                icon: Timer,
                bg: "bg-red-100",
                color: "#DC2626",
                title: "Fouls & Timeouts on the Live Box Score",
                badge: "New",
                date: "Jul 17, 2026",
                desc: "Following a game live? The box score now shows each team's fouls and timeouts remaining, updated in real time for timed games",
              },
              ...(role === "league_admin" || role === "app_admin" ? [
                {
                  icon: LayoutDashboard,
                  bg: "bg-purple-100",
                  color: "#7C3AED",
                  title: "A Sharper Coach Dashboard",
                  badge: "New",
                  date: "Jul 16, 2026",
                  desc: "Coach home got a dark 'Midnight Slate' redesign — win/loss streak at a glance, plus a scouting peek at the next opponent's last three games",
                },
              ] : []),
              {
                icon: Trophy,
                bg: "bg-orange-100",
                color: "#F26B1F",
                title: "Player Cards",
                badge: "Flagship",
                date: "Jul 14, 2026",
                desc: "Every player now has their own trophy room — a cinematic gold profile with their stats, badges and awards. Tap any player's name in Stats Leaders, Award Leaders, Statistics or the Schedule to open it",
              },
              ...(role === "league_admin" || role === "app_admin" ? [
                {
                  icon: Shirt,
                  bg: "bg-teal-100",
                  color: "#0D9488",
                  title: "Roster Validation",
                  badge: null,
                  date: "Jun 19, 2026",
                  desc: "No more mixed-up stats from two players wearing the same number — duplicate jerseys are blocked before they're saved, and one tap on Check Rosters scans every team in your league",
                },
                {
                  icon: Camera,
                  bg: "bg-blue-100",
                  color: "#3B82F6",
                  title: "Player Profile Photos",
                  badge: null,
                  date: "Jul 14, 2026",
                  desc: "Put faces on your league — upload player photos with drag-and-zoom cropping, then edit or remove them anytime. Photos show up on player cards and rosters",
                },
                {
                  icon: Pencil,
                  bg: "bg-amber-100",
                  color: "#D97706",
                  title: "Edit Finished Live Games",
                  badge: null,
                  date: "Jun 19, 2026",
                  desc: "Spotted a wrong stat after the final buzzer? Completed live-tracked games can now be fixed in Edit Game, with a running score check at the top while you type",
                },
              ] : []),
              {
                icon: Smartphone,
                bg: "bg-purple-100",
                color: "#7C3AED",
                title: "Faster Stats on Mobile",
                badge: null,
                date: "Jul 14, 2026",
                desc: "Browse stat categories with one thumb — quick-switch tabs replace the old dropdown on the Statistics page, and they stay pinned while you scroll",
              },
              ...(role === "league_admin" || role === "app_admin" ? [
                {
                  icon: RefreshCw,
                  bg: "bg-amber-100",
                  color: "#D97706",
                  title: "Improved substitutions",
                  badge: "Most requested",
                  date: "Jun 11, 2026",
                  desc: "Rebuilt by popular demand: tap SUB on a player, then tap a benched player to swap them in — a clean one-tap substitution, with each player's fouls shown on their chip and an instant undo if you tap the wrong name",
                },
              ] : []),
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 px-4 py-3 min-h-[56px]"
                >
                  <div className={`flex items-center justify-center rounded-lg flex-shrink-0 ${item.bg}`} style={{ width: 36, height: 36 }}>
                    <Icon style={{ color: item.color, width: 18, height: 18 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-500">{item.desc}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {item.badge !== null && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={(item.badge === "Most requested" || item.badge === "Flagship") ? { backgroundColor: "#F26B1F", color: "#fff" } : { backgroundColor: "#FEF0E7", color: "#F26B1F" }}>
                        {item.badge || "New"}
                      </span>
                    )}
                    {item.date && (
                      <span className="text-[11px] text-slate-400">{item.date}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
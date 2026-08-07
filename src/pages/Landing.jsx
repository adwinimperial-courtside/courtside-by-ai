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
  LayoutDashboard,
  HelpCircle,
  Monitor,
  Video
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
              { number: "430+", label: "Users" },
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
            {/* WHATS_NEW_V4 */}
            {(role === "league_admin" || role === "app_admin"
              ? [
                  {
                    icon: Monitor,
                    bg: "bg-red-100",
                    color: "#DC2626",
                    featured: true,
                    title: "A Live Broadcast-Grade Overlay, Powered by Your Stats",
                    badge: "Flagship",
                    date: "Jul 31, 2026",
                    desc: "Stream your games with an overlay that reads the live stat feed as it happens. Every timeout brings up a team comparison panel, the end of each period rotates a top-5 leaders board, and a scoring run gets called out with its own headline \u2014 all straight from the stats being tracked courtside. Team logos sit on the scorebug, and league or sponsor logos can be switched off per season.",
                  },
                  {
                    icon: Link,
                    bg: "bg-blue-100",
                    color: "#3B82F6",
                    title: "One Link, and Everyone Signs Themselves Up",
                    badge: "New",
                    date: "Aug 3, 2026",
                    desc: "Share a single registration link and your coaches, players and fans all sign up through it, landing straight in your approval queue. Approve or decline with a reason in one tap \u2014 the right welcome email and the right access go out automatically.",
                  },
                  {
                    icon: ClipboardList,
                    bg: "bg-teal-100",
                    color: "#0D9488",
                    title: "Coaches Build Their Own Rosters",
                    badge: "New",
                    date: "Jul 15, 2026",
                    desc: "No more collecting team lists by email or typing names in yourself. Coaches add, edit and remove their own players; you set the deadline, lock editing when you are ready, and every change is kept in a full roster history.",
                  },
                  {
                    icon: Calendar,
                    bg: "bg-amber-100",
                    color: "#D97706",
                    title: "One League, Many Seasons",
                    badge: "Most requested",
                    date: "Jul 19, 2026",
                    desc: "Your league is now the club or competition itself, and each season lives inside it. Set the league up once, add a season each year \u2014 finished seasons fold away, with every stat kept.",
                  },
                  {
                    icon: Video,
                    bg: "bg-orange-100",
                    color: "#F26B1F",
                    title: "Invite Your Stream Crew",
                    badge: "New",
                    date: "Aug 7, 2026",
                    desc: "Hand the stream to your video team \u2014 invite them by email from the new Stream Crew page and they get overlay access to your league the moment they accept. No approval queue, no shared logins.",
                  },
                ]
              : [
                  {
                    icon: Trophy,
                    bg: "bg-orange-100",
                    color: "#F26B1F",
                    title: "Player Cards",
                    badge: "Flagship",
                    date: "Jul 14, 2026",
                    desc: "Every player now has their own trophy room \u2014 a cinematic gold profile with their stats, badges and awards. Tap any player's name in Stats Leaders, Award Leaders, Statistics or the Schedule to open it.",
                  },
                  {
                    icon: HelpCircle,
                    bg: "bg-orange-100",
                    color: "#F26B1F",
                    title: "In-App Help, Right Where You Need It",
                    badge: null,
                    date: "Jul 18, 2026",
                    desc: "Tap the orange ? next to any page title for a quick explanation of that page, or open the Help Center from the menu for a full guide tailored to your role.",
                  },
                  {
                    icon: Timer,
                    bg: "bg-red-100",
                    color: "#DC2626",
                    title: "Fouls & Timeouts on the Live Box Score",
                    badge: null,
                    date: "Jul 17, 2026",
                    desc: "Following a game live? The box score now shows each team's fouls and timeouts remaining, updated in real time for timed games.",
                  },
                ]
            ).map((item, idx) => {
              const Icon = item.icon;
              const boxSize = item.featured ? 44 : 36;
              const iconSize = item.featured ? 22 : 18;
              return (
                <div
                  key={idx}
                  className={
                    item.featured
                      ? "flex items-center gap-5 bg-white rounded-xl border border-orange-400 shadow-md px-4 py-4 min-h-[56px]"
                      : "flex items-center gap-4 bg-white rounded-xl border border-slate-200 px-4 py-3 min-h-[56px]"
                  }
                >
                  <div className={`flex items-center justify-center rounded-lg flex-shrink-0 ${item.bg}`} style={{ width: boxSize, height: boxSize }}>
                    <Icon style={{ color: item.color, width: iconSize, height: iconSize }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={item.featured ? "text-[15px] font-bold text-slate-900" : "text-sm font-bold text-slate-900"}>{item.title}</div>
                    <div className={item.featured ? "text-[13px] text-slate-600" : "text-xs text-slate-500"}>{item.desc}</div>
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
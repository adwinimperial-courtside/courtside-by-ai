import React from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, 
  Trophy, 
  Calendar, 
  Users, 
  Target, 
  User,
  GitBranch,
  Clock,
  RefreshCw
} from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function Landing() {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const role = currentUser?.user_type;
  const firstName = currentUser?.full_name?.split(" ")[0] || null;

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
      { icon: Users, color: "#3B82F6", bg: "bg-blue-100", title: "League users", subtitle: "Manage members", href: "/leagueusers" },
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {getQuickCards().map((card, idx) => {
                const Icon = card.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => window.location.href = card.href}
                    className="flex items-center gap-3 sm:flex-col sm:items-start rounded-xl p-3 sm:p-4 text-left transition-all hover:opacity-80 min-h-[44px]"
                    style={{ backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
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
              { number: "270+", label: "Games logged" },
              { number: "20+", label: "Leagues" },
              { number: "200+", label: "Users" },
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
            {[
              {
                icon: GitBranch,
                bg: "bg-green-100",
                color: "#16A34A",
                title: "Bracket-based standings",
                desc: "Split your league into groups with separate standings per bracket",
              },
              {
                icon: Clock,
                bg: "bg-blue-100",
                color: "#3B82F6",
                title: "Per-period game rules",
                desc: "Set different time, timeouts, and foul limits per quarter or half",
              },
              {
                icon: RefreshCw,
                bg: "bg-amber-100",
                color: "#D97706",
                title: "Improved substitutions",
                desc: "Faster, more reliable live substitutions during games",
              },
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
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#FEF0E7", color: "#F26B1F" }}>
                    New
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
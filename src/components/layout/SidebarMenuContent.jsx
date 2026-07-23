import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Users, Calendar, BarChart3, Settings, Medal, Target, ClipboardList, Shield, Eye, Layout, ScrollText, UserCog, LineChart, UserCircle, Trash2, HardDrive, Wrench, Link2, SlidersHorizontal, Newspaper, UserPlus, PlusCircle, MessageSquare, Settings2, MonitorPlay, ListOrdered, Home, HelpCircle } from "lucide-react";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const navigationItems = [
  {
    title: "Leagues",
    url: createPageUrl("Leagues"),
    icon: Trophy
  },
  {
    title: "Teams",
    url: createPageUrl("Teams"),
    icon: Users
  },
  {
    title: "Schedule",
    url: createPageUrl("Schedule"),
    icon: Calendar
  },
  {
    title: "Standings",
    url: createPageUrl("Standings"),
    icon: Trophy
  },
  {
    title: "Statistics",
    url: createPageUrl("Statistics"),
    icon: BarChart3
  },
  {
    title: "Award Leaders",
    url: createPageUrl("AwardLeaders"),
    icon: Medal
  },
  {
    title: "Coach Insights",
    url: createPageUrl("CoachInsights"),
    icon: Target
  },
  {
    title: "Whiteboard",
    url: createPageUrl("Whiteboard"),
    icon: Layout
  }
  ];

const adminItems = [
  { title: "League Users", url: createPageUrl("LeagueUsers"), icon: Users },
  { title: "Game Log", url: createPageUrl("GameLog"), icon: ScrollText },
  { title: "Admin Tools", url: createPageUrl("AdminTools"), icon: Settings },
  { title: "Registration", url: createPageUrl("Registration"), icon: UserPlus },
  { title: "Award Settings", url: createPageUrl("LeagueAwardSettings"), icon: SlidersHorizontal },
  { title: "Story Builder", url: createPageUrl("StoryBuilder"), icon: Newspaper }
];

const overlayItem = {
  title: "Game Overlay",
  url: createPageUrl("GameOverlaySettings"),
  icon: MonitorPlay
};

const leagueAdminItems = [];

const ownerItems = [
  {
    title: "Command Center",
    url: createPageUrl("CommandCenter"),
    icon: MonitorPlay
  },
  {
    title: "User Requests",
    url: createPageUrl("RequestManagement"),
    icon: ClipboardList
  },
  {
    title: "Onboarding Bookings",
    url: createPageUrl("OnboardingBookings"),
    icon: Calendar
  },
  {
    title: "People",
    url: createPageUrl("People"),
    icon: Users
  },
  {
    title: "Analytics",
    url: createPageUrl("Analytics"),
    icon: LineChart
  },
  {
    title: "Feedback",
    url: createPageUrl("Feedback"),
    icon: MessageSquare
  },
  {
    title: "System",
    url: createPageUrl("System"),
    icon: Settings2
  },

  {
    title: "Reports",
    url: createPageUrl("Reports"),
    icon: BarChart3
  }
];

// Operations Admin (ops_admin): a lesser app-level helper role. Sees ONLY these four pages.
const opsItems = [
  { title: "User Requests", url: createPageUrl("RequestManagement"), icon: ClipboardList },
  { title: "Onboarding Bookings", url: createPageUrl("OnboardingBookings"), icon: Calendar },
  { title: "Command Center", url: createPageUrl("CommandCenter"), icon: MonitorPlay },
  { title: "Feedback", url: createPageUrl("Feedback"), icon: MessageSquare },
  { title: "Help Center", url: createPageUrl("HelpCenter"), icon: HelpCircle }
];

export default function SidebarMenuContent({ currentUser, location, isViewerWithoutAdminAccess }) {
  const { isMobile, setOpenMobile } = useSidebar();

  const { data: userApplications = [] } = useQuery({
    queryKey: ['userApplications'],
    queryFn: () => base44.entities.UserApplication.list(),
    enabled: currentUser?.user_type === 'app_admin',
    refetchInterval: 30000,
    staleTime: 0,
  });

  const pendingRequestsCount = userApplications.filter(r => r.status === 'Pending').length;

  const { data: onboardingBookings = [] } = useQuery({
    queryKey: ['onboardingBookings'],
    queryFn: () => base44.entities.OnboardingBooking.list(),
    enabled: currentUser?.user_type === 'app_admin' || currentUser?.user_type === 'ops_admin',
    refetchInterval: 30000,
    staleTime: 0,
  });
  const onboardingRequestsCount = onboardingBookings.filter(b => b.status === 'requested').length;

  const { data: leagueAdminReview } = useQuery({
    queryKey: ['review_requests_count'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getReviewRequests', {});
      return res?.data || res;
    },
    enabled: currentUser?.user_type === 'league_admin' || currentUser?.user_type === 'ops_admin',
    refetchInterval: 30000,
  });
  const leagueAdminPendingCount = (leagueAdminReview?.requests || []).length;
  const requestsBadgeCount = currentUser?.user_type === 'app_admin' ? pendingRequestsCount : leagueAdminPendingCount;

  const playerNavItem = {
    title: "Player Profile",
    url: createPageUrl("PlayerProfile"),
    icon: UserCircle
  };

  // COACH_ROSTER_MENU_V1
  const coachRosterNavItem = {
    title: "My Roster",
    url: createPageUrl("CoachRoster"),
    icon: ClipboardList
  };

  // COACH_MENU_GROUPS_V1: grouped sidebar shown ONLY when user_type === "coach".
  // Players, viewers, video_admins, and all admin roles keep the existing flat Navigation group.
  const coachMyTeamItems = [
    { title: "Home", url: "/", icon: Home }, // COACH_MENU_HOME_V1: coach landing page lives at the root route
    { title: "My Roster", url: createPageUrl("CoachRoster"), icon: ClipboardList },
    { title: "Coach Insights", url: createPageUrl("CoachInsights"), icon: Target },
    { title: "Whiteboard", url: createPageUrl("Whiteboard"), icon: Layout },
    { title: "My Player Profile", url: createPageUrl("PlayerProfile"), icon: UserCircle }
  ];

  const coachLeagueItems = [
    { title: "Schedule", url: createPageUrl("Schedule"), icon: Calendar },
    { title: "Standings", url: createPageUrl("Standings"), icon: ListOrdered },
    { title: "Statistics", url: createPageUrl("Statistics"), icon: BarChart3 },
    { title: "Award Leaders", url: createPageUrl("AwardLeaders"), icon: Medal },
    { title: "Teams", url: createPageUrl("Teams"), icon: Users },
    { title: "Leagues", url: createPageUrl("Leagues"), icon: Trophy }
  ];

  const coachRequestItem = { title: "Request League Access", url: createPageUrl("ApplyForLeague"), icon: PlusCircle };

  // COACH_MENU_GROUPS_V1: shared renderer so coach groups match existing menu item styling exactly
  const renderCoachNavItem = (item) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        asChild
        className={`hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 rounded-lg mb-1 ${
          location.pathname === item.url ? 'bg-orange-50 text-orange-600 font-semibold' : ''
        }`}
      >
        <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5" onClick={handleNavigationClick}>
          <item.icon className="w-5 h-5" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const getVisibleNavigationItems = () => {
      if (!currentUser) return navigationItems;
      // LEAGUE_ADMIN_NAV_V1: task-ordered menu for league admins only.
      // Home first, weekly pages next, setup pages lower, distinct Standings icon.
      // Request League Access is intentionally NOT appended here — it renders
      // at the bottom of the sidebar for league admins (see LEAGUE_ADMIN_REQUEST_BOTTOM_V1).
      if (currentUser.user_type === "league_admin") {
        return [
          { title: "Home", url: "/", icon: Home },
          { title: "Schedule", url: createPageUrl("Schedule"), icon: Calendar },
          { title: "Standings", url: createPageUrl("Standings"), icon: ListOrdered },
          { title: "Statistics", url: createPageUrl("Statistics"), icon: BarChart3 },
          { title: "Award Leaders", url: createPageUrl("AwardLeaders"), icon: Medal },
          { title: "Teams", url: createPageUrl("Teams"), icon: Users },
          { title: "Leagues", url: createPageUrl("Leagues"), icon: Trophy },
          { title: "Coach Insights", url: createPageUrl("CoachInsights"), icon: Target },
          { title: "Whiteboard", url: createPageUrl("Whiteboard"), icon: Layout },
          { title: "Help Center", url: createPageUrl("HelpCenter"), icon: HelpCircle }
        ];
      }
      const base = (currentUser.user_type === "viewer" || currentUser.user_type === "video_admin")
        ? navigationItems.filter(item => !["Leagues", "Teams", "Coach Insights", "Whiteboard"].includes(item.title))
        : currentUser.user_type === "player"
          ? navigationItems.filter(item => item.title !== "Coach Insights") // PLAYER_MENU_TRIM_V1: Coach Insights is a coach/staff tool
          : navigationItems;
      const withRole = (currentUser.user_type === "player" || currentUser.user_type === "coach")
        ? [playerNavItem, ...base]
        : base;
      // COACH_ROSTER_MENU_V1: coaches also get a direct link to their roster editor.
      // ADMIN_COACH_MENU_V1: so do users of any other role (e.g. league admins) who
      // also coach a team somewhere - detected via a "coach" entry in their per-league
      // role map (written by the People page and by coach approvals).
      const coachesSomewhere = currentUser.user_type === "coach"
        || Object.values(currentUser.league_role_map || {}).includes("coach");
      const withCoach = coachesSomewhere
        ? [coachRosterNavItem, ...withRole]
        : withRole;
      // Add "Request League Access" for all approved non-admin users (not staff roles)
      if (currentUser.user_type && currentUser.user_type !== "app_admin" && currentUser.user_type !== "ops_admin") {
        return [...withCoach, { title: "Request League Access", url: createPageUrl("ApplyForLeague"), icon: PlusCircle }, { title: "Help Center", url: createPageUrl("HelpCenter"), icon: HelpCircle }];
      }
      return [...withCoach, { title: "Help Center", url: createPageUrl("HelpCenter"), icon: HelpCircle }];
    };

  const getVisibleAdminItems = () => {
    if (!currentUser) return [];
    if (currentUser.user_type === "app_admin") return [...adminItems, ...leagueAdminItems];
    if (currentUser.user_type === "league_admin") return [{ title: "User Requests", url: createPageUrl("RequestManagement"), icon: ClipboardList }, ...adminItems, ...leagueAdminItems];
    return [];
  };

  const getVisibleVideoAdminItems = () => {
    if (!currentUser) return [];
    if (
      currentUser.user_type === "app_admin" ||
      currentUser.user_type === "league_admin" ||
      currentUser.user_type === "video_admin"
    ) return [overlayItem];
    return [];
  };

  const getVisibleOwnerItems = () => {
    if (!currentUser) return [];
    if (currentUser.user_type === "app_admin") return ownerItems;
    return [];
  };

  const getVisibleOpsItems = () => {
    if (!currentUser) return [];
    if (currentUser.user_type === "ops_admin") return opsItems;
    return [];
  };

  const handleNavigationClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarContent className="p-3">
      {currentUser?.user_type === "coach" ? (
        <>
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
              My Team
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {coachMyTeamItems.map(renderCoachNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
              League
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {coachLeagueItems.map(renderCoachNavItem)}
                <div className="border-t border-slate-200 my-2 mx-3" />
                {renderCoachNavItem(coachRequestItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </>
      ) : (
      <SidebarGroup>
        <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
          Navigation
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {getVisibleNavigationItems().map((item) =>
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  className={`hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 rounded-lg mb-1 ${
                    location.pathname === item.url ? 'bg-orange-50 text-orange-600 font-semibold' : ''
                  }`}
                >
                  <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5" onClick={handleNavigationClick}>
                    <item.icon className="w-5 h-5" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      )}

      {getVisibleAdminItems().length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
            Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {getVisibleAdminItems().map((item) =>
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={`hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 rounded-lg mb-1 ${
                      location.pathname === item.url ? 'bg-orange-50 text-orange-600 font-semibold' : ''
                    }`}
                  >
                    <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5" onClick={handleNavigationClick}>
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                      {item.title === "User Requests" && requestsBadgeCount > 0 && (
                        <Badge className="ml-auto bg-orange-500 text-white">{requestsBadgeCount}</Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {getVisibleVideoAdminItems().length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
            Video Admin
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {getVisibleVideoAdminItems().map((item) =>
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={`hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 rounded-lg mb-1 ${
                      location.pathname === item.url ? 'bg-orange-50 text-orange-600 font-semibold' : ''
                    }`}
                  >
                    <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5" onClick={handleNavigationClick}>
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {currentUser?.user_type === "league_admin" && (
        <SidebarGroup>
          {/* LEAGUE_ADMIN_REQUEST_BOTTOM_V1: rarely-used action lives below the admin groups */}
          <SidebarGroupContent>
            <SidebarMenu>
              <div className="border-t border-slate-200 my-2 mx-3" />
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className={`hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 rounded-lg mb-1 ${
                    location.pathname === createPageUrl("ApplyForLeague") ? 'bg-orange-50 text-orange-600 font-semibold' : ''
                  }`}
                >
                  <Link to={createPageUrl("ApplyForLeague")} className="flex items-center gap-3 px-3 py-2.5" onClick={handleNavigationClick}>
                    <PlusCircle className="w-5 h-5" />
                    <span>Request League Access</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {getVisibleOwnerItems().length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
            Owner
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {getVisibleOwnerItems().map((item) =>
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={`hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 rounded-lg mb-1 ${
                      location.pathname === item.url ? 'bg-orange-50 text-orange-600 font-semibold' : ''
                    }`}
                  >
                    <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5" onClick={handleNavigationClick}>
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                      {item.title === "User Requests" && pendingRequestsCount > 0 && (
                        <Badge className="ml-auto bg-orange-500 text-white">{pendingRequestsCount}</Badge>
                      )}
                      {item.title === "Onboarding Bookings" && onboardingRequestsCount > 0 && (
                        <Badge className="ml-auto bg-orange-500 text-white">{onboardingRequestsCount}</Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {getVisibleOpsItems().length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
            Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {getVisibleOpsItems().map((item) =>
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={`hover:bg-orange-50 hover:text-orange-600 transition-all duration-200 rounded-lg mb-1 ${
                      location.pathname === item.url ? 'bg-orange-50 text-orange-600 font-semibold' : ''
                    }`}
                  >
                    <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5" onClick={handleNavigationClick}>
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                      {item.title === "User Requests" && leagueAdminPendingCount > 0 && (
                        <Badge className="ml-auto bg-orange-500 text-white">{leagueAdminPendingCount}</Badge>
                      )}
                      {item.title === "Onboarding Bookings" && onboardingRequestsCount > 0 && (
                        <Badge className="ml-auto bg-orange-500 text-white">{onboardingRequestsCount}</Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </SidebarContent>
  );
}
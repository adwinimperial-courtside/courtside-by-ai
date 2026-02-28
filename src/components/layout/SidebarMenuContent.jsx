import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Users, Calendar, BarChart3, Settings, Medal, Target, ClipboardList, Shield, Eye, Layout, ScrollText, UserCog } from "lucide-react";
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
  {
    title: "Admin Tools",
    url: createPageUrl("AdminTools"),
    icon: Settings
  }
];

const leagueAdminItems = [
  {
    title: "Game Log",
    url: createPageUrl("GameLog"),
    icon: ScrollText
  }
];

const ownerItems = [
  {
    title: "Requests",
    url: createPageUrl("RequestManagement"),
    icon: ClipboardList
  },
  {
    title: "User Management",
    url: createPageUrl("UserManagement"),
    icon: Users
  },
  {
    title: "User Roles",
    url: createPageUrl("UserRoles"),
    icon: UserCog
  }
];

export default function SidebarMenuContent({ currentUser, location, isViewerWithoutAdminAccess }) {
  const { isMobile, setOpenMobile } = useSidebar();

  const { data: userApplications = [] } = useQuery({
    queryKey: ['userApplications'],
    queryFn: () => base44.entities.UserApplication.list(),
    enabled: currentUser?.user_type === 'app_admin',
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: currentUser?.user_type === 'app_admin',
  });

  const pendingRequestsCount = userApplications.filter(r => r.status === 'Pending').length;
  const leagueOwnersCount = allUsers.filter(u => u.user_type === 'league_admin').length;
  const coachesCount = allUsers.filter(u => u.user_type === 'coach').length;
  const playersCount = allUsers.filter(u => u.user_type === 'player').length;
  const viewersCount = allUsers.filter(u => u.user_type === 'viewer').length;

  const getVisibleNavigationItems = () => {
      if (!currentUser) return navigationItems;
      if (currentUser.user_type === "viewer") {
        return navigationItems.filter(item => !["Leagues", "Teams", "Coach Insights", "Whiteboard"].includes(item.title));
      }
      if (currentUser.user_type === "app_admin") {
        return navigationItems;
      }
      return navigationItems;
    };

  const getVisibleAdminItems = () => {
    if (!currentUser) return [];
    if (currentUser.user_type === "app_admin") return [...adminItems, ...leagueAdminItems];
    if (currentUser.user_type === "league_admin") return leagueAdminItems;
    return [];
  };

  const getVisibleOwnerItems = () => {
    if (!currentUser) return [];
    if (currentUser.user_type === "app_admin") return ownerItems;
    return [];
  };

  const handleNavigationClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarContent className="p-3">
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

      {getVisibleAdminItems().length > 0 && (
        <>
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
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

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
                          {item.title === "Requests" && pendingRequestsCount > 0 && (
                            <Badge className="ml-auto bg-orange-500 text-white">{pendingRequestsCount}</Badge>
                          )}
                          {item.title === "League Owners" && leagueOwnersCount > 0 && (
                            <Badge className="ml-auto bg-blue-500 text-white">{leagueOwnersCount}</Badge>
                          )}
                          {item.title === "Coaches" && coachesCount > 0 && (
                            <Badge className="ml-auto bg-green-500 text-white">{coachesCount}</Badge>
                          )}
                          {item.title === "Players" && playersCount > 0 && (
                            <Badge className="ml-auto bg-indigo-500 text-white">{playersCount}</Badge>
                          )}
                          {item.title === "Viewers" && viewersCount > 0 && (
                            <Badge className="ml-auto bg-purple-500 text-white">{viewersCount}</Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </>
      )}
    </SidebarContent>
  );
}
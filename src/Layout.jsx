import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Shield, Eye, LogOut, Trophy, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger } from
"@/components/ui/sidebar";
import SidebarMenuContent from "@/components/layout/SidebarMenuContent";
import ApplyPendingAssignments from "@/components/admin/ApplyPendingAssignments";
import RegistrationGate from "@/components/registration/RegistrationGate";
import PlayerIdentityModal from "@/components/registration/PlayerIdentityModal";
import { createPageUrl } from "./utils";


export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlayerIdentity, setShowPlayerIdentity] = useState(false);
  const sessionStartTimeRef = useRef(null);
  const hasLoggedLoginEventRef = useRef(false);

  // Check if we're on the LiveGame page for full-screen mode
  const isLiveGamePage = location.pathname.toLowerCase().includes('livegame');

  useEffect(() => {
    // Redirect from old domain to new domain
    if (window.location.hostname === 'courtside-by-ai.base44.app') {
      window.location.href = 'https://courtside-by-ai.com' + window.location.pathname + window.location.search;
      return;
    }

    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);

        // Track login event (only once per session)
        if (user && !hasLoggedLoginEventRef.current) {
          base44.analytics.track({
            eventName: 'user_login',
            properties: {
              username: user.full_name,
              user_email: user.email,
              user_type: user.user_type || 'unknown'
            }
          });
          // Record login event via backend function (uses service role to bypass permissions)
          if (user.user_type !== 'app_admin') {
            base44.functions.invoke('recordLoginEvent', {}).catch(() => {});
          }
          hasLoggedLoginEventRef.current = true;
          sessionStartTimeRef.current = Date.now();
        }

        // Check if user has no assigned leagues and redirect to LeagueSelection (only for approved non-new users)
        if (user && user.user_type !== "user" && user.application_status === "Approved" && (!user.assigned_league_ids || user.assigned_league_ids.length === 0)) {
          const leagueSelectionPath = createPageUrl('LeagueSelection');
          if (!location.pathname.includes('LeagueSelection')) {
            navigate(leagueSelectionPath, { replace: true });
          }
        }

        // Check if player needs to complete identity
        if (user && user.user_type === "player" && user.application_status === "Approved" && !user.display_name) {
          setShowPlayerIdentity(true);
        }


      } catch (error) {
        console.error("Failed to fetch user:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [navigate, location.pathname]);

  // Track page navigation (exclude app_admin) - debounced to avoid rate limiting
  useEffect(() => {
    if (!currentUser || currentUser.user_type === 'app_admin') return;
    
    const timer = setTimeout(() => {
      const pageName = location.pathname.split('/').filter(Boolean)[0] || 'Home';
      base44.analytics.track({
        eventName: 'page_navigation',
        properties: {
          username: currentUser.full_name,
          user_email: currentUser.email,
          page: pageName,
          user_type: currentUser.user_type
        }
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [location.pathname, currentUser]);

  // Track user activity periodically to show live visitors
  useEffect(() => {
    if (!currentUser || currentUser.user_type === 'app_admin') return;

    const interval = setInterval(() => {
      base44.analytics.track({
        eventName: 'user_active',
        properties: {
          username: currentUser.full_name,
          user_email: currentUser.email,
          user_type: currentUser.user_type
        }
      });
    }, 30000); // Track every 30 seconds

    return () => clearInterval(interval);
  }, [currentUser]);

  // Track session duration on logout or page unload
  useEffect(() => {
    const handleLogout = () => {
      if (sessionStartTimeRef.current && currentUser && currentUser.user_type !== 'app_admin') {
        const sessionDuration = Math.round((Date.now() - sessionStartTimeRef.current) / 1000); // in seconds
        base44.analytics.track({
          eventName: 'user_session_end',
          properties: {
            username: currentUser.full_name,
            user_email: currentUser.email,
            session_duration_seconds: sessionDuration,
            session_duration_minutes: Math.round(sessionDuration / 60)
          }
        });
      }
    };

    window.addEventListener('beforeunload', handleLogout);
    return () => window.removeEventListener('beforeunload', handleLogout);
  }, [currentUser]);

  const getUserTypeIcon = () => {
    if (!currentUser?.user_type) return null;
    if (currentUser.user_type === "app_admin") return <Shield className="w-4 h-4" />;
    if (currentUser.user_type === "league_admin") return <Trophy className="w-4 h-4" />;
    if (currentUser.user_type === "viewer") return <Eye className="w-4 h-4" />;
    return null;
  };

  const getUserTypeLabel = () => {
    if (!currentUser?.user_type) return "";
    return currentUser.user_type.replace("_", " ").toUpperCase();
  };



  const isViewerWithoutAdminAccess = currentUser?.user_type === "viewer";

  // Show RegistrationGate for new users who haven't applied yet, or whose application is pending/rejected
  const needsRegistration = currentUser && (
  currentUser.user_type === "user" ||
  currentUser.user_type !== "app_admin" &&
  currentUser.application_status !== "Approved" &&
  currentUser.application_status !== undefined);


  // More precisely: show gate if user_type is "user" (default) OR application_status is not Approved (and not app_admin)
  const showRegistrationGate = currentUser && (
  !currentUser.user_type || currentUser.user_type === "user") &&
  !isLiveGamePage;

  const handleLogout = () => {
    // Track session end before logging out
    if (sessionStartTimeRef.current && currentUser) {
      const sessionDuration = Math.round((Date.now() - sessionStartTimeRef.current) / 1000); // in seconds
      base44.analytics.track({
        eventName: 'user_session_end',
        properties: {
          username: currentUser.full_name,
          user_email: currentUser.email,
          session_duration_seconds: sessionDuration,
          session_duration_minutes: Math.round(sessionDuration / 60)
        }
      });
    }
    base44.auth.logout('/');
  };

  // If we're on the LiveGame page, render without sidebar
  if (isLiveGamePage) {
    return (
      <>
        <ApplyPendingAssignments />
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100">
          {children}
        </div>
      </>);

  }

  // Show registration gate for new users
  if (!isLoading && showRegistrationGate) {
    return <RegistrationGate user={currentUser} />;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <ApplyPendingAssignments />
      {showPlayerIdentity && (
        <PlayerIdentityModal
          user={currentUser}
          onComplete={() => setShowPlayerIdentity(false)}
        />
      )}
      <style>{`
        :root {
          --primary: 222.2 47.4% 11.2%;
          --primary-foreground: 210 40% 98%;
          --accent: 24.6 95% 53.1%;
          --accent-foreground: 0 0% 100%;
        }
      `}</style>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-slate-100">
        <Sidebar className="border-r border-slate-200 bg-white/80 backdrop-blur-sm">
          <SidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
                <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fa0e7f8bbf24ed563563de/ed79261c1_CourtSidebyAILOGO.png" alt="Courtside by AI" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Courtside by AI</h2>
                <p className="text-xs text-slate-500">Numbers Don’t Lie</p>
              </div>
            </div>

            {!isLoading && currentUser &&
            <div className="space-y-3">
                <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
                  {getUserTypeIcon()}
                  <span className="text-xs font-semibold text-slate-700">{getUserTypeLabel()}</span>
                </div>
                <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full text-slate-700 hover:text-red-600 hover:border-red-300 hover:bg-red-50"
                size="sm">

                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
                <p className="text-center text-xs text-slate-400 pt-1">
                  Support:{" "}
                  <a href="mailto:info@courtside-by-ai.com" className="text-slate-500 hover:text-orange-500 transition-colors">
                    info@courtside-by-ai.com
                  </a>
                </p>
              </div>
            }
          </SidebarHeader>

          <SidebarMenuContent
            currentUser={currentUser}
            location={location}
            isViewerWithoutAdminAccess={isViewerWithoutAdminAccess} />

        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-4 md:hidden sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger asChild>
                <button className="hover:bg-orange-100 p-2 h-12 w-12 rounded-xl transition-colors flex items-center justify-center">
                  <Circle className="w-6 h-6 text-orange-500 fill-orange-500" />
                </button>
              </SidebarTrigger>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                  <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fa0e7f8bbf24ed563563de/ed79261c1_CourtSidebyAILOGO.png" alt="Courtside by AI" className="w-full h-full object-cover" />
                </div>
                <h1 className="text-lg font-bold text-slate-900">Courtside by AI</h1>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>);

}
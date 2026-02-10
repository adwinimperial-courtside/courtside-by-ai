import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Shield, Eye, LogOut, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger } from
"@/components/ui/sidebar";
import SidebarMenuContent from "@/components/layout/SidebarMenuContent";


export default function Layout({ children }) {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error("Failed to fetch user:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

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

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <SidebarProvider>
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
                <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fa0e7f8bbf24ed563563de/6117099c8_image.png" alt="Courtside by AI" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Courtside by AI</h2>
                <p className="text-xs text-slate-500">Pro League Manager</p>
              </div>
            </div>

            {!isLoading && currentUser && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
                  {getUserTypeIcon()}
                  <span className="text-xs font-semibold text-slate-700">{getUserTypeLabel()}</span>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full text-slate-700 hover:text-red-600 hover:border-red-300 hover:bg-red-50"
                  size="sm"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            )}
          </SidebarHeader>

          <SidebarMenuContent 
            currentUser={currentUser} 
            location={location} 
            isViewerWithoutAdminAccess={isViewerWithoutAdminAccess}
          />
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-4 md:hidden sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                  <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fa0e7f8bbf24ed563563de/6117099c8_image.png" alt="Courtside by AI" className="w-full h-full object-cover" />
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
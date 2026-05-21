import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Key } from "lucide-react";
import EnhancedUserManagement from "@/components/admin/EnhancedUserManagement";
import PlayerIdentityAdmin from "@/components/admin/PlayerIdentityAdmin";
import UserRoles from "./UserRoles";
import AllPlayersView from "./AllPlayersView";
import RosterUserMatching from "./RosterUserMatching";

export default function People() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  if (currentUser && currentUser.user_type !== "app_admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center max-w-sm">
          <Key className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">People</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage users, roles and player rosters</p>
          </div>
        </div>

        <Tabs defaultValue="users">
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="flex items-center gap-2">
              Users
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2">
              Roles
            </TabsTrigger>
            <TabsTrigger value="players" className="flex items-center gap-2">
              Players
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Users */}
          <TabsContent value="users">
            <EnhancedUserManagement />
          </TabsContent>

          {/* TAB 2: Roles */}
          <TabsContent value="roles">
            <UserRoles />
          </TabsContent>

          {/* TAB 3: Players (with sub-tabs) */}
          <TabsContent value="players">
            <Tabs defaultValue="all-players">
              <TabsList className="mb-4 h-9">
                <TabsTrigger value="all-players" className="text-sm">All Players (Roster)</TabsTrigger>
                <TabsTrigger value="identity-admin" className="text-sm">Identity Admin (Accounts)</TabsTrigger>
                <TabsTrigger value="roster-matching" className="text-sm">Roster Matching</TabsTrigger>
              </TabsList>

              <TabsContent value="all-players">
                <p className="text-xs text-slate-400 mb-3">Roster slots — some may not have a linked user account yet</p>
                <AllPlayersView />
              </TabsContent>

              <TabsContent value="identity-admin">
                <p className="text-xs text-slate-400 mb-3">Link player accounts to their roster entries one by one</p>
                <PlayerIdentityAdmin />
              </TabsContent>

              <TabsContent value="roster-matching">
                <p className="text-xs text-slate-400 mb-3">Bulk-copy player identities from one league to another</p>
                <RosterUserMatching />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
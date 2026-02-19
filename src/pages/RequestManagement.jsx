import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ClipboardList, Key } from "lucide-react";
import UserApplicationsReview from "../components/admin/UserApplicationsReview";

export default function RequestManagement() {
  const [currentUser, setCurrentUser] = useState(null);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };
    fetchUser();
  }, []);

  if (currentUser && currentUser.user_type !== "app_admin") {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardList className="w-8 h-8 text-orange-600" />
            <h1 className="text-3xl font-bold text-slate-900">New User Applications</h1>
          </div>
          <p className="text-slate-600">Review and manage new user role applications</p>
        </div>

        <UserApplicationsReview />
      </div>
    </div>
  );
}
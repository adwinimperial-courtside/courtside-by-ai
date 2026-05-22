import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Mail, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function NoLeagueUsers() {
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState(false);
  const [sendingIds, setSendingIds] = useState({}); // { [userId]: true }
  const [successIds, setSuccessIds] = useState({}); // { [userId]: true }

  const { data, isLoading } = useQuery({
    queryKey: ["noLeagueUsers"],
    queryFn: () => base44.functions.invoke("getNoLeagueUsers", {}),
    staleTime: 30000,
  });

  const noLeagueUsers = data?.data?.users || data?.users || [];

  const handleSendAll = async () => {
    if (noLeagueUsers.length === 0) return;
    setBulkSending(true);
    setBulkSuccess(false);
    await base44.functions.invoke("sendNoLeagueReminderEmail", {
      userIds: noLeagueUsers.map((u) => u.id),
    });
    setBulkSending(false);
    setBulkSuccess(true);
    setTimeout(() => setBulkSuccess(false), 4000);
  };

  const handleSendOne = async (userId) => {
    setSendingIds((prev) => ({ ...prev, [userId]: true }));
    setSuccessIds((prev) => ({ ...prev, [userId]: false }));
    await base44.functions.invoke("sendNoLeagueReminderEmail", {
      userIds: [userId],
    });
    setSendingIds((prev) => ({ ...prev, [userId]: false }));
    setSuccessIds((prev) => ({ ...prev, [userId]: true }));
    setTimeout(() => setSuccessIds((prev) => ({ ...prev, [userId]: false })), 4000);
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const roleColors = {
    player: "bg-blue-100 text-blue-800",
    coach: "bg-purple-100 text-purple-800",
    viewer: "bg-slate-100 text-slate-700",
    league_admin: "bg-green-100 text-green-800",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (noLeagueUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <CheckCircle className="w-12 h-12 text-green-500" />
        <p className="text-lg font-semibold text-slate-700">
          All approved users have leagues assigned. 🎉
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
        <p className="text-sm font-medium text-amber-900">
          <span className="text-lg font-bold">{noLeagueUsers.length}</span>{" "}
          {noLeagueUsers.length === 1 ? "user has" : "users have"} no league assigned
        </p>
        <Button
          onClick={handleSendAll}
          disabled={bulkSending || bulkSuccess}
          className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
          size="sm"
        >
          {bulkSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : bulkSuccess ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          {bulkSending ? "Sending..." : bulkSuccess ? "✓ Reminders sent!" : "Send Reminder to All"}
        </Button>
      </div>

      {/* User list */}
      <div className="space-y-2">
        {noLeagueUsers.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                {getInitials(user.full_name)}
              </div>
              <div>
                <div className="font-semibold text-slate-900 text-sm">{user.full_name}</div>
                <div className="text-xs text-slate-500">{user.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={roleColors[user.user_type] || roleColors.viewer}>
                {user.user_type || "viewer"}
              </Badge>
              <span className="text-xs text-slate-400 hidden sm:block">
                {user.created_date ? format(new Date(user.created_date), "MMM d, yyyy") : "—"}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={sendingIds[user.id] || successIds[user.id]}
                onClick={() => handleSendOne(user.id)}
                className="gap-1.5 text-xs"
              >
                {sendingIds[user.id] ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : successIds[user.id] ? (
                  <CheckCircle className="w-3 h-3 text-green-600" />
                ) : (
                  <Mail className="w-3 h-3" />
                )}
                {successIds[user.id] ? "Sent!" : "Send Reminder"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
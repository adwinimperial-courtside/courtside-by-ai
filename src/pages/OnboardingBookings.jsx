import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Mail, Check, X, Clock, Key } from "lucide-react";

const STATUS_STYLES = {
  requested: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};

function formatRequested(dt) {
  if (!dt) return "—";
  const [datePart, timePart] = String(dt).split("T");
  if (!datePart) return dt;
  const [y, m, d] = datePart.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const date = `${months[(m || 1) - 1]} ${d}, ${y}`;
  return timePart ? `${date} · ${timePart}` : date;
}

export default function OnboardingBookings() {
  const [currentUser, setCurrentUser] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [notesDraft, setNotesDraft] = useState({});

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: bookings = [], isLoading, refetch } = useQuery({
    queryKey: ["onboarding_bookings"],
    queryFn: () => base44.entities.OnboardingBooking.list("-created_date", 200),
    enabled: currentUser?.user_type === "app_admin",
  });

  const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const setStatus = async (booking, status) => {
    setSavingId(booking.id);
    try {
      const patch = { status };
      if (status === "confirmed") {
        patch.confirmed_at = new Date().toISOString();
        patch.confirmed_by = currentUser?.email || "";
      }
      await base44.entities.OnboardingBooking.update(booking.id, patch);
      await refetch();
    } catch (e) {
      alert("Failed to update status: " + e.message);
    } finally {
      setSavingId(null);
    }
  };

  const saveNotes = async (booking) => {
    const notes = notesDraft[booking.id] ?? booking.admin_notes ?? "";
    setSavingId(booking.id);
    try {
      await base44.entities.OnboardingBooking.update(booking.id, { admin_notes: notes });
      await refetch();
    } catch (e) {
      alert("Failed to save notes: " + e.message);
    } finally {
      setSavingId(null);
    }
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Onboarding Bookings</h1>
            <p className="text-slate-500 text-sm mt-0.5">New-league onboarding & demo call requests. Reply by email to confirm. Your timezone: {viewerTz}</p>
          </div>
        </div>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Requests</CardTitle>
              <Badge className="bg-slate-100 text-slate-700 text-base px-3 py-1">{bookings.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <p className="text-slate-500 text-center py-8">Loading…</p>
            ) : bookings.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No onboarding call requests yet.</p>
            ) : (
              <div className="space-y-4">
                {bookings.map((b) => {
                  const busy = savingId === b.id;
                  const status = b.status || "requested";
                  return (
                    <div key={b.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="font-semibold text-slate-900">{b.user_name || "—"}</div>
                          <div className="text-sm text-slate-600">{b.user_email}</div>
                          <div className="text-sm text-slate-500 mt-0.5">League: <span className="font-medium text-slate-700">{b.league_name || "—"}</span></div>
                        </div>
                        <Badge variant="outline" className={STATUS_STYLES[status] || STATUS_STYLES.requested}>{status}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-700 mb-3">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{formatRequested(b.requested_datetime)}</span>
                        <span className="text-slate-500">({b.requested_timezone || "tz unknown"} — applicant's local time)</span>
                      </div>
                      <textarea
                        className="w-full text-sm border border-slate-200 rounded-lg p-2 mb-3"
                        rows={2}
                        placeholder="Internal notes…"
                        value={notesDraft[b.id] ?? b.admin_notes ?? ""}
                        onChange={(e) => setNotesDraft((prev) => ({ ...prev, [b.id]: e.target.value }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        <a href={`mailto:${b.user_email}?subject=${encodeURIComponent("Your Courtside onboarding call")}`}>
                          <Button size="sm" variant="outline"><Mail className="w-4 h-4 mr-1" />Email</Button>
                        </a>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => saveNotes(b)}>Save notes</Button>
                        <Button size="sm" disabled={busy} className="bg-blue-600 hover:bg-blue-700" onClick={() => setStatus(b, "confirmed")}><Check className="w-4 h-4 mr-1" />Confirm</Button>
                        <Button size="sm" disabled={busy} className="bg-green-600 hover:bg-green-700" onClick={() => setStatus(b, "completed")}>Completed</Button>
                        <Button size="sm" variant="outline" disabled={busy} className="text-red-600 hover:bg-red-50 border-red-300" onClick={() => setStatus(b, "cancelled")}><X className="w-4 h-4 mr-1" />Cancel</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Users, CalendarClock, Link2, ArrowRight, Inbox } from "lucide-react";

// TEAM_REGISTRATIONS_V1 - read-only organizer view of who has asked to enter a
// team in an open-registration season. Approving still happens on User Requests;
// this page is the organizer's picture of how the season is filling up.

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function StatTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="flex-1 min-w-[150px] bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-slate-400 mb-1.5">
        <Icon className="w-4 h-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

export default function TeamRegistrations() {
  const [selectedLeagueId, setSelectedLeagueId] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ["user"],
    queryFn: () => base44.auth.me(),
    initialData: null,
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
  });

  const isAppAdmin = currentUser?.user_type === "app_admin";
  const isLeagueAdmin = currentUser?.user_type === "league_admin";
  const myLeagues = isAppAdmin
    ? leagues
    : isLeagueAdmin
    ? leagues.filter((l) => (currentUser?.assigned_league_ids || []).includes(l.id))
    : [];

  useEffect(() => {
    if (!selectedLeagueId && myLeagues.length === 1) {
      setSelectedLeagueId(myLeagues[0].id);
    }
  }, [myLeagues, selectedLeagueId]);

  const selectedLeague = myLeagues.find((l) => l.id === selectedLeagueId) || null;

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["teamRegTeams", selectedLeagueId],
    queryFn: () => base44.entities.Team.filter({ league_id: selectedLeagueId }),
    enabled: !!selectedLeagueId,
  });

  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ["teamRegApps", selectedLeagueId],
    queryFn: () =>
      base44.entities.UserApplication.filter({
        league_id: selectedLeagueId,
        requested_role: "coach",
        status: "Pending",
      }),
    enabled: !!selectedLeagueId,
  });

  const loading = teamsLoading || appsLoading;
  const slots = selectedLeague?.team_slots;
  const isOpenSeason = selectedLeague?.registration_mode === "open";

  if (currentUser && !isAppAdmin && !isLeagueAdmin) {
    return <div className="p-8 text-center text-slate-500">You do not have access to this page.</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6" data-marker="TEAM_REGISTRATIONS_V1">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0B1F3A] flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Registrations</h1>
          <p className="text-sm text-slate-500">Who has asked to enter a team, and how the season is filling up</p>
        </div>
      </div>

      <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId}>
        <SelectTrigger className="w-full md:w-96 bg-white">
          <SelectValue placeholder="Select a season" />
        </SelectTrigger>
        <SelectContent>
          {myLeagues.map((l) => (
            <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedLeague && !isOpenSeason && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
          This season is set to <span className="font-medium">I add the teams myself</span>, so coaches cannot apply
          through a link. Teams you add here get an invite code on the Registration page instead.
        </div>
      )}

      {selectedLeague && (
        <div className="flex flex-wrap gap-3">
          <StatTile
            icon={Users}
            label="Teams in"
            value={slots ? teams.length + " of " + slots : String(teams.length)}
            hint={slots ? "Target set on the season" : "No target set"}
          />
          <StatTile
            icon={Inbox}
            label="Waiting"
            value={String(applications.length)}
            hint="Coach applications to review"
          />
          <StatTile
            icon={CalendarClock}
            label="Signup closes"
            value={formatDate(selectedLeague.registration_deadline)}
            hint="Last day coaches can apply"
          />
        </div>
      )}

      {selectedLeague && loading && <div className="text-sm text-slate-400 py-8 text-center">Loading...</div>}

      {selectedLeague && !loading && (
        <>
          <Card className="border-slate-200">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-slate-900">Waiting for your decision</h2>
              {applications.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-sm text-slate-500">No coach has applied yet.</p>
                  <Button asChild size="sm" variant="outline">
                    <Link to={createPageUrl("Registration")}>
                      <Link2 className="w-3.5 h-3.5 mr-1.5" />
                      Get the signup link
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-100">
                          <th className="py-2 font-medium">Coach</th>
                          <th className="py-2 font-medium">Team</th>
                          <th className="py-2 font-medium hidden md:table-cell">Message</th>
                          <th className="py-2 font-medium">Applied</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applications.map((a) => (
                          <tr key={a.id} className="border-b border-slate-50 align-top">
                            <td className="py-2.5 text-slate-900">
                              {a.user_name || "-"}
                              <div className="text-xs text-slate-400">{a.user_email}</div>
                            </td>
                            <td className="py-2.5 text-slate-700">
                              {a.requested_team_name || (a.team_id ? "Existing team" : "-")}
                            </td>
                            <td className="py-2.5 text-slate-500 text-xs hidden md:table-cell max-w-xs">
                              {a.organizer_note || "-"}
                            </td>
                            <td className="py-2.5 text-slate-500 text-xs whitespace-nowrap">
                              {formatDate(a.applied_at || a.created_date)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button asChild size="sm" className="bg-[#F26B1F] hover:bg-[#d95d16] text-white">
                    <Link to={createPageUrl("RequestManagement")}>
                      Review and approve
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-slate-900">Teams already in this season</h2>
              {teams.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No teams yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-100">
                        <th className="py-2 font-medium">Team</th>
                        <th className="py-2 font-medium">Head coach</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((t) => (
                        <tr key={t.id} className="border-b border-slate-50">
                          <td className="py-2.5 text-slate-900">{t.name}</td>
                          <td className="py-2.5 text-slate-500">{t.head_coach || "Not set"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
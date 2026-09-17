import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Users, CalendarClock, Link2, Inbox } from "lucide-react";
import HelpButton from "../components/help/HelpButton";
import UserApplicationsReview, { filterReviewRequests } from "../components/admin/UserApplicationsReview";

// TEAM_REGISTRATIONS_V1 - the organizer's picture of how the season is filling up.
// EMBEDDED_REVIEW_V1 - approving and declining now happen here too, through the
// same reviewer User Requests uses, so it is one screen for one job.

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

  // TEAM_REG_COUNT_V1 — the Waiting tile counts the rows the reviewer below
  // actually shows. Same query key and same server call as the reviewer, so
  // there is one request, one source, and the tile can never disagree with
  // the list underneath it.
  const { data: reviewData, isLoading: appsLoading } = useQuery({
    queryKey: ["review_requests"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getReviewRequests", {});
      return res?.data || res;
    },
    enabled: !!selectedLeagueId,
  });
  const applications = filterReviewRequests(reviewData?.requests || [], "coach", selectedLeagueId);

  const loading = teamsLoading || appsLoading;
  const slots = selectedLeague?.team_slots;
  // SLOT_TARGET_V1 — team_slots is a target, not a cap (D4 withdrawn), so once the
  // season is over target we show the plain count and explain it in the hint rather
  // than printing a reading like "10 of 6", which looks like a bug.
  const overTarget = slots ? Math.max(0, teams.length - slots) : 0;
  const teamsInValue = slots && !overTarget ? teams.length + " of " + slots : String(teams.length);
  const teamsInHint = !slots
    ? "No target set"
    : overTarget
      ? overTarget + " over the target of " + slots
      : "Target set on the season";
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
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-slate-900">Team Registrations</h1><HelpButton pageKey="teamregistrations" /></div>
          <p className="text-sm text-slate-500">Approve the coaches waiting, and see how the season is filling up</p>
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
            value={teamsInValue}
            hint={teamsInHint}
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
          {/* EMBEDDED_REVIEW_V1 — the real approve/decline, for coaches in this season only */}
          <div className="space-y-3">
            <UserApplicationsReview
              filterRole="coach"
              filterLeagueId={selectedLeagueId}
              title="Waiting for your decision"
              subtitle={"Coach applications for " + selectedLeague.name}
              emptyText="No coach has applied yet."
            />
            <div className="text-center">
              <Button asChild size="sm" variant="outline">
                <Link to={createPageUrl("Registration")}>
                  <Link2 className="w-3.5 h-3.5 mr-1.5" />
                  Get the signup link
                </Link>
              </Button>
            </div>
          </div>

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
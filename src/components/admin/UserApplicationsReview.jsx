import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

const ROLE_LABELS = {
  league_admin: "League Admin",
  coach: "Coach",
  player: "Player",
  viewer: "Viewer",
};

const ROLE_BADGE_COLORS = {
  league_admin: "bg-yellow-100 text-yellow-800 border-yellow-200",
  coach: "bg-blue-100 text-blue-800 border-blue-200",
  player: "bg-green-100 text-green-800 border-green-200",
  viewer: "bg-purple-100 text-purple-800 border-purple-200",
};

export default function UserApplicationsReview() {
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState(null);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['user_applications_pending'],
    queryFn: () => base44.asServiceRole.entities.UserApplication.filter({ status: "Pending" }),
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const handleApprove = async (application) => {
    const roleName = ROLE_LABELS[application.requested_role];
    const userName = application.user_name || application.user_email;
    if (!confirm(`Approve ${userName}'s application for ${roleName}?`)) return;

    setProcessingId(application.id);
    try {
      let assignedLeagueIds = [];

      if (application.requested_role === "league_admin") {
        // Create a new league from the application details
        const newLeague = await base44.asServiceRole.entities.League.create({
          name: application.league_name,
          season: application.season_start_date || "TBD",
        });
        assignedLeagueIds = [newLeague.id];
      } else if (application.league_id) {
        assignedLeagueIds = [application.league_id];
      }

      // Update user: grant role and mark approved
      await base44.asServiceRole.entities.User.update(application.user_id, {
        user_type: application.requested_role,
        application_status: "Approved",
        assigned_league_ids: assignedLeagueIds,
      });

      // Mark application as approved
      await base44.asServiceRole.entities.UserApplication.update(application.id, {
        status: "Approved",
      });

      queryClient.invalidateQueries({ queryKey: ['user_applications_pending'] });
      alert(`✅ Approved! ${application.requested_role === "league_admin" ? `League "${application.league_name}" has been created.` : ""}`);
    } catch (error) {
      alert("Failed to approve application: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (application) => {
    const userName = application.user_name || application.user_email;
    if (!confirm(`Reject ${userName}'s application?`)) return;

    setProcessingId(application.id);
    try {
      // Update user application_status only (keep user_type as "user")
      await base44.asServiceRole.entities.User.update(application.user_id, {
        application_status: "Rejected",
      });

      // Mark application as rejected
      await base44.asServiceRole.entities.UserApplication.update(application.id, {
        status: "Rejected",
      });

      queryClient.invalidateQueries({ queryKey: ['user_applications_pending'] });
    } catch (error) {
      alert("Failed to reject application: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Role Applications</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Review and approve user role requests</p>
          </div>
          <Badge className="bg-orange-100 text-orange-800 text-base px-3 py-1">
            {applications.length} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <p className="text-slate-500 text-center py-8">Loading applications...</p>
        ) : applications.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No pending role applications</p>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => {
              const league = leagues.find(l => l.id === app.league_id);
              const team = teams.find(t => t.id === app.team_id);
              const isProcessing = processingId === app.id;

              return (
                <div key={app.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-slate-900">{app.user_name || "N/A"}</div>
                      <div className="text-sm text-slate-600">{app.user_email}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Applied: {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "N/A"}
                      </div>
                    </div>
                    <Badge variant="outline" className={ROLE_BADGE_COLORS[app.requested_role]}>
                      {ROLE_LABELS[app.requested_role]}
                    </Badge>
                  </div>

                  {/* Application details */}
                  <div className="bg-white rounded-lg p-3 border border-slate-200 mb-3 text-sm space-y-1">
                    {app.requested_role === "league_admin" && (
                      <>
                        {app.country && <div><span className="text-slate-500">Country:</span> <span className="font-medium">{app.country}</span></div>}
                        {app.league_name && <div><span className="text-slate-500">League Name:</span> <span className="font-medium">{app.league_name}</span></div>}
                        {app.season_start_date && <div><span className="text-slate-500">Season Start:</span> <span className="font-medium">{app.season_start_date}</span></div>}
                        {app.number_of_teams && <div><span className="text-slate-500">Teams:</span> <span className="font-medium">{app.number_of_teams}</span></div>}
                        {app.avg_players_per_team && <div><span className="text-slate-500">Avg Players/Team:</span> <span className="font-medium">{app.avg_players_per_team}</span></div>}
                      </>
                    )}
                    {(app.requested_role === "coach" || app.requested_role === "viewer") && (
                      <div><span className="text-slate-500">League:</span> <span className="font-medium">{league?.name || app.league_id || "N/A"}</span></div>
                    )}
                    {app.requested_role === "player" && (
                      <>
                        <div><span className="text-slate-500">League:</span> <span className="font-medium">{league?.name || app.league_id || "N/A"}</span></div>
                        <div><span className="text-slate-500">Team:</span> <span className="font-medium">{team?.name || app.team_id || "N/A"}</span></div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(app)}
                      disabled={isProcessing}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleReject(app)}
                      disabled={isProcessing}
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50 border-red-300"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
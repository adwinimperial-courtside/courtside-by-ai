import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PlayerMatchModal from "./PlayerMatchModal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Lock } from "lucide-react";

// REVIEW_SCREEN_V2 per-league
const ROLE_LABELS = { league_admin: "League Admin", coach: "Coach", player: "Player", viewer: "Viewer" };
const ROLE_BADGE_COLORS = {
  league_admin: "bg-yellow-100 text-yellow-800 border-yellow-200",
  coach: "bg-blue-100 text-blue-800 border-blue-200",
  player: "bg-green-100 text-green-800 border-green-200",
  viewer: "bg-purple-100 text-purple-800 border-purple-200",
};

export default function UserApplicationsReview() {
  const queryClient = useQueryClient();
  const [processingAppId, setProcessingAppId] = useState(null);
  const [matchingApp, setMatchingApp] = useState(null);
  const [adminLeagueOverrides, setAdminLeagueOverrides] = useState({});
  const [actionError, setActionError] = useState(null);

  const { data: reviewData, isLoading } = useQuery({
    queryKey: ['review_requests'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getReviewRequests', {});
      return res?.data || res;
    },
  });
  const requests = reviewData?.requests || [];
  const isAppAdmin = reviewData?.role === 'app_admin';

  const { data: leagues = [] } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
    enabled: isAppAdmin,
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
    enabled: isAppAdmin,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['review_requests'] });

  const decide = async (app, action, leagueIds) => {
    if (action === 'reject' && !window.confirm(`Reject ${app.user_name || app.user_email}'s request for this league?`)) return;
    setActionError(null);
    setProcessingAppId(app.id);
    try {
      await base44.functions.invoke('approveUserApplication', { applicationId: app.id, action, league_ids: leagueIds });
      refresh();
    } catch (e) {
      setActionError((e && e.message) || 'Action failed');
    } finally {
      setProcessingAppId(null);
    }
  };

  const handleRejectWhole = async (app) => {
    if (!window.confirm(`Reject ${app.user_name || app.user_email}'s application?`)) return;
    setActionError(null);
    setProcessingAppId(app.id);
    try {
      await base44.functions.invoke('approveUserApplication', { applicationId: app.id, action: 'reject' });
      refresh();
    } catch (e) {
      setActionError((e && e.message) || 'Failed');
    } finally {
      setProcessingAppId(null);
    }
  };

  const handleApproveLeagueAdmin = async (app) => {
    if (!app.league_id && !app.league_name && !adminLeagueOverrides[app.id]) {
      setActionError('Select a league to assign this admin to before approving.');
      return;
    }
    setActionError(null);
    setProcessingAppId(app.id);
    try {
      const override = adminLeagueOverrides[app.id];
      await base44.functions.invoke('approveUserApplication', {
        applicationId: app.id, action: 'approve',
        ...(override ? { override_league_id: override } : {}),
      });
      refresh();
    } catch (e) {
      setActionError((e && e.message) || 'Failed');
    } finally {
      setProcessingAppId(null);
    }
  };

  const StatusPill = ({ decision, by }) => (
    <span className={`inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border ${decision === 'approved' ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
      {decision === 'approved' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      {decision === 'approved' ? 'Approved' : 'Rejected'}{by ? ` · ${by}` : ''}
    </span>
  );

  const renderPerLeague = (app) => {
    const role = app.requested_role;
    const lgs = app.leagues || [];
    const canDecide = app.can_decide || [];
    const busy = processingAppId === app.id;
    const total = lgs.length;
    const approved = lgs.filter(l => l.decision === 'approved').length;
    const pending = lgs.filter(l => l.decision === 'pending').length;
    return (
      <>
        {isAppAdmin && total > 1 && (
          <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1 mb-2">
            {approved} of {total} leagues approved · {pending} pending
          </div>
        )}
        <div className="border-t border-slate-200">
          {lgs.map((l) => {
            const decidable = canDecide.includes(l.league_id);
            return (
              <div key={l.league_id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-b-0">
                <div className="text-sm">
                  <span className="font-semibold text-slate-900">{l.league_name}</span>
                  {!isAppAdmin && <span className="ml-2 text-[11px] text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">your league</span>}
                  <span className="ml-2 text-xs text-slate-400">{ROLE_LABELS[role]}</span>
                </div>
                {decidable ? (
                  <div className="flex gap-2">
                    <Button onClick={() => decide(app, 'approve', [l.league_id])} disabled={busy} size="sm" className="bg-green-600 hover:bg-green-700"><Check className="w-4 h-4 mr-1" />Approve</Button>
                    <Button onClick={() => decide(app, 'reject', [l.league_id])} disabled={busy} size="sm" variant="outline" className="text-red-600 hover:bg-red-50 border-red-300"><X className="w-4 h-4 mr-1" />Reject</Button>
                  </div>
                ) : (
                  <StatusPill decision={l.decision} by={isAppAdmin ? l.decided_by_name : ''} />
                )}
              </div>
            );
          })}
        </div>
        {isAppAdmin && canDecide.length > 1 && (
          <div className="mt-3 flex justify-end">
            <Button onClick={() => decide(app, 'approve', canDecide)} disabled={busy} size="sm" className="bg-green-600 hover:bg-green-700">Approve all remaining</Button>
          </div>
        )}
        {!isAppAdmin && (
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />You only see requests for leagues you manage.</div>
        )}
      </>
    );
  };

  const renderPlayer = (app) => {
    const busy = processingAppId === app.id;
    return (
      <>
        <div className="bg-white rounded-lg p-3 border border-slate-200 mb-3 text-sm space-y-1">
          {app.display_name && <div><span className="text-slate-500">Display Name:</span> <span className="font-medium">{app.display_name}</span></div>}
          {app.handle && <div><span className="text-slate-500">Nickname:</span> <span className="font-medium">{app.handle}</span></div>}
          {app.country && <div><span className="text-slate-500">Country:</span> <span className="font-medium">{app.country}</span></div>}
          {(app.leagues || []).map((l, i) => (
            <div key={i}>
              <span className="text-slate-500">League:</span> <span className="font-medium">{l.league_name}</span>
              {" · "}<span className="text-slate-500">Team:</span> <span className="font-medium">{(l.team && l.team.team_name) || "N/A"}</span>
              {l.decision !== 'pending' && <span className="ml-2 text-xs text-slate-400">({l.decision})</span>}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setMatchingApp(app)} disabled={busy} size="sm" className="bg-green-600 hover:bg-green-700"><Check className="w-4 h-4 mr-1" />Approve</Button>
          <Button onClick={() => handleRejectWhole(app)} disabled={busy} size="sm" variant="outline" className="text-red-600 hover:bg-red-50 border-red-300"><X className="w-4 h-4 mr-1" />Reject</Button>
        </div>
      </>
    );
  };

  const renderLeagueAdminApp = (app) => {
    const busy = processingAppId === app.id;
    const joiningExisting = app.league_id && !app.league_name;
    return (
      <>
        <div className="bg-white rounded-lg p-3 border border-slate-200 mb-3 text-sm space-y-1">
          {app.country && <div><span className="text-slate-500">Country:</span> <span className="font-medium">{app.country}</span></div>}
          {joiningExisting ? (
            <div><span className="text-slate-500">Joining Existing League:</span> <span className="font-medium">{(leagues.find(l => l.id === app.league_id) || {}).name || app.league_id}</span></div>
          ) : app.league_name ? (
            <>
              <div><span className="text-slate-500">League Name:</span> <span className="font-medium">{app.league_name}</span></div>
              {app.season_start_date && <div><span className="text-slate-500">Season Start:</span> <span className="font-medium">{app.season_start_date}</span></div>}
              {app.number_of_teams && <div><span className="text-slate-500">Teams:</span> <span className="font-medium">{app.number_of_teams}</span></div>}
              {app.avg_players_per_team && <div><span className="text-slate-500">Avg Players/Team:</span> <span className="font-medium">{app.avg_players_per_team}</span></div>}
            </>
          ) : (
            <div className="space-y-1">
              <div className="text-amber-600 text-xs font-medium">No league specified — assign one before approving:</div>
              <Select value={adminLeagueOverrides[app.id] || ""} onValueChange={v => setAdminLeagueOverrides(prev => ({ ...prev, [app.id]: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select a league…" /></SelectTrigger>
                <SelectContent>{leagues.map(l => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleApproveLeagueAdmin(app)} disabled={busy} size="sm" className="bg-green-600 hover:bg-green-700"><Check className="w-4 h-4 mr-1" />Approve</Button>
          <Button onClick={() => handleRejectWhole(app)} disabled={busy} size="sm" variant="outline" className="text-red-600 hover:bg-red-50 border-red-300"><X className="w-4 h-4 mr-1" />Reject</Button>
        </div>
      </>
    );
  };

  return (
    <>
      {matchingApp && (
        <PlayerMatchModal
          application={matchingApp}
          leagues={leagues}
          teams={teams}
          onClose={() => setMatchingApp(null)}
          onApproved={() => { setMatchingApp(null); refresh(); }}
        />
      )}
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Role Applications</CardTitle>
              <p className="text-sm text-slate-600 mt-1">Review and approve user role requests{!isAppAdmin ? " for your leagues" : ""}</p>
            </div>
            <Badge className="bg-orange-100 text-orange-800 text-base px-3 py-1">{requests.length} pending</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {actionError && (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionError}</div>
          )}
          {isLoading ? (
            <p className="text-slate-500 text-center py-8">Loading applications...</p>
          ) : requests.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No pending role applications</p>
          ) : (
            <div className="space-y-4">
              {requests.map((app) => {
                const role = app.requested_role;
                return (
                  <div key={app.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-semibold text-slate-900">{app.user_name || "N/A"}</div>
                          {isAppAdmin && app.is_additional_request && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">+ Additional League</span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600">{app.user_email}</div>
                        {isAppAdmin && app.is_additional_request && app.current_user_type && (
                          <div className="text-xs text-slate-400 mt-0.5">Current role: {app.current_user_type.replace('_', ' ')}</div>
                        )}
                        <div className="text-xs text-slate-400 mt-1">Applied: {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "N/A"}</div>
                      </div>
                      <Badge variant="outline" className={ROLE_BADGE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>
                    </div>
                    {(role === 'coach' || role === 'viewer') && renderPerLeague(app)}
                    {role === 'player' && renderPlayer(app)}
                    {role === 'league_admin' && renderLeagueAdminApp(app)}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
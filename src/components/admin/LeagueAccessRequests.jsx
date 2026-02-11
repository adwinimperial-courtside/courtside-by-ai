import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, User } from "lucide-react";

export default function LeagueAccessRequests() {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const queryClient = useQueryClient();

  const { data: requests = [] } = useQuery({
    queryKey: ['leagueAccessRequests'],
    queryFn: () => base44.entities.LeagueAccessRequest.list('-created_date'),
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const approveMutation = useMutation({
    mutationFn: async (request) => {
      const user = users.find(u => u.id === request.user_id);
      
      await base44.asServiceRole.entities.User.update(request.user_id, {
        assigned_league_ids: request.requested_league_ids,
        user_type: "viewer"
      });

      await base44.entities.LeagueAccessRequest.update(request.id, {
        status: "approved"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagueAccessRequests'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedRequest(null);
    },
    onError: (error) => {
      alert('Failed to approve request: ' + error.message);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (requestId) => {
      await base44.entities.LeagueAccessRequest.update(requestId, {
        status: "rejected"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagueAccessRequests'] });
      setSelectedRequest(null);
    },
    onError: (error) => {
      alert('Failed to reject request: ' + error.message);
    }
  });

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  const getLeagueNames = (leagueIds) => {
    return leagueIds
      .map(id => leagues.find(l => l.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  if (selectedRequest) {
    return (
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-blue-50">
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Review Access Request
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">User</label>
              <div className="text-lg font-semibold text-slate-900">{selectedRequest.user_name}</div>
              <div className="text-sm text-slate-600">{selectedRequest.user_email}</div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Requested Leagues</label>
              <div className="mt-2 space-y-2">
                {selectedRequest.requested_league_ids.map(leagueId => {
                  const league = leagues.find(l => l.id === leagueId);
                  return league ? (
                    <div key={leagueId} className="bg-slate-50 p-3 rounded-lg">
                      <div className="font-medium text-slate-900">{league.name}</div>
                      <div className="text-sm text-slate-600">{league.season}</div>
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900">
                <strong>Action:</strong> Upon approval, this user will be assigned as a <strong>Viewer</strong> with access to the selected leagues.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => setSelectedRequest(null)}
              variant="outline"
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={() => rejectMutation.mutate(selectedRequest.id)}
              disabled={rejectMutation.isPending}
              variant="outline"
              className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={() => approveMutation.mutate(selectedRequest)}
              disabled={approveMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-orange-50">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            Pending Access Requests ({pendingRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {pendingRequests.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No pending requests</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map(request => (
                <div
                  key={request.id}
                  onClick={() => setSelectedRequest(request)}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border-2 border-transparent hover:border-orange-200"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{request.user_name}</div>
                    <div className="text-sm text-slate-600">{request.user_email}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      Leagues: {getLeagueNames(request.requested_league_ids)}
                    </div>
                  </div>
                  <Badge className="bg-orange-100 text-orange-800">Pending</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-slate-900">Processed Requests</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {processedRequests.map(request => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                >
                  <div>
                    <div className="font-semibold text-slate-900">{request.user_name}</div>
                    <div className="text-sm text-slate-600">{request.user_email}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      Leagues: {getLeagueNames(request.requested_league_ids)}
                    </div>
                  </div>
                  {request.status === 'approved' ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Approved
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800">
                      <XCircle className="w-3 h-3 mr-1" />
                      Rejected
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
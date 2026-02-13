import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Check, X } from "lucide-react";

export default function ApplicationAccess() {
  const queryClient = useQueryClient();

  const { data: requests = [] } = useQuery({
    queryKey: ['pendingUserAssignments'],
    queryFn: () => base44.entities.PendingUserAssignment.list(),
  });

  const { data: leagues = [] } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
  });

  const approveMutation = useMutation({
    mutationFn: (requestId) => base44.entities.PendingUserAssignment.update(requestId, { applied: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingUserAssignments'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (requestId) => base44.entities.PendingUserAssignment.delete(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingUserAssignments'] });
    },
  });

  const handleApprove = async (requestId) => {
    if (confirm('Approve this request?')) {
      approveMutation.mutate(requestId);
    }
  };

  const handleDecline = async (requestId) => {
    if (confirm('Decline and delete this request?')) {
      declineMutation.mutate(requestId);
    }
  };

  const getLeagueNames = (leagueIds) => {
    if (!leagueIds || leagueIds.length === 0) return 'No leagues assigned';
    return leagueIds.map(id => {
      const league = leagues.find(l => l.id === id);
      return league?.name || 'Unknown';
    }).join(', ');
  };

  const pendingRequests = requests.filter(r => !r.applied);

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Application Access</CardTitle>
            <p className="text-sm text-slate-600 mt-2">Pending user access requests</p>
          </div>
          <Badge className="bg-orange-100 text-orange-800 text-lg px-3 py-1">
            {pendingRequests.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {pendingRequests.length > 0 ? (
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-slate-900">{request.email}</div>
                      <div className="text-sm text-slate-700 mt-1">
                        <span className="font-medium">Role:</span> {request.user_type?.replace('_', ' ').toUpperCase()}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        <span className="font-medium">Leagues:</span> {getLeagueNames(request.assigned_league_ids)}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {new Date(request.created_date).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                      Pending
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(request.id)}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleDecline(request.id)}
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50 border-red-300"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">No pending requests</p>
        )}
      </CardContent>
    </Card>
  );
}
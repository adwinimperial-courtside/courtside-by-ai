import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

export default function ApplicationAccess() {
  const { data: requests = [] } = useQuery({
    queryKey: ['leagueAccessRequests'],
    queryFn: () => base44.entities.LeagueAccessRequest.list(),
  });

  const pendingRequests = requests.filter(r => r.status === 'pending');

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
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{request.user_name || 'N/A'}</div>
                    <div className="text-sm text-slate-600">{request.user_email}</div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {new Date(request.created_date).toLocaleString()}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                    Pending
                  </Badge>
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
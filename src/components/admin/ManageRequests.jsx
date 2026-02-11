import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, User, Calendar, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

export default function ManageRequests() {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const queryClient = useQueryClient();

  const { data: requests = [] } = useQuery({
    queryKey: ["leagueSetupRequests"],
    queryFn: () => base44.entities.LeagueSetupRequest.list("-created_date"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) =>
      base44.entities.LeagueSetupRequest.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leagueSetupRequests"] });
      setSelectedRequest(null);
    },
  });

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const doneRequests = requests.filter((r) => r.status === "done");

  if (selectedRequest) {
    return (
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Request Details</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRequest(null)}
            >
              Back
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-700 mb-1">
              League Name
            </div>
            <div className="text-lg text-slate-900">
              {selectedRequest.league_name}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-700 mb-1">
              Contact Person
            </div>
            <div className="text-slate-900">{selectedRequest.contact_person}</div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-700 mb-1">
              Email
            </div>
            <div className="text-slate-900">{selectedRequest.email}</div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-700 mb-1">
              Message
            </div>
            <div className="text-slate-900 bg-slate-50 p-4 rounded-lg border border-slate-200">
              {selectedRequest.message}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-700 mb-1">
              Submitted
            </div>
            <div className="text-slate-900">
              {format(new Date(selectedRequest.created_date), "PPpp")}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-700 mb-2">Status</div>
            <div className="flex items-center gap-2">
              <Badge
                className={
                  selectedRequest.status === "done"
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }
              >
                {selectedRequest.status}
              </Badge>
            </div>
          </div>

          {selectedRequest.status === "pending" && (
            <Button
              onClick={() =>
                updateStatusMutation.mutate({
                  id: selectedRequest.id,
                  status: "done",
                })
              }
              disabled={updateStatusMutation.isPending}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {updateStatusMutation.isPending
                ? "Updating..."
                : "Mark as Done"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-white">
        <CardTitle className="text-xl">League Setup Requests</CardTitle>
        <p className="text-sm text-slate-600 mt-2">
          Manage incoming league setup requests from the landing page
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Pending Requests */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-yellow-600" />
              <h3 className="font-semibold text-slate-900">
                Pending ({pendingRequests.length})
              </h3>
            </div>
            <div className="space-y-2">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
                  <Clock className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No pending requests</p>
                </div>
              ) : (
                pendingRequests.map((request) => (
                  <button
                    key={request.id}
                    onClick={() => setSelectedRequest(request)}
                    className="w-full p-4 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900 mb-1">
                          {request.league_name}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {request.contact_person}
                          </div>
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {request.email}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {format(new Date(request.created_date), "PPp")}
                        </div>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        Pending
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Done Requests */}
          {doneRequests.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-slate-900">
                  Completed ({doneRequests.length})
                </h3>
              </div>
              <div className="space-y-2">
                {doneRequests.map((request) => (
                  <button
                    key={request.id}
                    onClick={() => setSelectedRequest(request)}
                    className="w-full p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900 mb-1">
                          {request.league_name}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {request.contact_person}
                          </div>
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {request.email}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {format(new Date(request.created_date), "PPp")}
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800">Done</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
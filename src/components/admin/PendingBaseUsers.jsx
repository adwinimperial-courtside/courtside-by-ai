import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

export default function PendingBaseUsers() {
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState(null);

  const { data: { users: pendingUsers = [] } = {}, isLoading } = useQuery({
    queryKey: ['pending_base_users'],
    queryFn: async () => {
      const response = await base44.functions.invoke('approvePendingUser', { action: 'list' });
      return response.data;
    },
  });

  const handleApprove = async (userId, userEmail) => {
    if (!confirm(`Approve access for ${userEmail}?`)) return;

    setProcessingId(userId);
    try {
      await base44.functions.invoke('approvePendingUser', {
        userId,
        action: 'approve',
      });
      queryClient.invalidateQueries({ queryKey: ['pending_base_users'] });
      alert(`✅ Approved! ${userEmail} can now access the app.`);
    } catch (error) {
      alert("Failed to approve user: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (userId, userEmail) => {
    if (!confirm(`Reject access for ${userEmail}?`)) return;

    setProcessingId(userId);
    try {
      await base44.functions.invoke('approvePendingUser', {
        userId,
        action: 'reject',
      });
      queryClient.invalidateQueries({ queryKey: ['pending_base_users'] });
      alert(`❌ Rejected ${userEmail}.`);
    } catch (error) {
      alert("Failed to reject user: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Pending User Approvals</CardTitle>
            <p className="text-sm text-slate-600 mt-1">New users waiting for platform access</p>
          </div>
          <Badge className="bg-red-100 text-red-800 text-base px-3 py-1">
            {pendingUsers.length} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <p className="text-slate-500 text-center py-8">Loading users...</p>
        ) : pendingUsers.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No pending user approvals</p>
        ) : (
          <div className="space-y-4">
            {pendingUsers.map((user) => {
              const isProcessing = processingId === user.id;
              return (
                <div key={user.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold text-slate-900">{user.full_name || "N/A"}</div>
                      <div className="text-sm text-slate-600">{user.email}</div>
                    </div>
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                      Pending
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(user.id, user.email)}
                      disabled={isProcessing}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleReject(user.id, user.email)}
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
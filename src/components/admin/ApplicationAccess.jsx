import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Check, X } from "lucide-react";

export default function ApplicationAccess() {
  const queryClient = useQueryClient();

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: async () => {
      const response = await base44.asServiceRole.entities.User.list();
      return response;
    },
  });

  // Filter for users with status 'pending'
  const pendingUsers = allUsers.filter(user => user.status === 'pending');

  const handleApprove = async (userId) => {
    if (confirm('Approve this user?')) {
      try {
        await base44.asServiceRole.entities.User.update(userId, { status: 'active' });
        queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      } catch (error) {
        alert('Failed to approve user: ' + error.message);
      }
    }
  };

  const handleDecline = async (userId) => {
    if (confirm('Reject this user?')) {
      try {
        await base44.asServiceRole.entities.User.delete(userId);
        queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
      } catch (error) {
        alert('Failed to reject user: ' + error.message);
      }
    }
  };

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Application Access</CardTitle>
            <p className="text-sm text-slate-600 mt-2">Pending user access requests</p>
          </div>
          <Badge className="bg-orange-100 text-orange-800 text-lg px-3 py-1">
            {pendingUsers.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {pendingUsers.length > 0 ? (
          <div className="space-y-3">
            {pendingUsers.map((user) => (
              <div
                key={user.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-slate-900">{user.full_name || 'N/A'}</div>
                      <div className="text-sm text-slate-600">{user.email}</div>
                    </div>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                      Pending
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(user.id)}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleDecline(user.id)}
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50 border-red-300"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject
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
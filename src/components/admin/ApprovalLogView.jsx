import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

// APPROVAL_LOG_VIEW_V1
const ROLE_LABELS = { league_admin: "League Admin", coach: "Coach", player: "Player", viewer: "Viewer" };

export default function ApprovalLogView() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['approval_log'],
    queryFn: () => base44.entities.ApprovalLog.list('-created_date', 100),
    staleTime: 15000,
  });

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Approval Log</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Every approval and rejection, including those made by league admins</p>
          </div>
          <Badge className="bg-slate-100 text-slate-700 text-base px-3 py-1">{logs.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <p className="text-slate-500 text-center py-8">Loading log...</p>
        ) : logs.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No decisions logged yet</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => {
              const approved = log.decision === 'approved';
              return (
                <div key={log.id} className="flex items-center gap-3 py-3">
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${approved ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {approved ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900">
                      <span className="font-semibold capitalize">{log.decision}</span>
                      {" · "}{ROLE_LABELS[log.requested_role] || log.requested_role}
                      {" · "}<span className="font-medium">{log.league_name || log.league_id}</span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {log.applicant_name || log.applicant_email || 'Unknown'}
                      {" · by "}{log.approved_by_name || log.approved_by_email || 'Unknown'}
                      {log.approver_type ? ` (${log.approver_type.replace('_', ' ')})` : ''}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 whitespace-nowrap">
                    {log.decided_at ? new Date(log.decided_at).toLocaleString() : ''}
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
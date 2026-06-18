import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

export default function ApplyPendingAssignments() {
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Only run once per session
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const applyPendingAssignment = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (!currentUser?.email) return;

        const pendingAssignments = await base44.entities.PendingUserAssignment.filter({
          email: currentUser.email.toLowerCase(),
          applied: false,
        });

        if (pendingAssignments.length > 0) {
          const assignment = pendingAssignments[0];
          
          await base44.entities.User.update(currentUser.id, {
            user_type: assignment.user_type,
            assigned_league_ids: assignment.assigned_league_ids,
          });

          await base44.entities.PendingUserAssignment.update(assignment.id, {
            applied: true,
          });

          // Audit: this is a silent, system-triggered grant — it applies on the
          // user's login, not by an admin clicking at this moment. Record it in
          // the ApprovalLog ledger, credited to the admin who queued it.
          try {
            const queuedBy = assignment.created_by || 'system';
            const grantedLeagueIds = assignment.assigned_league_ids || [];
            const logBase = {
              event_type: 'pending_assignment_applied',
              applicant_name: currentUser.full_name,
              applicant_email: currentUser.email,
              requested_role: assignment.user_type,
              approver_type: 'system',
              approved_by_email: queuedBy,
              approved_by_name: queuedBy,
            };
            if (grantedLeagueIds.length === 0) {
              await base44.functions.invoke('logAccessEvent', logBase);
            } else {
              for (const leagueId of grantedLeagueIds) {
                await base44.functions.invoke('logAccessEvent', { ...logBase, league_id: leagueId });
              }
            }
          } catch (_e) { /* never block the apply on a logging failure */ }

          window.location.reload();
        }
      } catch (error) {
        console.error("Error applying pending assignment:", error);
      }
    };

    applyPendingAssignment();
  }, []);

  return null;
}
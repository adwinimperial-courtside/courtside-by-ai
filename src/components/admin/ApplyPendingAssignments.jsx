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
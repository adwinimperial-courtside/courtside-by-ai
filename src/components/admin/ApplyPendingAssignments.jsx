import { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function ApplyPendingAssignments() {
  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  useEffect(() => {
    const applyPendingAssignment = async () => {
      if (!currentUser?.email) return;

      try {
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
  }, [currentUser]);

  return null;
}
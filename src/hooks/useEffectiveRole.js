import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useEffectiveRole(currentUser, selectedLeagueId) {
  const { data: leagueIdentities = [] } = useQuery({
    queryKey: ['myLeagueIdentities', currentUser?.id],
    queryFn: () => base44.entities.UserLeagueIdentity.filter({ user_id: currentUser.id }),
    enabled: !!currentUser?.id,
    staleTime: 60000,
  });

  if (!currentUser) {
    return {
      effectiveRole: null,
      isAppAdmin: false,
      isLeagueAdmin: false,
      isCoach: false,
      isPlayer: false,
      isViewer: false,
    };
  }

  if (currentUser.user_type === 'app_admin') {
    return {
      effectiveRole: 'app_admin',
      isAppAdmin: true,
      isLeagueAdmin: false,
      isCoach: false,
      isPlayer: false,
      isViewer: false,
    };
  }

  let effectiveRole = currentUser.user_type;

  if (selectedLeagueId && selectedLeagueId !== 'all') {
    const identity = leagueIdentities.find(i => i.league_id === selectedLeagueId);
    if (identity?.role) {
      effectiveRole = identity.role;
    }
  }

  return {
    effectiveRole,
    isAppAdmin: effectiveRole === 'app_admin',
    isLeagueAdmin: effectiveRole === 'league_admin',
    isCoach: effectiveRole === 'coach',
    isPlayer: effectiveRole === 'player',
    isViewer: effectiveRole === 'viewer',
  };
}
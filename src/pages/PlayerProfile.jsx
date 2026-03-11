import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import PlayerDashboardCard from "@/components/player/PlayerDashboardCard";
import PlayerLastGame from "@/components/player/PlayerLastGame";
import PlayerNextGame from "@/components/player/PlayerNextGame";

export default function PlayerProfile() {
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const queryClient = useQueryClient();

  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['currentUserProfile'],
    queryFn: () => base44.auth.me(),
  });

  const { data: identities = [] } = useQuery({
    queryKey: ['myLeagueIdentities', currentUser?.id],
    queryFn: () => base44.entities.UserLeagueIdentity.filter({ user_id: currentUser.id }),
    enabled: !!currentUser?.id,
  });

  const { data: allLeagues = [] } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
    enabled: !!currentUser,
  });

  const userLeagues = useMemo(() => {
    if (!allLeagues.length || !currentUser?.assigned_league_ids?.length) return [];
    return allLeagues.filter(l => currentUser.assigned_league_ids.includes(l.id));
  }, [allLeagues, currentUser]);

  useEffect(() => {
    if (userLeagues.length > 0 && !selectedLeagueId) {
      setSelectedLeagueId(userLeagues[0].id);
    }
  }, [userLeagues]);

  const currentIdentity = useMemo(
    () => identities.find(i => i.league_id === selectedLeagueId) || null,
    [identities, selectedLeagueId]
  );

  const teamId = currentIdentity?.team_id;
  const matchedPlayerId = currentIdentity?.matched_player_id;

  const { data: allTeams = [] } = useQuery({
    queryKey: ['allTeams'],
    queryFn: () => base44.entities.Team.list(),
    enabled: !!selectedLeagueId,
  });

  const { data: teamPlayers = [] } = useQuery({
    queryKey: ['teamPlayers', teamId],
    queryFn: () => base44.entities.Player.filter({ team_id: teamId }),
    enabled: !!teamId,
  });

  const { data: leagueGames = [] } = useQuery({
    queryKey: ['leagueGames', selectedLeagueId],
    queryFn: () => base44.entities.Game.filter({ league_id: selectedLeagueId }),
    enabled: !!selectedLeagueId,
  });

  const { data: allLeagueStats = [] } = useQuery({
    queryKey: ['allLeagueStats', selectedLeagueId],
    queryFn: () => base44.entities.PlayerStats.list(),
    enabled: !!selectedLeagueId,
  });

  const currentTeam = useMemo(() => allTeams.find(t => t.id === teamId) || null, [allTeams, teamId]);
  const selectedLeague = useMemo(() => allLeagues.find(l => l.id === selectedLeagueId) || null, [allLeagues, selectedLeagueId]);

  // Resolve the player record: prefer matched_player_id, fallback to display_name match
  const playerRecord = useMemo(() => {
    if (matchedPlayerId) return teamPlayers.find(p => p.id === matchedPlayerId) || null;
    if (!currentUser?.display_name || !teamPlayers.length) return null;
    const dn = currentUser.display_name.trim().toLowerCase();
    return teamPlayers.find(p => p.name?.trim().toLowerCase() === dn) || null;
  }, [teamPlayers, matchedPlayerId, currentUser]);

  const completedGameIds = useMemo(
    () => new Set(leagueGames.filter(g => g.status === 'completed').map(g => g.id)),
    [leagueGames]
  );

  // Stats for THIS player using resolved playerRecord
  const resolvedPlayerId = playerRecord?.id;

  const myStats = useMemo(
    () => resolvedPlayerId
      ? allLeagueStats.filter(s => s.player_id === resolvedPlayerId && completedGameIds.has(s.game_id))
      : [],
    [allLeagueStats, resolvedPlayerId, completedGameIds]
  );

  const allCompletedStats = useMemo(
    () => allLeagueStats.filter(s => completedGameIds.has(s.game_id)),
    [allLeagueStats, completedGameIds]
  );

  const handlePhotoUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (currentUser && currentUser.user_type !== 'player') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500 text-lg">This page is only accessible to players.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-lg mx-auto space-y-4">

        {/* Page title */}
        <div className="pt-2 pb-1">
          <h1 className="text-2xl font-bold text-slate-900">Player Dashboard</h1>
          <p className="text-sm text-slate-500">Your stats and upcoming games in one place</p>
        </div>

        {/* League Selector (only if multiple leagues) */}
        {userLeagues.length > 1 && (
          <Select value={selectedLeagueId || ""} onValueChange={setSelectedLeagueId}>
            <SelectTrigger className="w-full bg-white border-slate-200">
              <SelectValue placeholder="Select league" />
            </SelectTrigger>
            <SelectContent>
              {userLeagues.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.name} — {l.season}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Main dashboard card */}
        <PlayerDashboardCard
          currentUser={currentUser}
          team={currentTeam}
          playerRecord={playerRecord}
          myStats={myStats}
          allStats={allCompletedStats}
          games={leagueGames}
          leagueName={selectedLeague?.name}
          onPhotoUpdate={handlePhotoUpdate}
        />

        {/* Last Game */}
        <PlayerLastGame
          games={leagueGames}
          myStats={allLeagueStats.filter(s => s.player_id === resolvedPlayerId)}
          teams={allTeams}
          teamId={teamId}
        />

        {/* Next Game */}
        <PlayerNextGame
          games={leagueGames}
          teams={allTeams}
          teamId={teamId}
        />

      </div>
    </div>
  );
}
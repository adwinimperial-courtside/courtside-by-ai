import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import PlayerProfileHeader from "@/components/player/PlayerProfileHeader";
import PlayerQuickStats from "@/components/player/PlayerQuickStats";
import PlayerRecognition from "@/components/player/PlayerRecognition";
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

  const matchedPlayerId = currentIdentity?.matched_player_id;
  const teamId = currentIdentity?.team_id;

  const { data: allTeams = [] } = useQuery({
    queryKey: ['allTeams'],
    queryFn: () => base44.entities.Team.list(),
    enabled: !!selectedLeagueId,
  });

  const { data: allPlayers = [] } = useQuery({
    queryKey: ['allPlayers'],
    queryFn: () => base44.entities.Player.list(),
    enabled: !!selectedLeagueId,
  });

  const { data: leagueGames = [] } = useQuery({
    queryKey: ['leagueGames', selectedLeagueId],
    queryFn: () => base44.entities.Game.filter({ league_id: selectedLeagueId }),
    enabled: !!selectedLeagueId,
  });

  const { data: myStats = [] } = useQuery({
    queryKey: ['myStats', matchedPlayerId],
    queryFn: () => base44.entities.PlayerStats.filter({ player_id: matchedPlayerId }),
    enabled: !!matchedPlayerId,
  });

  const { data: allLeagueStats = [] } = useQuery({
    queryKey: ['allLeagueStats', selectedLeagueId],
    queryFn: () => base44.entities.PlayerStats.list(),
    enabled: !!selectedLeagueId,
  });

  const completedGameIds = useMemo(
    () => new Set(leagueGames.filter(g => g.status === 'completed').map(g => g.id)),
    [leagueGames]
  );

  const myLeagueStats = useMemo(
    () => myStats.filter(s => completedGameIds.has(s.game_id)),
    [myStats, completedGameIds]
  );

  const allLeagueCompletedStats = useMemo(
    () => allLeagueStats.filter(s => completedGameIds.has(s.game_id)),
    [allLeagueStats, completedGameIds]
  );

  const currentTeam = useMemo(() => allTeams.find(t => t.id === teamId) || null, [allTeams, teamId]);
  const playerRecord = useMemo(() => allPlayers.find(p => p.id === matchedPlayerId) || null, [allPlayers, matchedPlayerId]);

  const handlePhotoUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <h1 className="text-2xl font-bold text-slate-900">Player Profile</h1>

        {/* Header */}
        <PlayerProfileHeader
          currentUser={currentUser}
          team={currentTeam}
          playerRecord={playerRecord}
          onPhotoUpdate={handlePhotoUpdate}
        />

        {/* League Selector */}
        {userLeagues.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">League:</span>
            <Select value={selectedLeagueId || ""} onValueChange={setSelectedLeagueId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select league" />
              </SelectTrigger>
              <SelectContent>
                {userLeagues.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name} — {l.season}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Quick Stats */}
        <PlayerQuickStats stats={myLeagueStats} />

        {/* Recognition + Games */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlayerRecognition
            myStats={myLeagueStats}
            allStats={allLeagueCompletedStats}
            teams={allTeams}
            games={leagueGames}
            matchedPlayerId={matchedPlayerId}
            selectedLeagueId={selectedLeagueId}
          />
          <div className="space-y-4">
            <PlayerLastGame
              games={leagueGames}
              myStats={myStats}
              teams={allTeams}
              teamId={teamId}
            />
            <PlayerNextGame
              games={leagueGames}
              teams={allTeams}
              teamId={teamId}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
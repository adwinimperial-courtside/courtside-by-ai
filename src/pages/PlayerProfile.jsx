import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import PlayerDashboardCard from "@/components/player/PlayerDashboardCard";
// CARD_FORMAT_V1 — per-game points-format detection for the player cards.
import { buildGameFormatMap } from "@/components/stats/statEngine";
// PROFILE_STATS_HOOK_V1 — all league data comes from the shared cap-agnostic hook.
import { useLeagueStatsData } from "@/components/stats/useLeagueStatsData";
import PlayerLastGame from "@/components/player/PlayerLastGame";
import PlayerNextGame from "@/components/player/PlayerNextGame";
import PlayerTrendCard from "@/components/player/PlayerTrendCard";
import PlayerAchievements from "@/components/player/PlayerAchievements";

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

  const coachIdentityLeagueId = useMemo(() => {
    if (currentUser?.user_type !== 'coach') return null;
    const coachIdentity = identities.find(i => i.matched_player_id);
    return coachIdentity?.league_id || null;
  }, [identities, currentUser?.user_type]);

  useEffect(() => {
    if (userLeagues.length > 0 && !selectedLeagueId) {
      const leagueToSelect = coachIdentityLeagueId ? coachIdentityLeagueId : userLeagues[0].id;
      setSelectedLeagueId(leagueToSelect);
    }
  }, [userLeagues, coachIdentityLeagueId]);

  const currentIdentity = useMemo(
    () => identities.find(i => i.league_id === selectedLeagueId) || null,
    [identities, selectedLeagueId]
  );

  const teamId = currentIdentity?.team_id;
  const matchedPlayerId = currentIdentity?.matched_player_id;

  // PROFILE_STATS_HOOK_V1: teams, players, games, and stats all come from the
  // shared league-stats hook (cap-agnostic pagination, sequential requests,
  // one cache key shared with the Statistics / Award Leaders / Top 20 pages).
  // This replaces four private fetches, including a single capped 5000-row
  // PlayerStats request that silently truncated large leagues (~1,500-row cap).
  const {
    teams: allTeams,
    players: leaguePlayers,
    games: leagueGames,
    stats: allLeagueStats,
  } = useLeagueStatsData(selectedLeagueId);

  // PROFILE_STATS_HOOK_V1: derive this team's players from the league-wide list.
  const teamPlayers = useMemo(
    () => (teamId ? leaguePlayers.filter(p => p.team_id === teamId) : []),
    [leaguePlayers, teamId]
  );

  const currentTeam = useMemo(() => allTeams.find(t => t.id === teamId) || null, [allTeams, teamId]);
  const selectedLeague = useMemo(() => allLeagues.find(l => l.id === selectedLeagueId) || null, [allLeagues, selectedLeagueId]);

  const playerRecord = useMemo(() => {
    if (matchedPlayerId) return teamPlayers.find(p => p.id === matchedPlayerId) || null;
    if (!currentUser?.display_name || !teamPlayers.length) return null;
    const dn = currentUser.display_name.trim().toLowerCase();
    return teamPlayers.find(p => p.name?.trim().toLowerCase() === dn) || null;
  }, [teamPlayers, matchedPlayerId, currentUser]);

  const completedGameIds = useMemo(
    () => new Set(leagueGames.filter(g =>
      g.status === 'completed' &&
      !g.is_default_result &&
      g.result_type !== 'default' &&
      !g.exclude_from_player_stats &&
      !g.exclude_from_awards
    ).map(g => g.id)),
    [leagueGames]
  );

  const resolvedPlayerId = playerRecord?.id;

  const didPlayerParticipate = (stat) => {
    const hasStats = (stat.points_2 || 0) + (stat.points_3 || 0) + (stat.free_throws || 0) +
                     (stat.assists || 0) + (stat.steals || 0) + (stat.blocks || 0) +
                     (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0) +
                     (stat.fouls || 0) + (stat.technical_fouls || 0) + (stat.unsportsmanlike_fouls || 0) > 0;

    if (stat.did_play) return true;
    if ((stat.minutes_played || 0) > 0) return true;
    if (hasStats) return true;
    return false;
  };

  const myStats = useMemo(
    () => resolvedPlayerId
      ? allLeagueStats.filter(s => s.player_id === resolvedPlayerId && completedGameIds.has(s.game_id) && didPlayerParticipate(s))
      : [],
    [allLeagueStats, resolvedPlayerId, completedGameIds]
  );

  const allCompletedStats = useMemo(
    () => allLeagueStats.filter(s => completedGameIds.has(s.game_id) && didPlayerParticipate(s)),
    [allLeagueStats, completedGameIds]
  );

  // CARD_FORMAT_V1 — built from UNFILTERED rows: detection must sum every row
  // of a game (duplicates and non-participants included) against the score.
  const formatMap = useMemo(
    () => buildGameFormatMap(leagueGames, allLeagueStats),
    [leagueGames, allLeagueStats]
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

  if (currentUser && currentUser.user_type !== 'player' && currentUser.user_type !== 'coach') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500 text-lg">This page is only accessible to players and coaches.</p>
      </div>
    );
  }

  if (currentUser?.user_type === 'coach' && !matchedPlayerId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500 text-lg">This page requires a matched player identity.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      {/* Hero Gradient Background Section */}
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-50 via-blue-50 to-white pointer-events-none" />
      
      <div className="max-w-2xl mx-auto relative z-10">

        <div className="pt-4 pb-6">
          <h1 className="text-3xl font-bold text-slate-900">Player Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Your performance, achievements & upcoming games</p>
        </div>

        {userLeagues.length > 1 && (
          <div className="mb-32">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Select League</label>
            <Select value={selectedLeagueId || ""} onValueChange={setSelectedLeagueId}>
              <SelectTrigger className="w-full bg-white border-slate-300 shadow-md">
                <SelectValue placeholder="Choose a league" />
              </SelectTrigger>
              <SelectContent>
                {userLeagues.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name} — {l.season}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="mb-8 -mx-4 md:mx-0">
          <PlayerDashboardCard
            currentUser={currentUser}
            team={currentTeam}
            playerRecord={playerRecord}
            myStats={myStats}
            allStats={allCompletedStats}
            games={leagueGames}
            teamId={teamId}
            leagueId={selectedLeagueId}
            leagueName={selectedLeague?.name}
            onPhotoUpdate={handlePhotoUpdate}
            formatMap={formatMap}
          />
        </div>

        <div className="space-y-6">

          <PlayerAchievements
            myStats={myStats}
            games={leagueGames}
            teamId={teamId}
            playerRecord={playerRecord}
            formatMap={formatMap}
            allStats={allCompletedStats}
          />

          <PlayerTrendCard
            myStats={myStats}
            games={leagueGames}
            teamId={teamId}
            formatMap={formatMap}
          />

          <PlayerLastGame
            games={leagueGames}
            myStats={myStats}
            teams={allTeams}
            teamId={teamId}
            formatMap={formatMap}
          />

          <PlayerNextGame
            games={leagueGames}
            teams={allTeams}
            teamId={teamId}
          />

        </div>

      </div>
    </div>
  );
}
import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Trophy, Star, X } from "lucide-react";
import { Loader2 } from "lucide-react";
import PlayerDashboardCard from "@/components/player/PlayerDashboardCard";
import PlayerAchievements from "@/components/player/PlayerAchievements";
import PlayerTrendCard from "@/components/player/PlayerTrendCard";
import PlayerLastGame from "@/components/player/PlayerLastGame";

export default function POGSpotlightModal({ open, onClose, pogPlayer, leagueId, game, teams }) {
  const teamId = pogPlayer?.team_id;

  const { data: leagueGames = [] } = useQuery({
    queryKey: ["pogLeagueGames", leagueId],
    queryFn: () => base44.entities.Game.filter({ league_id: leagueId }),
    enabled: open && !!leagueId,
    staleTime: 300000,
  });

  const { data: allLeagueStats = [], isLoading: statsLoading } = useQuery({
    queryKey: ["pogAllLeagueStats", leagueId],
    queryFn: () => base44.entities.PlayerStats.list(),
    enabled: open && !!leagueId,
    staleTime: 300000,
  });

  const { data: allTeams = [] } = useQuery({
    queryKey: ["allTeams"],
    queryFn: () => base44.entities.Team.list(),
    enabled: open,
    staleTime: 300000,
  });

  const team = allTeams.find(t => t.id === teamId) || teams?.find(t => t.id === teamId) || null;

  const completedGameIds = useMemo(
    () => new Set(leagueGames.filter(g => g.status === "completed").map(g => g.id)),
    [leagueGames]
  );

  const didParticipate = (stat) => {
    const total =
      (stat.points_2 || 0) + (stat.points_3 || 0) + (stat.free_throws || 0) +
      (stat.assists || 0) + (stat.steals || 0) + (stat.blocks || 0) +
      (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0) +
      (stat.fouls || 0) + (stat.technical_fouls || 0) + (stat.unsportsmanlike_fouls || 0);
    return stat.did_play || (stat.minutes_played || 0) > 0 || total > 0;
  };

  const myStats = useMemo(
    () => pogPlayer
      ? allLeagueStats.filter(
          s => s.player_id === pogPlayer.id && completedGameIds.has(s.game_id) && didParticipate(s)
        )
      : [],
    [allLeagueStats, pogPlayer, completedGameIds]
  );

  const allCompletedStats = useMemo(
    () => allLeagueStats.filter(s => completedGameIds.has(s.game_id) && didParticipate(s)),
    [allLeagueStats, completedGameIds]
  );

  // Build a mock user object shaped like what the profile components expect
  const mockUser = pogPlayer
    ? {
        full_name: pogPlayer.name,
        display_name: pogPlayer.name,
        user_type: "player",
      }
    : null;

  const isLoading = statsLoading || !pogPlayer;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header banner */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">Player of the Game</p>
            <h2 className="text-white font-bold text-lg truncate">{pogPlayer?.name || "..."}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="bg-white p-4 space-y-6">
            {/* Spotlight notice */}
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
              <Star className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span>This is a <strong>full player profile spotlight</strong>. Register and claim yours to unlock this view for yourself.</span>
            </div>

            {/* Player Dashboard Card */}
            <PlayerDashboardCard
              currentUser={mockUser}
              team={team}
              playerRecord={pogPlayer}
              myStats={myStats}
              allStats={allCompletedStats}
              games={leagueGames}
              teamId={teamId}
              leagueId={leagueId}
              onPhotoUpdate={() => {}}
              readOnly={true}
            />

            {/* Achievements */}
            <PlayerAchievements
              myStats={myStats}
              games={leagueGames}
              teamId={teamId}
              playerRecord={pogPlayer}
            />

            {/* Trend */}
            <PlayerTrendCard
              myStats={myStats}
              games={leagueGames}
              teamId={teamId}
            />

            {/* Last Game */}
            <PlayerLastGame
              games={leagueGames}
              myStats={myStats}
              teams={allTeams.length ? allTeams : teams}
              teamId={teamId}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
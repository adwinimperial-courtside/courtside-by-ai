import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlayerDashboardCard from "@/components/player/PlayerDashboardCard";
// PLAYER_CARD_V1 — read-only in-league player profile ("trophy room" view of any player).
// Opened via /PlayerCard?leagueId=...&playerId=... (same URLSearchParams pattern as LiveBoxScore).
import { buildGameFormatMap } from "@/components/stats/statEngine";
import { useLeagueStatsData } from "@/components/stats/useLeagueStatsData";
import PlayerLastGame from "@/components/player/PlayerLastGame";
import PlayerNextGame from "@/components/player/PlayerNextGame";
import PlayerTrendCard from "@/components/player/PlayerTrendCard";
import PlayerAchievements from "@/components/player/PlayerAchievements";

export default function PlayerCard() {
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);
  const leagueId = urlParams.get("leagueId");
  const playerId = urlParams.get("playerId");

  // PLAYER_CARD_V1 — all league data from the shared cap-agnostic hook
  // (same cache key as Statistics / PlayerProfile, so numbers always agree).
  const {
    teams: allTeams,
    players: leaguePlayers,
    games: leagueGames,
    stats: allLeagueStats,
    isLoading,
  } = useLeagueStatsData(leagueId);

  const playerRecord = useMemo(
    () => leaguePlayers.find(p => p.id === playerId) || null,
    [leaguePlayers, playerId]
  );

  const teamId = playerRecord?.team_id || null;
  const currentTeam = useMemo(() => allTeams.find(t => t.id === teamId) || null, [allTeams, teamId]);

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
    () => playerId
      ? allLeagueStats.filter(s => s.player_id === playerId && completedGameIds.has(s.game_id) && didPlayerParticipate(s))
      : [],
    [allLeagueStats, playerId, completedGameIds]
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

  // PLAYER_CARD_V1 — the dashboard card reads name/photo from a user-shaped
  // object; build one from the roster Player record (roster photo_url, no
  // User fetch needed).
  const viewedUser = useMemo(
    () => playerRecord
      ? {
          full_name: playerRecord.name,
          display_name: playerRecord.name,
          user_type: "player",
          profile_photo_url: playerRecord.photo_url || null,
        }
      : null,
    [playerRecord]
  );

  const missingParams = !leagueId || !playerId;
  const notFound = !isLoading && !missingParams && leaguePlayers.length > 0 && !playerRecord;

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: "#050403" }}>{/* PLAYER_CARD_V1 */}
      <div className="max-w-2xl mx-auto relative z-10">

        <div className="pt-2 pb-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="px-2 -ml-2 hover:bg-transparent"
            style={{ color: "#C8A468" }}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
        </div>

        {missingParams ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-lg" style={{ color: "#877A63" }}>No player selected.</p>
          </div>
        ) : isLoading || (!playerRecord && !notFound) ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#C8A468" }} />
          </div>
        ) : notFound ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-lg" style={{ color: "#877A63" }}>Player not found in this league.</p>
          </div>
        ) : (
          <div className="rounded-3xl overflow-hidden p-2.5 md:p-4" style={{ background: "#0B0A08", border: "1px solid #2A2114" }}>{/* PLAYER_CARD_V1 */}
            <div className="mb-3">
              <PlayerDashboardCard
                currentUser={viewedUser}
                team={currentTeam}
                playerRecord={playerRecord}
                myStats={myStats}
                allStats={allCompletedStats}
                games={leagueGames}
                teamId={teamId}
                leagueId={leagueId}
                onPhotoUpdate={() => {}}
                readOnly={true}
                formatMap={formatMap}
              />
            </div>

            <div className="space-y-3">

              <PlayerAchievements
                myStats={myStats}
                games={leagueGames}
                teamId={teamId}
                playerRecord={playerRecord}
                formatMap={formatMap}
                allStats={allCompletedStats}
              />

              <PlayerNextGame
                games={leagueGames}
                teams={allTeams}
                teamId={teamId}
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

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
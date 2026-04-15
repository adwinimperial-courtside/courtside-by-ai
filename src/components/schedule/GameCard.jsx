import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, MapPin, Play, ChevronDown, ChevronUp, Settings, AlertTriangle, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import DefaultWinnerDialog from "./DefaultWinnerDialog";
import EditGameSettingsDialog from "./EditGameSettingsDialog";

export default function GameCard({ game, teams, canManage, onStartGame, onGameUpdated }) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEditSettings, setShowEditSettings] = useState(false);
  const [showDefaultDialog, setShowDefaultDialog] = useState(false);
  const [reopenConfirm, setReopenConfirm] = useState(false);
  const [reopening, setReopening] = useState(false);

  const homeTeam = teams.find((t) => t.id === game.home_team_id);
  const awayTeam = teams.find((t) => t.id === game.away_team_id);

  // Fetch player stats when expanded (completed games only)
  const { data: playerStats = [] } = useQuery({
    queryKey: ["player-stats", game.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_stats")
        .select(`
          id, player_id, team_id,
          points, field_goals_made, field_goals_attempted,
          three_pointers_made, three_pointers_attempted,
          free_throws_made, free_throws_attempted,
          offensive_rebounds, defensive_rebounds,
          assists, steals, blocks, turnovers, fouls, minutes_played,
          player:players(id, first_name, last_name, jersey_number)
        `)
        .eq("game_id", game.id)
        .order("points", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: game.status === "final" && isExpanded,
    staleTime: 300000,
  });

  // Reopen game (reset to scheduled)
  const handleReopen = async () => {
    if (!reopenConfirm) { setReopenConfirm(true); return; }
    setReopening(true);
    try {
      const { error } = await supabase
        .from("games")
        .update({
          status: "scheduled",
          is_default_result: false,
          default_winner_team_id: null,
          default_loser_team_id: null,
          default_reason: null,
          exclude_from_awards: false,
          player_of_game: null,
          home_score: 0,
          away_score: 0,
        })
        .eq("id", game.id);
      if (error) throw error;
      onGameUpdated?.();
      setReopenConfirm(false);
    } finally {
      setReopening(false);
    }
  };

  // Status badge
  const statusConfig = {
    scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-800" },
    live:      { label: "Live",      className: "bg-orange-100 text-orange-800 animate-pulse" },
    final:     { label: "Final",     className: "bg-green-100 text-green-800" },
    cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-600" },
    postponed: { label: "Postponed", className: "bg-yellow-100 text-yellow-800" },
  };
  const statusBadge = statusConfig[game.status] ?? statusConfig.scheduled;

  // Stage badge
  const stageBadgeConfig = {
    quarterfinal: { label: "Quarterfinal", className: "bg-sky-100 text-sky-800" },
    semifinal:    { label: "Semifinal",    className: "bg-violet-100 text-violet-800" },
    championship: { label: "Championship", className: "bg-yellow-100 text-yellow-800" },
  };
  const stageBadge = game.game_stage && game.game_stage !== "regular"
    ? stageBadgeConfig[game.game_stage]
    : null;

  const defaultWinnerTeam = game.is_default_result
    ? teams.find((t) => t.id === game.default_winner_team_id)
    : null;

  const homeStats = playerStats.filter((s) => s.team_id === game.home_team_id);
  const awayStats = playerStats.filter((s) => s.team_id === game.away_team_id);

  const teamTotal = (stats, field) => stats.reduce((acc, s) => acc + (s[field] || 0), 0);

  const renderBoxScore = (stats, team) => {
    if (stats.length === 0) return (
      <p className="text-slate-400 text-sm text-center py-4">No stats recorded</p>
    );

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="min-w-[140px]">Player</TableHead>
              <TableHead className="text-center">PTS</TableHead>
              <TableHead className="text-center">FGM</TableHead>
              <TableHead className="text-center">FGA</TableHead>
              <TableHead className="text-center">3PM</TableHead>
              <TableHead className="text-center">3PA</TableHead>
              <TableHead className="text-center">FTM</TableHead>
              <TableHead className="text-center">FTA</TableHead>
              <TableHead className="text-center">OREB</TableHead>
              <TableHead className="text-center">DREB</TableHead>
              <TableHead className="text-center">REB</TableHead>
              <TableHead className="text-center">AST</TableHead>
              <TableHead className="text-center">STL</TableHead>
              <TableHead className="text-center">BLK</TableHead>
              <TableHead className="text-center">TO</TableHead>
              <TableHead className="text-center">F</TableHead>
              <TableHead className="text-center">MIN</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((stat) => {
              const reb = (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0);
              return (
                <TableRow key={stat.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: team?.color || "#f97316" }}
                      >
                        {stat.player?.jersey_number || "?"}
                      </div>
                      <span className="text-sm">
                        {stat.player
                          ? `${stat.player.first_name} ${stat.player.last_name}`
                          : "Unknown"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-semibold">{stat.points || 0}</TableCell>
                  <TableCell className="text-center">{stat.field_goals_made || 0}</TableCell>
                  <TableCell className="text-center">{stat.field_goals_attempted || 0}</TableCell>
                  <TableCell className="text-center">{stat.three_pointers_made || 0}</TableCell>
                  <TableCell className="text-center">{stat.three_pointers_attempted || 0}</TableCell>
                  <TableCell className="text-center">{stat.free_throws_made || 0}</TableCell>
                  <TableCell className="text-center">{stat.free_throws_attempted || 0}</TableCell>
                  <TableCell className="text-center">{stat.offensive_rebounds || 0}</TableCell>
                  <TableCell className="text-center">{stat.defensive_rebounds || 0}</TableCell>
                  <TableCell className="text-center font-medium">{reb}</TableCell>
                  <TableCell className="text-center">{stat.assists || 0}</TableCell>
                  <TableCell className="text-center">{stat.steals || 0}</TableCell>
                  <TableCell className="text-center">{stat.blocks || 0}</TableCell>
                  <TableCell className="text-center">{stat.turnovers || 0}</TableCell>
                  <TableCell className="text-center">{stat.fouls || 0}</TableCell>
                  <TableCell className="text-center">
                    {stat.minutes_played ? Number(stat.minutes_played).toFixed(0) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Team totals row */}
            <TableRow className="bg-slate-50 font-semibold">
              <TableCell>TEAM TOTALS</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "points")}</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "field_goals_made")}</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "field_goals_attempted")}</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "three_pointers_made")}</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "three_pointers_attempted")}</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "free_throws_made")}</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "free_throws_attempted")}</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "offensive_rebounds")}</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "defensive_rebounds")}</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "offensive_rebounds") + teamTotal(stats, "defensive_rebounds")}</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "assists")}</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "steals")}</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "blocks")}</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "turnovers")}</TableCell>
              <TableCell className="text-center">{teamTotal(stats, "fouls")}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-0">
          {/* Main game row */}
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">

              {/* Date / venue */}
              <div className="flex flex-col gap-1 sm:w-44 shrink-0">
                {game.scheduled_at && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{format(new Date(game.scheduled_at), "dd MMM yyyy")}</span>
                  </div>
                )}
                {game.scheduled_at && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <span className="w-3.5" />
                    <span>{format(new Date(game.scheduled_at), "HH:mm")}</span>
                  </div>
                )}
                {game.venue && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{game.venue}</span>
                  </div>
                )}
              </div>

              {/* Matchup + scores */}
              <div className="flex-1 flex items-center justify-center gap-4">
                {/* Home team */}
                <div className="flex flex-col items-center gap-1 w-28 sm:w-36">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: homeTeam?.color || "#64748b" }}
                  >
                    {homeTeam?.short_name || homeTeam?.name?.[0] || "?"}
                  </div>
                  <span className="text-sm font-semibold text-slate-800 text-center leading-tight">
                    {homeTeam?.name || "TBD"}
                  </span>
                </div>

                {/* Score */}
                <div className="flex flex-col items-center gap-1">
                  {game.status === "final" || game.status === "live" ? (
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold text-slate-900">{game.home_score}</span>
                      <span className="text-slate-400 text-lg">—</span>
                      <span className="text-3xl font-bold text-slate-900">{game.away_score}</span>
                    </div>
                  ) : (
                    <span className="text-xl font-bold text-slate-400">vs</span>
                  )}
                  <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
                </div>

                {/* Away team */}
                <div className="flex flex-col items-center gap-1 w-28 sm:w-36">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: awayTeam?.color || "#64748b" }}
                  >
                    {awayTeam?.short_name || awayTeam?.name?.[0] || "?"}
                  </div>
                  <span className="text-sm font-semibold text-slate-800 text-center leading-tight">
                    {awayTeam?.name || "TBD"}
                  </span>
                </div>
              </div>

              {/* Badges + actions */}
              <div className="flex flex-wrap items-center gap-2 sm:w-44 shrink-0 justify-end">
                {stageBadge && (
                  <Badge className={stageBadge.className}>{stageBadge.label}</Badge>
                )}
                {game.is_default_result && (
                  <Badge className="bg-red-100 text-red-700">
                    Default — {defaultWinnerTeam?.name || "Winner"}
                  </Badge>
                )}
                {game.exclude_from_awards && !game.is_default_result && (
                  <Badge className="bg-amber-100 text-amber-700">Excl. Awards</Badge>
                )}

                {/* Actions */}
                {canManage && game.status === "scheduled" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={onStartGame}
                      className="bg-green-600 hover:bg-green-700 text-white h-8"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      Start
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDefaultDialog(true)}
                      className="h-8"
                      title="Mark default winner"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowEditSettings(true)}
                      className="h-8"
                      title="Edit game settings"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}

                {canManage && (game.status === "final" || game.is_default_result) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReopen}
                    disabled={reopening}
                    className={`h-8 ${reopenConfirm ? "border-red-400 text-red-600 hover:bg-red-50" : ""}`}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    {reopenConfirm ? "Confirm?" : "Reopen"}
                  </Button>
                )}

                {/* Expand box score for final games */}
                {game.status === "final" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="h-8"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Expanded box score */}
          {isExpanded && game.status === "final" && (
            <div className="border-t border-slate-100 px-4 sm:px-6 py-4 space-y-6">
              {/* Home team box score */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: homeTeam?.color || "#64748b" }}
                  />
                  <h4 className="font-semibold text-slate-800">{homeTeam?.name}</h4>
                  <span className="text-slate-400 text-sm">— {game.home_score} pts</span>
                </div>
                {renderBoxScore(homeStats, homeTeam)}
              </div>

              {/* Away team box score */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: awayTeam?.color || "#64748b" }}
                  />
                  <h4 className="font-semibold text-slate-800">{awayTeam?.name}</h4>
                  <span className="text-slate-400 text-sm">— {game.away_score} pts</span>
                </div>
                {renderBoxScore(awayStats, awayTeam)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EditGameSettingsDialog
        open={showEditSettings}
        onOpenChange={setShowEditSettings}
        game={game}
        onSaved={() => {
          onGameUpdated?.();
          queryClient.invalidateQueries({ queryKey: ["games"] });
        }}
      />

      <DefaultWinnerDialog
        open={showDefaultDialog}
        onOpenChange={setShowDefaultDialog}
        game={game}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        onSaved={() => {
          onGameUpdated?.();
          queryClient.invalidateQueries({ queryKey: ["games"] });
        }}
      />
    </motion.div>
  );
}

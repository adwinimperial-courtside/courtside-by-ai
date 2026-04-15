import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabaseClient";

import CreateGameDialog from "../components/schedule/CreateGameDialog";
import GameCard from "../components/schedule/GameCard";

export default function SchedulePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Session
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const userId = session?.user?.id;
  const isAppAdmin = session?.user?.user_metadata?.app_admin === true;

  // Memberships
  const { data: memberships = [] } = useQuery({
    queryKey: ["league-memberships", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_league_memberships")
        .select("role, league:leagues(id, name)")
        .eq("user_id", userId)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Profile for default league
  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("default_league_id")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const accessibleLeagues = memberships.map((m) => m.league);

  // Auto-select league
  React.useEffect(() => {
    if (selectedLeague) return;
    if (profile?.default_league_id) {
      setSelectedLeague(profile.default_league_id);
    } else if (accessibleLeagues.length === 1) {
      setSelectedLeague(accessibleLeagues[0].id);
    }
  }, [memberships, profile]);

  const currentMembership = memberships.find((m) => m.league.id === selectedLeague);
  const canManage = isAppAdmin || currentMembership?.role === "league_admin";

  // Teams for selected league
  const { data: teams = [] } = useQuery({
    queryKey: ["teams", selectedLeague],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, short_name, color, logo_url, league_id")
        .eq("league_id", selectedLeague)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLeague,
  });

  // Games for selected league
  const { data: games = [], isLoading } = useQuery({
    queryKey: ["games", selectedLeague],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("league_id", selectedLeague)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLeague,
    staleTime: 0,
  });

  // Create game
  const createGameMutation = useMutation({
    mutationFn: async (gameData) => {
      const { error } = await supabase.from("games").insert({
        league_id: gameData.league_id,
        home_team_id: gameData.home_team_id,
        away_team_id: gameData.away_team_id,
        scheduled_at: gameData.scheduled_at || null,
        venue: gameData.venue || null,
        status: "scheduled",
        home_score: 0,
        away_score: 0,
        game_stage: gameData.game_stage || "regular",
        exclude_from_awards: gameData.exclude_from_awards || false,
        game_mode: gameData.game_mode || "timed",
        period_type: gameData.period_type || null,
        period_count: gameData.period_count || null,
        period_minutes: gameData.period_minutes || null,
        overtime_minutes: gameData.overtime_minutes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      setShowCreateDialog(false);
    },
  });

  // Filter games
  const filteredGames = games.filter((game) => {
    const teamMatch =
      selectedTeam === "all" ||
      game.home_team_id === selectedTeam ||
      game.away_team_id === selectedTeam;
    const statusMatch =
      statusFilter === "all" ||
      (statusFilter === "scheduled" && game.status === "scheduled") ||
      (statusFilter === "live" && game.status === "live") ||
      (statusFilter === "final" && game.status === "final") ||
      (statusFilter === "default" && game.is_default_result);
    return teamMatch && statusMatch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 w-full">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                {t("schedule.title", "Schedule")}
              </h1>
            </div>
            <p className="text-slate-600 ml-15">
              {t("schedule.subtitle", "Manage game schedules and matchups")}
            </p>
          </div>

          {canManage && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg shadow-green-500/30 h-12 px-6"
              disabled={teams.length < 2}
            >
              <Plus className="w-5 h-5 mr-2" />
              {t("schedule.scheduleGame", "Schedule Game")}
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          {/* League selector */}
          {accessibleLeagues.length > 1 && (
            <div className="flex items-center gap-2 flex-1">
              <Filter className="w-4 h-4 text-slate-500 shrink-0" />
              <Select
                value={selectedLeague}
                onValueChange={(val) => {
                  setSelectedLeague(val);
                  setSelectedTeam("all");
                }}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder={t("schedule.selectLeague", "Select League")} />
                </SelectTrigger>
                <SelectContent>
                  {accessibleLeagues.map((league) => (
                    <SelectItem key={league.id} value={league.id}>
                      {league.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Team filter */}
          <div className="flex items-center gap-2 flex-1">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder={t("schedule.allTeams", "All Teams")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("schedule.allTeams", "All Teams")}</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2 flex-1">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder={t("schedule.allGames", "All Games")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("schedule.allGames", "All Games")}</SelectItem>
                <SelectItem value="scheduled">{t("schedule.scheduled", "Scheduled")}</SelectItem>
                <SelectItem value="live">{t("schedule.live", "Live")}</SelectItem>
                <SelectItem value="final">{t("schedule.final", "Final")}</SelectItem>
                <SelectItem value="default">{t("schedule.defaulted", "Defaulted")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        {!selectedLeague ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <Calendar className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {t("schedule.selectLeague", "Select a League")}
            </h3>
            <p className="text-slate-600 text-center max-w-md">
              {t("schedule.selectLeagueDescription", "Select a league to view and manage games.")}
            </p>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Calendar className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {teams.length < 2
                ? t("schedule.needMoreTeams", "Need More Teams")
                : t("schedule.noGames", "No Games Scheduled")}
            </h3>
            <p className="text-slate-600 text-center max-w-md">
              {teams.length < 2
                ? t("schedule.needMoreTeamsDescription", "You need at least 2 teams to schedule a game.")
                : t("schedule.noGamesDescription", "Start scheduling games for your league.")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                teams={teams}
                canManage={canManage}
                onGameUpdated={() => queryClient.invalidateQueries({ queryKey: ["games"] })}
                onStartGame={() => navigate(`/LiveGame?gameId=${game.id}`)}
              />
            ))}
          </div>
        )}

        <CreateGameDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSubmit={(data) => createGameMutation.mutate(data)}
          isLoading={createGameMutation.isPending}
          leagues={accessibleLeagues}
          teams={teams}
          defaultLeagueId={selectedLeague}
        />
      </div>
    </div>
  );
}

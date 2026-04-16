import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabaseClient";

import TeamCard from "../components/teams/TeamCard";
import CreateTeamDialog from "../components/teams/CreateTeamDialog";
import EditTeamDialog from "../components/teams/EditTeamDialog";
import TeamDetailView from "../components/teams/TeamDetailView";

export default function TeamsPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const leagueIdFromUrl = searchParams.get("league");

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [teamToEdit, setTeamToEdit] = useState(null);
  const [teamToDelete, setTeamToDelete] = useState(null);
  const [selectedLeague, setSelectedLeague] = useState(leagueIdFromUrl || null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const queryClient = useQueryClient();

  // Current session
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const userId = session?.user?.id;
  const isAppAdmin = session?.user?.user_metadata?.app_admin === true;

  // Fetch user's league memberships
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

  // Fetch profile for default league fallback
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

  // Set default league selection once memberships load
  React.useEffect(() => {
    if (selectedLeague) return;
    if (profile?.default_league_id) {
      setSelectedLeague(profile.default_league_id);
    } else if (accessibleLeagues.length === 1) {
      setSelectedLeague(accessibleLeagues[0].id);
    }
  }, [memberships, profile]);

  // Role for the currently selected league
  const currentMembership = memberships.find((m) => m.league.id === selectedLeague);
  const currentRole = currentMembership?.role;
  const canManageTeams = isAppAdmin || currentRole === "league_admin";

  // Fetch teams for selected league
  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["teams", selectedLeague],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("league_id", selectedLeague)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedLeague,
  });

  // Create team
  const createTeamMutation = useMutation({
    mutationFn: async (teamData) => {
      const { error } = await supabase.from("teams").insert({
        league_id: teamData.league_id,
        name: teamData.name,
        short_name: teamData.short_name || null,
        color: teamData.color || "#f97316",
        logo_url: teamData.logo_url || null,
        head_coach: teamData.head_coach || null,
        manager: teamData.manager || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setShowCreateDialog(false);
    },
  });

  // Update team
  const updateTeamMutation = useMutation({
    mutationFn: async (teamData) => {
      const { error } = await supabase
        .from("teams")
        .update({
          name: teamData.name,
          short_name: teamData.short_name || null,
          color: teamData.color || "#f97316",
          logo_url: teamData.logo_url || null,
          head_coach: teamData.head_coach || null,
          manager: teamData.manager || null,
        })
        .eq("id", teamToEdit.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setShowEditDialog(false);
      setTeamToEdit(null);
    },
  });

  // Soft-delete team
  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId) => {
      const { error } = await supabase
        .from("teams")
        .update({ is_active: false })
        .eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setTeamToDelete(null);
    },
  });

  // Team detail view
  if (selectedTeam) {
    return (
      <TeamDetailView
        team={selectedTeam}
        onBack={() => setSelectedTeam(null)}
        canManage={canManageTeams}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                {t("teams.title", "Teams")}
              </h1>
            </div>
            <p className="text-slate-600 ml-15">
              {t("teams.subtitle", "View and manage your team rosters")}
            </p>
          </div>

          {canManageTeams && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/30 h-12 px-6"
              disabled={accessibleLeagues.length === 0}
            >
              <Plus className="w-5 h-5 mr-2" />
              {t("teams.addTeam", "Add Team")}
            </Button>
          )}
        </div>

        {/* League selector — only shown when user has multiple leagues */}
        {accessibleLeagues.length > 1 && (
          <div className="mb-8">
            <Select value={selectedLeague} onValueChange={setSelectedLeague}>
              <SelectTrigger className="w-full sm:w-64 h-12 bg-white border-slate-200">
                <SelectValue placeholder={t("teams.filterByLeague", "Filter by league")} />
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

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Users className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {accessibleLeagues.length === 0
                ? t("teams.noLeagues", "No Leagues Assigned")
                : t("teams.noTeams", "No Teams Yet")}
            </h3>
            <p className="text-slate-600 text-center max-w-md">
              {accessibleLeagues.length === 0
                ? t("teams.noLeaguesDescription", "You haven't been assigned to any leagues yet.")
                : t("teams.noTeamsDescription", "Start building your league by adding teams.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <div key={team.id} className="group relative">
                <TeamCard
                  team={team}
                  league={accessibleLeagues.find((l) => l.id === team.league_id)}
                  onClick={() => setSelectedTeam(team)}
                />
                {canManageTeams && (
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 w-8 p-0 bg-white shadow-md"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTeamToEdit(team);
                        setShowEditDialog(true);
                      }}
                    >
                      ✏️
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 w-8 p-0 bg-red-600 hover:bg-red-700 shadow-md"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTeamToDelete(team);
                      }}
                    >
                      🗑️
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Dialogs */}
        <CreateTeamDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSubmit={(data) => createTeamMutation.mutate(data)}
          isLoading={createTeamMutation.isPending}
          leagues={accessibleLeagues}
          defaultLeagueId={selectedLeague}
        />

        <EditTeamDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          team={teamToEdit}
          onSubmit={(data) => updateTeamMutation.mutate(data)}
          isLoading={updateTeamMutation.isPending}
        />

        <AlertDialog
          open={!!teamToDelete}
          onOpenChange={(open) => !open && setTeamToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("teams.deleteTitle", "Delete Team")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("teams.deleteDescription", `Are you sure you want to delete "${teamToDelete?.name}"? The team will be deactivated.`)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-3">
              <AlertDialogCancel disabled={deleteTeamMutation.isPending}>
                {t("common.cancel", "Cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTeamMutation.mutate(teamToDelete.id)}
                disabled={deleteTeamMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteTeamMutation.isPending ? t("common.deleting", "Deleting...") : t("common.delete", "Delete")}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

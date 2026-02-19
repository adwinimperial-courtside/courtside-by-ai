import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Users, ArrowLeft, Edit2, Trash2 } from "lucide-react";
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

import TeamCard from "../components/teams/TeamCard";
import CreateTeamDialog from "../components/teams/CreateTeamDialog";
import EditTeamDialog from "../components/teams/EditTeamDialog";
import TeamDetailView from "../components/teams/TeamDetailView";

export default function TeamsPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const leagueIdFromUrl = urlParams.get('league');
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [teamToEdit, setTeamToEdit] = useState(null);
  const [teamToDelete, setTeamToDelete] = useState(null);
  const [selectedLeague, setSelectedLeague] = useState(leagueIdFromUrl || null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        if (!leagueIdFromUrl) {
          if (user?.default_league_id) {
            setSelectedLeague(user.default_league_id);
          } else if (user?.assigned_league_ids?.length === 1) {
            setSelectedLeague(user.assigned_league_ids[0]);
          } else {
            setSelectedLeague("all");
          }
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };
    fetchUser();
  }, [leagueIdFromUrl]);

  const { data: leagues } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
    initialData: [],
  });

  const isAppAdmin = currentUser?.user_type === 'app_admin';
  const isLeagueAdmin = currentUser?.user_type === 'league_admin';
  const canManageTeams = isAppAdmin || isLeagueAdmin;
  const assignedLeagueIds = currentUser?.assigned_league_ids || [];
  const hasAssignedLeagues = assignedLeagueIds.length > 0;
  const assignedLeagues = isAppAdmin
    ? leagues
    : hasAssignedLeagues
      ? leagues.filter(league => assignedLeagueIds.includes(league.id))
      : leagues;

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list('-created_date'),
    initialData: [],
  });

  const createTeamMutation = useMutation({
    mutationFn: async (teamData) => {
      const { captain, ...teamInfo } = teamData;
      
      // Create the team
      const newTeam = await base44.entities.Team.create(teamInfo);
      
      // If captain data is provided, create the captain as a player and update team
      if (captain && captain.name && captain.jersey_number) {
        const captainPlayer = await base44.entities.Player.create({
          name: captain.name,
          team_id: newTeam.id,
          jersey_number: captain.jersey_number,
          position: captain.position
        });
        
        // Update team with captain reference
        await base44.entities.Team.update(newTeam.id, {
          team_captain: captainPlayer.id
        });
      }
      
      return newTeam;
    },
    onSuccess: () => {
      // Track team creation (exclude app_admin)
      if (currentUser && currentUser.user_type !== 'app_admin') {
        base44.analytics.track({
          eventName: 'team_created',
          properties: {
            user_email: currentUser.email,
            team_name: createTeamMutation.variables?.name,
            user_type: currentUser.user_type
          }
        });
      }
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setShowCreateDialog(false);
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: async (teamData) => {
      await base44.entities.Team.update(teamToEdit.id, teamData);
      return true;
    },
    onSuccess: () => {
      // Track team update (exclude app_admin)
      if (currentUser && currentUser.user_type !== 'app_admin') {
        base44.analytics.track({
          eventName: 'team_updated',
          properties: {
            user_email: currentUser.email,
            team_id: teamToEdit.id,
            user_type: currentUser.user_type
          }
        });
      }
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setShowEditDialog(false);
      setTeamToEdit(null);
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId) => {
      // Delete all players for this team
      const teamPlayers = await base44.entities.Player.filter({ team_id: teamId });
      for (const player of teamPlayers) {
        await base44.entities.Player.delete(player.id);
      }
      
      // Delete all games for this team
      const games = await base44.entities.Game.filter({});
      const teamGames = games.filter(g => g.home_team_id === teamId || g.away_team_id === teamId);
      for (const game of teamGames) {
        await base44.entities.Game.delete(game.id);
      }
      
      // Delete the team
      await base44.entities.Team.delete(teamId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['games'] });
      setTeamToDelete(null);
    },
  });

  const baseTeams = (hasAssignedLeagues && !isAppAdmin)
    ? teams.filter(team => assignedLeagueIds.includes(team.league_id))
    : teams;

  const filteredTeams = selectedLeague === "all" 
    ? baseTeams
    : baseTeams.filter(team => team.league_id === selectedLeague);

  if (selectedTeam) {
    return (
      <TeamDetailView 
        team={selectedTeam} 
        onBack={() => setSelectedTeam(null)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Teams</h1>
            </div>
            <p className="text-slate-600 ml-15">View and manage your team rosters</p>
          </div>
          {canManageTeams && (
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/30 h-12 px-6"
              disabled={assignedLeagues.length === 0}
              >
              <Plus className="w-5 h-5 mr-2" />
              Add Team
            </Button>
          )}
        </div>

        {assignedLeagues.length > 0 && (
           <div className="mb-8">
             <Select value={selectedLeague} onValueChange={setSelectedLeague}>
               <SelectTrigger className="w-full sm:w-64 h-12 bg-white border-slate-200">
                 <SelectValue placeholder="Filter by league" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Leagues</SelectItem>
                 {assignedLeagues.map(league => (
                   <SelectItem key={league.id} value={league.id}>
                     {league.name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
         )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Users className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {assignedLeagues.length === 0 ? "No Leagues Assigned" : "No Teams Yet"}
            </h3>
            <p className="text-slate-600 text-center mb-8 max-w-md">
              {assignedLeagues.length === 0 
                ? "You haven't been assigned to any leagues yet"
                : "Start building your league by adding teams"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeams.map((team) => (
                <div key={team.id} className="group relative">
                  <TeamCard 
                    team={team} 
                    league={leagues.find(l => l.id === team.league_id)}
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
                        <Edit2 className="w-4 h-4" />
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
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <CreateTeamDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSubmit={(data) => createTeamMutation.mutate(data)}
          isLoading={createTeamMutation.isPending}
          leagues={assignedLeagues}
        />

        <EditTeamDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          team={teamToEdit}
          onSubmit={(data) => updateTeamMutation.mutate(data)}
          isLoading={updateTeamMutation.isPending}
        />

        <AlertDialog open={!!teamToDelete} onOpenChange={(open) => !open && setTeamToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Team</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{teamToDelete?.name}"? This will also delete all players and games associated with this team. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-3">
              <AlertDialogCancel disabled={deleteTeamMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTeamMutation.mutate(teamToDelete.id)}
                disabled={deleteTeamMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteTeamMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
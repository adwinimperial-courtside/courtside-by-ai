import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Users, ArrowLeft, Edit2, Trash2, ListChecks, ClipboardCheck, X, Check, AlertTriangle, ArrowRight } from "lucide-react";
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
import { useEffectiveRole } from "@/hooks/useEffectiveRole";

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
  const [checking, setChecking] = useState(false);
  const [checkResults, setCheckResults] = useState(null);
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

  // ROSTER_CHECK_V1 — clear stale results when the league filter changes
  React.useEffect(() => { setCheckResults(null); }, [selectedLeague]);

  const { data: leagues } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list('-created_date', 200),
    initialData: [],
  });

  const { isAppAdmin, isLeagueAdmin } = useEffectiveRole(currentUser, selectedLeague);
  const canManageTeams = isAppAdmin || isLeagueAdmin;
  const assignedLeagueIds = currentUser?.assigned_league_ids || [];
  const hasAssignedLeagues = assignedLeagueIds.length > 0;
  const assignedLeagues = isAppAdmin
    ? leagues
    : hasAssignedLeagues
      ? leagues.filter(league => assignedLeagueIds.includes(league.id))
      : leagues;

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams', selectedLeague],
    queryFn: async () => {
      if (!selectedLeague) return [];
      if (selectedLeague === 'all') {
        return base44.entities.Team.list('-created_date', 500);
      }
      return base44.entities.Team.filter({ league_id: selectedLeague }, null, 500);
    },
    enabled: !!selectedLeague,
    initialData: [],
  });

  const { data: games = [] } = useQuery({
    queryKey: ['games', selectedLeague],
    queryFn: async () => {
      if (!selectedLeague || selectedLeague === 'all') return [];
      return base44.entities.Game.filter({ league_id: selectedLeague, status: 'completed' }, null, 1000);
    },
    enabled: !!selectedLeague && selectedLeague !== 'all',
    staleTime: 0,
  });

  // Compute wins/losses dynamically from completed games (same logic as Standings page)
  const computedStandings = React.useMemo(() => {
    const map = {};
    (teams || []).forEach(t => { map[t.id] = { wins: 0, losses: 0 }; });
    games.forEach(game => {
      if (game.is_default_result) {
        if (map[game.default_winner_team_id]) map[game.default_winner_team_id].wins++;
        if (map[game.default_loser_team_id]) map[game.default_loser_team_id].losses++;
      } else {
        const homeScore = game.home_score || 0;
        const awayScore = game.away_score || 0;
        if (map[game.home_team_id]) {
          if (homeScore > awayScore) map[game.home_team_id].wins++;
          else map[game.home_team_id].losses++;
        }
        if (map[game.away_team_id]) {
          if (awayScore > homeScore) map[game.away_team_id].wins++;
          else map[game.away_team_id].losses++;
        }
      }
    });
    return map;
  }, [teams, games]);

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
      
      // Delete games where this team is home or away (filtered query is more efficient)
      const homeGames = await base44.entities.Game.filter({ home_team_id: teamId });
      const awayGames = await base44.entities.Game.filter({ away_team_id: teamId });
      const allTeamGames = [...(homeGames || []), ...(awayGames || [])];
      for (const game of allTeamGames) {
        await base44.entities.Game.delete(game.id);
      }
      
      // Delete the team
      await base44.entities.Team.delete(teamId);
    },
    onSuccess: () => {
      // Track team deletion (exclude app_admin)
      if (currentUser && currentUser.user_type !== 'app_admin') {
        base44.analytics.track({
          eventName: 'team_deleted',
          properties: {
            user_email: currentUser.email,
            team_id: teamToDelete.id,
            user_type: currentUser.user_type
          }
        });
      }
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

  // ROSTER_CHECK_V1 — read-only sweep: find teams whose roster has a jersey number used twice+
  const handleCheckRosters = async () => {
    if (!filteredTeams.length) return;
    setChecking(true);
    setCheckResults(null);
    try {
      const results = await Promise.all(
        filteredTeams.map(async (team) => {
          const roster = await base44.entities.Player.filter({ team_id: team.id });
          const counts = {};
          (roster || []).forEach(p => {
            const jn = String(p.jersey_number ?? '').trim();
            if (jn === '') return;
            const n = parseInt(jn, 10);
            if (isNaN(n)) return;
            if (!counts[n]) counts[n] = [];
            counts[n].push((p.name || '').trim() || 'Unnamed');
          });
          const dups = Object.keys(counts)
            .filter(k => counts[k].length > 1)
            .map(k => ({ number: Number(k), players: counts[k] }))
            .sort((a, b) => a.number - b.number);
          return { teamId: team.id, teamName: team.name, dups };
        })
      );
      const problems = results
        .filter(r => r.dups.length > 0)
        .sort((a, b) => (a.teamName || '').localeCompare(b.teamName || ''));
      setCheckResults({ teamsChecked: filteredTeams.length, problems, error: false });
    } catch (e) {
      console.error('Roster check failed:', e);
      setCheckResults({ teamsChecked: 0, problems: [], error: true });
    } finally {
      setChecking(false);
    }
  };

  // Keep selectedTeam fresh from the latest teams data
  const liveSelectedTeam = selectedTeam ? (teams?.find(t => t.id === selectedTeam.id) || selectedTeam) : null;

  if (liveSelectedTeam) {
    return (
      <TeamDetailView 
        team={liveSelectedTeam} 
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
           <div className="mb-8 flex flex-col sm:flex-row sm:items-center gap-3">
             <Select value={selectedLeague} onValueChange={setSelectedLeague}>
               <SelectTrigger className="w-full sm:w-64 h-12 bg-white border-slate-200">
                 <SelectValue placeholder="Filter by league" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Leagues</SelectItem>
                 {[...assignedLeagues].sort((a, b) => a.name.localeCompare(b.name)).map(league => (
                   <SelectItem key={league.id} value={league.id}>
                     {league.name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
             {canManageTeams && (
               <Button
                 variant="outline"
                 onClick={handleCheckRosters}
                 disabled={checking || filteredTeams.length === 0}
                 className="h-12 px-5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
               >
                 <ListChecks className="w-5 h-5 mr-2" />
                 {checking ? "Checking..." : "Check rosters"}
               </Button>
             )}
           </div>
         )}

        {checkResults && (
          <div className="mb-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-slate-500" />
                <div>
                  <div className="font-semibold text-slate-900 text-sm">Roster check</div>
                  <div className="text-xs text-slate-500">{checkResults.teamsChecked} team{checkResults.teamsChecked !== 1 ? 's' : ''} checked</div>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCheckResults(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            {checkResults.error ? (
              <div className="px-4 py-3 text-sm text-red-700 bg-red-50">Couldn't finish the check. Please try again.</div>
            ) : checkResults.problems.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-green-700 bg-green-50">
                <Check className="w-4 h-4" /> All clear - no duplicate jersey numbers.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50">
                  <AlertTriangle className="w-4 h-4" />
                  {checkResults.problems.length} team{checkResults.problems.length !== 1 ? 's' : ''} need attention
                </div>
                {checkResults.problems.map(prob => (
                  <div key={prob.teamId} className="flex items-start justify-between gap-3 px-4 py-3 border-t border-slate-100">
                    <div>
                      <div className="font-medium text-slate-900 text-sm mb-1">{prob.teamName}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        {prob.dups.map(d => (
                          <span key={d.number}><span className="text-red-600 font-medium">#{d.number}</span> · {d.players.join(', ')}</span>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-shrink-0 h-8"
                      onClick={() => { const t = teams.find(x => x.id === prob.teamId); if (t) setSelectedTeam(t); }}
                    >
                      Open <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                ))}
              </>
            )}
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
                    team={{ ...team, wins: computedStandings[team.id]?.wins ?? team.wins ?? 0, losses: computedStandings[team.id]?.losses ?? team.losses ?? 0 }}
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
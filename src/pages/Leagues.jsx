import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Trophy, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

import LeagueCard from "../components/leagues/LeagueCard";
import GroupCard from "../components/leagues/GroupCard";
import CreateLeagueDialog from "../components/leagues/CreateLeagueDialog";
import EditLeagueDialog from "../components/leagues/EditLeagueDialog";
import DeleteLeagueDialog from "../components/leagues/DeleteLeagueDialog";
import NewSeasonDialog from "../components/leagues/NewSeasonDialog";
import HelpButton from "../components/help/HelpButton";

export default function LeaguesPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingLeague, setEditingLeague] = useState(null);
  const [deletingLeague, setDeletingLeague] = useState(null);
  const [newSeasonGroup, setNewSeasonGroup] = useState(null);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    initialData: null,
  });

  React.useEffect(() => {
    if (user) {
      setCurrentUser(user);
    }
  }, [user]);

  const { data: leagues, isLoading } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list('-created_date', 200),
    initialData: [],
  });

  const { data: leagueGroups = [] } = useQuery({
    queryKey: ['leagueGroups'],
    queryFn: () => base44.entities.LeagueGroup.list(),
  });

  const createLeagueMutation = useMutation({
    mutationFn: async (leagueData) => {
      const ownerInfo = currentUser ? {
        owner_user_id: currentUser.id,
        owner_email: currentUser.email,
        owner_name: currentUser.full_name,
      } : {};
      const newLeague = await base44.entities.League.create({ ...leagueData, ...ownerInfo });
      
      // If user is league_admin, add the new league to their assigned leagues
      if (currentUser?.user_type === 'league_admin') {
        const currentAssignedLeagues = currentUser.assigned_league_ids || [];
        await base44.auth.updateMe({
          assigned_league_ids: [...currentAssignedLeagues, newLeague.id]
        });
      }
      
      return newLeague;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setShowCreateDialog(false);
    },
  });

  const editLeagueMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const original = editingLeague;
      await base44.entities.League.update(id, data);
      // Build changes list
      const fields = ["name", "season", "description"];
      const changes = fields
        .filter(f => (original[f] || "") !== (data[f] || ""))
        .map(f => ({ field: f, old_value: original[f] || "", new_value: data[f] || "" }));
      await base44.entities.LeagueAuditLog.create({
        action: "edit",
        league_id: id,
        league_name: data.name || original.name,
        performed_by: currentUser?.email || "",
        performed_by_name: currentUser?.full_name || "",
        performed_at: new Date().toISOString(),
        changes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
      setEditingLeague(null);
    },
  });

  const deleteLeagueMutation = useMutation({
    mutationFn: async (league) => {
      await base44.entities.League.delete(league.id);
      await base44.entities.LeagueAuditLog.create({
        action: "delete",
        league_id: league.id,
        league_name: league.name,
        performed_by: currentUser?.email || "",
        performed_by_name: currentUser?.full_name || "",
        performed_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
      setDeletingLeague(null);
    },
  });

  const setDefaultLeagueMutation = useMutation({
    mutationFn: (leagueId) => base44.auth.updateMe({ default_league_id: leagueId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const isLeagueAdmin = currentUser?.user_type === 'league_admin';
  const isAppAdmin = currentUser?.user_type === 'app_admin';

  // app_admin sees all leagues; everyone else only sees their assigned leagues
  const assignedLeagues = isAppAdmin
    ? leagues
    : leagues.filter(l => (currentUser?.assigned_league_ids || []).includes(l.id));

  const searchTerm = searchQuery.trim().toLowerCase();
  const matchingGroupIds = searchTerm
    ? new Set(leagueGroups.filter(g => (g.name || "").toLowerCase().includes(searchTerm)).map(g => g.id))
    : null;
  const visibleLeagues = searchTerm
    ? assignedLeagues.filter(l =>
        l.name.toLowerCase().includes(searchTerm) ||
        (l.season || "").toLowerCase().includes(searchTerm) ||
        (l.group_id && matchingGroupIds.has(l.group_id))
      )
    : assignedLeagues;

  // GROUPED_LEAGUES_V1 — partition visible leagues into group cards vs standalone cards
  const groupsById = {};
  leagueGroups.forEach(g => { groupsById[g.id] = g; });
  const seasonsByGroup = {};
  const standaloneLeagues = [];
  visibleLeagues.forEach(l => {
    if (l.group_id && groupsById[l.group_id]) {
      if (!seasonsByGroup[l.group_id]) seasonsByGroup[l.group_id] = [];
      seasonsByGroup[l.group_id].push(l);
    } else {
      standaloneLeagues.push(l);
    }
  });
  const visibleGroups = Object.keys(seasonsByGroup)
    .map(id => groupsById[id])
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const canManageSeason = (league) => isAppAdmin || (isLeagueAdmin && league.created_by_id === currentUser?.id);
  const showSetDefault = isLeagueAdmin || visibleLeagues.length > 1;

  React.useEffect(() => {
    if (currentUser && assignedLeagues.length === 1 && !currentUser.default_league_id) {
      setDefaultLeagueMutation.mutate(assignedLeagues[0].id);
    }
  }, [assignedLeagues, currentUser, setDefaultLeagueMutation]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center gap-2"><h1 className="text-3xl md:text-4xl font-bold text-slate-900">Leagues</h1><HelpButton pageKey="leagues" /></div>
            </div>
            <p className="text-slate-600 ml-15">Manage your basketball leagues and competitions</p>
          </div>
          {(currentUser?.user_type === "app_admin" || currentUser?.user_type === "league_admin") && (
             <Button 
               onClick={() => setShowCreateDialog(true)}
               className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30 h-12 px-6"
             >
               <Plus className="w-5 h-5 mr-2" />
               Create League
             </Button>
           )}
        </div>

        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search leagues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : visibleLeagues.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 px-4">
             <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
               <Trophy className="w-12 h-12 text-slate-400" />
             </div>
             <h3 className="text-2xl font-bold text-slate-900 mb-2">No Leagues Assigned</h3>
             <p className="text-slate-600 text-center mb-8 max-w-md">
               You haven't been assigned to any leagues yet. Contact an admin to get assigned.
             </p>
           </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
              {visibleGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  seasons={seasonsByGroup[group.id]}
                  userType={currentUser?.user_type}
                  defaultLeagueId={currentUser?.default_league_id}
                  onSetDefault={showSetDefault ? setDefaultLeagueMutation.mutate : null}
                  canManageSeason={canManageSeason}
                  onEdit={setEditingLeague}
                  onDelete={setDeletingLeague}
                  onNewSeason={isAppAdmin ? setNewSeasonGroup : null}
                />
              ))}
              {standaloneLeagues.map((league) => {
                const canManageLeague = canManageSeason(league);
                return (
                  <LeagueCard 
                    key={league.id} 
                    league={league} 
                    userType={currentUser?.user_type}
                    isDefault={currentUser?.default_league_id === league.id}
                    onSetDefault={showSetDefault ? setDefaultLeagueMutation.mutate : null}
                    multipleLeagues={visibleLeagues.length > 1}
                    onEdit={canManageLeague ? setEditingLeague : null}
                    onDelete={canManageLeague ? setDeletingLeague : null}
                  />
                );
              })}
            </div>
          )}

        <CreateLeagueDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSubmit={(data) => createLeagueMutation.mutate(data)}
          isLoading={createLeagueMutation.isPending}
        />

        <EditLeagueDialog
          showAdminInfo={isAppAdmin}
          open={!!editingLeague}
          onOpenChange={(open) => { if (!open) setEditingLeague(null); }}
          league={editingLeague}
          onSubmit={(data) => editLeagueMutation.mutate({ id: editingLeague.id, data })}
          isLoading={editLeagueMutation.isPending}
        />

        <NewSeasonDialog
          open={!!newSeasonGroup}
          onOpenChange={(open) => { if (!open) setNewSeasonGroup(null); }}
          group={newSeasonGroup}
          groupSeasons={newSeasonGroup ? leagues.filter(l => l.group_id === newSeasonGroup.id && !l.is_archived) : []}
        />

        <DeleteLeagueDialog
          open={!!deletingLeague}
          onOpenChange={(open) => { if (!open) setDeletingLeague(null); }}
          league={deletingLeague}
          onConfirm={() => deleteLeagueMutation.mutate(deletingLeague)}
          isLoading={deleteLeagueMutation.isPending}
        />
      </div>
    </div>
  );
}
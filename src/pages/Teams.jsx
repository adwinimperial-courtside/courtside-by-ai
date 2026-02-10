import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Users, ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import TeamCard from "../components/teams/TeamCard";
import CreateTeamDialog from "../components/teams/CreateTeamDialog";
import TeamDetailView from "../components/teams/TeamDetailView";

export default function TeamsPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const leagueIdFromUrl = urlParams.get('league');
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(leagueIdFromUrl || "all");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (leagueIdFromUrl) {
      setSelectedLeague(leagueIdFromUrl);
    }
  }, [leagueIdFromUrl]);

  const { data: leagues } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
    initialData: [],
  });

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
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setShowCreateDialog(false);
    },
  });

  const filteredTeams = selectedLeague === "all" 
    ? teams 
    : teams.filter(team => team.league_id === selectedLeague);

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
          <Button 
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/30 h-12 px-6"
            disabled={leagues.length === 0}
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Team
          </Button>
        </div>

        {leagues.length > 0 && (
          <div className="mb-8">
            <Select value={selectedLeague} onValueChange={setSelectedLeague}>
              <SelectTrigger className="w-full sm:w-64 h-12 bg-white border-slate-200">
                <SelectValue placeholder="Filter by league" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leagues</SelectItem>
                {leagues.map(league => (
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
              {leagues.length === 0 ? "Create a League First" : "No Teams Yet"}
            </h3>
            <p className="text-slate-600 text-center mb-8 max-w-md">
              {leagues.length === 0 
                ? "You need to create a league before adding teams"
                : "Start building your league by adding teams"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.map((team) => (
              <TeamCard 
                key={team.id} 
                team={team} 
                league={leagues.find(l => l.id === team.league_id)}
                onClick={() => setSelectedTeam(team)}
              />
            ))}
          </div>
        )}

        <CreateTeamDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSubmit={(data) => createTeamMutation.mutate(data)}
          isLoading={createTeamMutation.isPending}
          leagues={leagues}
        />
      </div>
    </div>
  );
}
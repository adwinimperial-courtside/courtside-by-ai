import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Trophy, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

import LeagueCard from "../components/leagues/LeagueCard";
import CreateLeagueDialog from "../components/leagues/CreateLeagueDialog";

export default function LeaguesPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };
    fetchUser();
  }, []);

  const { data: leagues, isLoading } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list('-created_date'),
    initialData: [],
  });

  const filteredLeagues = currentUser?.assigned_league_ids 
    ? leagues.filter(league => currentUser.assigned_league_ids.includes(league.id))
    : [];

  const createLeagueMutation = useMutation({
    mutationFn: (leagueData) => base44.entities.League.create(leagueData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
      setShowCreateDialog(false);
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Leagues</h1>
            </div>
            <p className="text-slate-600 ml-15">Manage your basketball leagues and competitions</p>
          </div>
          <Button 
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30 h-12 px-6"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create League
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredLeagues.length === 0 ? (
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
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {filteredLeagues.map((league) => (
               <LeagueCard key={league.id} league={league} />
             ))}
           </div>
         )}

        <CreateLeagueDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSubmit={(data) => createLeagueMutation.mutate(data)}
          isLoading={createLeagueMutation.isPending}
        />
      </div>
    </div>
  );
}
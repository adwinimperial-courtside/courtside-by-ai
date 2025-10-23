import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, User } from "lucide-react";
import { motion } from "framer-motion";

import AddPlayerDialog from "./AddPlayerDialog";
import PlayerCard from "./PlayerCard";

export default function TeamDetailView({ team, onBack }) {
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const queryClient = useQueryClient();

  const { data: players, isLoading } = useQuery({
    queryKey: ['teamPlayers', team.id],
    queryFn: () => base44.entities.Player.filter({ team_id: team.id }),
    initialData: [],
  });

  const addPlayerMutation = useMutation({
    mutationFn: (playerData) => base44.entities.Player.create({ ...playerData, team_id: team.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamPlayers', team.id] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      setShowAddPlayer(false);
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6 hover:bg-slate-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Teams
        </Button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: team.color || '#f97316' }}
              >
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900">{team.name}</h1>
                <p className="text-slate-600">Team Roster</p>
              </div>
            </div>
          </div>
          <Button 
            onClick={() => setShowAddPlayer(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg h-12 px-6"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Player
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : players.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <User className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">No Players Yet</h3>
            <p className="text-slate-600 text-center mb-8 max-w-md">
              Start building your roster by adding players
            </p>
            <Button 
              onClick={() => setShowAddPlayer(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add First Player
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {players.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <PlayerCard player={player} teamColor={team.color} />
              </motion.div>
            ))}
          </div>
        )}

        <AddPlayerDialog
          open={showAddPlayer}
          onOpenChange={setShowAddPlayer}
          onSubmit={(data) => addPlayerMutation.mutate(data)}
          isLoading={addPlayerMutation.isPending}
        />
      </div>
    </div>
  );
}
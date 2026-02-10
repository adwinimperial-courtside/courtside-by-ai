import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings } from "lucide-react";

import ManualGameEntry from "../components/admin/ManualGameEntry";

export default function AdminTools() {
  const [showManualEntry, setShowManualEntry] = useState(false);

  const { data: leagues = [] } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list(),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Settings className="w-8 h-8 text-orange-600" />
              Admin Tools
            </h1>
            <p className="text-slate-600 mt-2">Manage and maintain league data</p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="border-b border-slate-200 bg-white">
              <CardTitle className="text-xl flex items-center gap-2">
                <Plus className="w-5 h-5 text-orange-600" />
                Manual Game Entry
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Add completed games with full statistics when not using the live tracker
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              {!showManualEntry ? (
                <Button
                  onClick={() => setShowManualEntry(true)}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Game
                </Button>
              ) : (
                <ManualGameEntry
                  leagues={leagues}
                  teams={teams}
                  players={players}
                  onClose={() => setShowManualEntry(false)}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3 } from "lucide-react";

import TeamStandings from "../components/stats/TeamStandings";
import PlayerStats from "../components/stats/PlayerStats";
import LeagueLeaders from "../components/stats/LeagueLeaders";

export default function StatisticsPage() {
  const [selectedLeague, setSelectedLeague] = useState("all");

  const { data: leagues } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list(),
    initialData: [],
  });

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
    initialData: [],
  });

  const { data: players } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list(),
    initialData: [],
  });

  const { data: games } = useQuery({
    queryKey: ['games'],
    queryFn: () => base44.entities.Game.list(),
    initialData: [],
  });

  const { data: allStats } = useQuery({
    queryKey: ['allPlayerStats'],
    queryFn: () => base44.entities.PlayerStats.list(),
    initialData: [],
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Statistics</h1>
          </div>
          <p className="text-slate-600 ml-15">View comprehensive league and player statistics</p>
        </div>

        <Tabs defaultValue="standings" className="space-y-6">
          <TabsList className="bg-white border border-slate-200 p-1 h-auto flex-wrap">
            <TabsTrigger value="standings" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white px-6 py-2.5">
              Team Standings
            </TabsTrigger>
            <TabsTrigger value="players" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white px-6 py-2.5">
              Player Stats
            </TabsTrigger>
            <TabsTrigger value="leaders" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white px-6 py-2.5">
              League Leaders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="standings">
            <TeamStandings 
              teams={teams}
              games={games}
              leagues={leagues}
            />
          </TabsContent>

          <TabsContent value="players">
            <PlayerStats
              players={players}
              teams={teams}
              stats={allStats}
            />
          </TabsContent>

          <TabsContent value="leaders">
            <LeagueLeaders
              players={players}
              teams={teams}
              stats={allStats}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
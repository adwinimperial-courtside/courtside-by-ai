import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Filter } from "lucide-react";

import TeamStats from "../components/stats/TeamStats";
import PlayerStats from "../components/stats/PlayerStats";
import LeagueLeaders from "../components/stats/LeagueLeaders";
import GameStats from "../components/stats/GameStats";


export default function StatisticsPage() {
  const [selectedLeague, setSelectedLeague] = useState("all");
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [selectedPlayer, setSelectedPlayer] = useState("all");

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

  // Filter data based on selections
  const filteredTeams = selectedLeague === "all" 
    ? teams 
    : teams.filter(t => t.league_id === selectedLeague);

  const filteredPlayers = selectedTeam === "all" 
    ? (selectedLeague === "all" 
        ? players 
        : players.filter(p => {
            const team = teams.find(t => t.id === p.team_id);
            return team?.league_id === selectedLeague;
          }))
    : players.filter(p => p.team_id === selectedTeam);

  const filteredGames = selectedLeague === "all"
    ? (selectedTeam === "all" 
        ? games 
        : games.filter(g => g.home_team_id === selectedTeam || g.away_team_id === selectedTeam))
    : games.filter(g => {
        const homeTeam = teams.find(t => t.id === g.home_team_id);
        const awayTeam = teams.find(t => t.id === g.away_team_id);
        if (selectedTeam === "all") {
          return homeTeam?.league_id === selectedLeague || awayTeam?.league_id === selectedLeague;
        }
        return (g.home_team_id === selectedTeam || g.away_team_id === selectedTeam);
      });

  const filteredStats = selectedTeam === "all"
    ? (selectedLeague === "all"
        ? allStats
        : allStats.filter(s => {
            const game = games.find(g => g.id === s.game_id);
            const homeTeam = teams.find(t => t.id === game?.home_team_id);
            return homeTeam?.league_id === selectedLeague;
          }))
    : allStats.filter(s => s.team_id === selectedTeam);

  const availableTeams = selectedLeague === "all" 
    ? teams 
    : teams.filter(t => t.league_id === selectedLeague);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Statistics & Analytics</h1>
          </div>
          <p className="text-slate-600 ml-15">Comprehensive league, team, and player statistics</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">League</label>
              <Select value={selectedLeague} onValueChange={(value) => {
                setSelectedLeague(value);
                setSelectedTeam("all");
                setSelectedPlayer("all");
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select league" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Leagues</SelectItem>
                  {leagues.map(league => (
                    <SelectItem key={league.id} value={league.id}>
                      {league.name} ({league.season})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Team</label>
              <Select value={selectedTeam} onValueChange={(value) => {
                setSelectedTeam(value);
                setSelectedPlayer("all");
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {availableTeams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Player</label>
              <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select player" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Players</SelectItem>
                  {filteredPlayers.map(player => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Tabs defaultValue="teamstats" className="space-y-6">
          <TabsList className="bg-white border border-slate-200 p-1 h-auto flex-wrap">
            <TabsTrigger value="teamstats" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white px-6 py-2.5">
              Team Stats
            </TabsTrigger>
            <TabsTrigger value="players" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white px-6 py-2.5">
              Player Stats
            </TabsTrigger>
            <TabsTrigger value="leaders" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white px-6 py-2.5">
              League Leaders
            </TabsTrigger>
            <TabsTrigger value="games" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white px-6 py-2.5">
              Game Stats
            </TabsTrigger>
            </TabsList>

          <TabsContent value="teamstats">
            <TeamStats 
              teams={filteredTeams}
              games={filteredGames}
              stats={filteredStats}
              leagues={leagues}
            />
          </TabsContent>

          <TabsContent value="players">
             <PlayerStats
               players={selectedPlayer === "all" ? filteredPlayers : filteredPlayers.filter(p => p.id === selectedPlayer)}
               teams={teams}
               stats={filteredStats}
             />
           </TabsContent>

          <TabsContent value="leaders">
            <LeagueLeaders
              players={filteredPlayers}
              teams={teams}
              stats={filteredStats}
            />
          </TabsContent>

          <TabsContent value="games">
            <GameStats
              games={filteredGames}
              teams={teams}
              players={players}
              stats={allStats}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
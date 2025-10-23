import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Play, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function GameCard({ game, teams, leagues, onStartGame }) {
  const homeTeam = teams.find(t => t.id === game.home_team_id);
  const awayTeam = teams.find(t => t.id === game.away_team_id);
  const league = leagues.find(l => l.id === game.league_id);

  const statusColors = {
    scheduled: "bg-blue-100 text-blue-800",
    in_progress: "bg-orange-100 text-orange-800",
    completed: "bg-green-100 text-green-800"
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-slate-200 hover:shadow-lg transition-all duration-200">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                {league && (
                  <Badge variant="outline" className="text-xs">
                    {league.name}
                  </Badge>
                )}
                <Badge className={statusColors[game.status]}>
                  {game.status === 'in_progress' ? 'Live' : game.status.replace('_', ' ')}
                </Badge>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: homeTeam?.color || '#f97316' }}
                    >
                      {homeTeam?.name?.[0]}
                    </div>
                    <span className="font-semibold text-slate-900">{homeTeam?.name}</span>
                  </div>
                  {game.status === 'completed' && (
                    <span className="text-2xl font-bold text-slate-900">{game.home_score}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: awayTeam?.color || '#f97316' }}
                    >
                      {awayTeam?.name?.[0]}
                    </div>
                    <span className="font-semibold text-slate-900">{awayTeam?.name}</span>
                  </div>
                  {game.status === 'completed' && (
                    <span className="text-2xl font-bold text-slate-900">{game.away_score}</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(game.game_date), "MMM d, yyyy • h:mm a")}</span>
                </div>
                {game.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{game.location}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              {game.status === 'scheduled' && (
                <Button
                  onClick={onStartGame}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Game
                </Button>
              )}
              {game.status === 'in_progress' && (
                <Button
                  onClick={onStartGame}
                  variant="outline"
                  className="border-orange-500 text-orange-600 hover:bg-orange-50"
                >
                  Continue
                </Button>
              )}
              {game.status === 'completed' && (
                <Button variant="outline" disabled>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Final
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
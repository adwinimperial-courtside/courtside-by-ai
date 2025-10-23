import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, Play } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function StartingLineup({
  game,
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
  homeStarters,
  awayStarters,
  onHomeStartersChange,
  onAwayStartersChange,
  onStartGame,
  onBack
}) {
  const toggleHomeStarter = (playerId) => {
    if (homeStarters.includes(playerId)) {
      onHomeStartersChange(homeStarters.filter(id => id !== playerId));
    } else if (homeStarters.length < 5) {
      onHomeStartersChange([...homeStarters, playerId]);
    }
  };

  const toggleAwayStarter = (playerId) => {
    if (awayStarters.includes(playerId)) {
      onAwayStartersChange(awayStarters.filter(id => id !== playerId));
    } else if (awayStarters.length < 5) {
      onAwayStartersChange([...awayStarters, playerId]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6 text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Select Starting Lineups</h1>
          <p className="text-slate-400">Choose 5 players from each team to start the game</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardHeader className="border-b border-white/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: homeTeam?.color || '#f97316' }}
                  >
                    {homeTeam?.name?.[0]}
                  </div>
                  {homeTeam?.name}
                </CardTitle>
                <span className="text-sm text-slate-400">{homeStarters.length}/5</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {homePlayers.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No players available</p>
              ) : (
                homePlayers.map(player => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${
                      homeStarters.includes(player.id) 
                        ? 'bg-orange-500/20 border border-orange-500/50' 
                        : 'hover:bg-white/5'
                    }`}
                    onClick={() => toggleHomeStarter(player.id)}
                  >
                    <Checkbox 
                      checked={homeStarters.includes(player.id)}
                      className="border-white/30"
                    />
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: homeTeam?.color || '#f97316' }}
                    >
                      {player.jersey_number}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{player.name}</p>
                      <p className="text-sm text-slate-400">{player.position}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardHeader className="border-b border-white/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: awayTeam?.color || '#f97316' }}
                  >
                    {awayTeam?.name?.[0]}
                  </div>
                  {awayTeam?.name}
                </CardTitle>
                <span className="text-sm text-slate-400">{awayStarters.length}/5</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {awayPlayers.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No players available</p>
              ) : (
                awayPlayers.map(player => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${
                      awayStarters.includes(player.id) 
                        ? 'bg-orange-500/20 border border-orange-500/50' 
                        : 'hover:bg-white/5'
                    }`}
                    onClick={() => toggleAwayStarter(player.id)}
                  >
                    <Checkbox 
                      checked={awayStarters.includes(player.id)}
                      className="border-white/30"
                    />
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: awayTeam?.color || '#f97316' }}
                    >
                      {player.jersey_number}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{player.name}</p>
                      <p className="text-sm text-slate-400">{player.position}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button
            onClick={onStartGame}
            disabled={homeStarters.length !== 5 || awayStarters.length !== 5}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 h-14 px-12 text-lg shadow-2xl shadow-orange-500/30"
          >
            <Play className="w-5 h-5 mr-2" />
            Start Game
          </Button>
          {(homeStarters.length !== 5 || awayStarters.length !== 5) && (
            <p className="text-sm text-slate-400 mt-3">
              Please select exactly 5 starters for each team
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
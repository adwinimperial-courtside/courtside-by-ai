import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { X, Save } from "lucide-react";

export default function ManualGameEntry({ leagues, teams, players, onClose }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [gameData, setGameData] = useState({
    league_id: "",
    game_date: "",
    home_team_id: "",
    away_team_id: "",
    location: "",
    home_score: 0,
    away_score: 0,
  });
  const [playerStats, setPlayerStats] = useState([]);

  const homeTeamPlayers = players.filter(p => p.team_id === gameData.home_team_id);
  const awayTeamPlayers = players.filter(p => p.team_id === gameData.away_team_id);

  const createGameMutation = useMutation({
    mutationFn: async (data) => {
      // Create game
      const game = await base44.entities.Game.create({
        league_id: data.league_id,
        home_team_id: data.home_team_id,
        away_team_id: data.away_team_id,
        game_date: new Date(data.game_date).toISOString(),
        status: 'completed',
        home_score: data.home_score,
        away_score: data.away_score,
        location: data.location || 'Not specified',
      });

      // Create player stats
      await Promise.all(
        data.playerStats.map(stat =>
          base44.entities.PlayerStats.create({
            game_id: game.id,
            player_id: stat.player_id,
            team_id: stat.team_id,
            is_starter: true,
            ...stat.stats,
          })
        )
      );

      // Update team records
      const homeWon = data.home_score > data.away_score;
      const homeTeam = teams.find(t => t.id === data.home_team_id);
      const awayTeam = teams.find(t => t.id === data.away_team_id);

      await base44.entities.Team.update(data.home_team_id, {
        wins: homeWon ? (homeTeam.wins || 0) + 1 : homeTeam.wins || 0,
        losses: !homeWon ? (homeTeam.losses || 0) + 1 : homeTeam.losses || 0,
      });

      await base44.entities.Team.update(data.away_team_id, {
        wins: !homeWon ? (awayTeam.wins || 0) + 1 : awayTeam.wins || 0,
        losses: homeWon ? (awayTeam.losses || 0) + 1 : awayTeam.losses || 0,
      });

      return game;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['playerStats'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      alert('Game added successfully!');
      onClose();
    },
  });

  const initializePlayerStats = () => {
    const stats = [
      ...homeTeamPlayers.map(p => ({
        player_id: p.id,
        team_id: gameData.home_team_id,
        player_name: p.name,
        jersey_number: p.jersey_number,
        stats: {
          points_2: 0,
          points_3: 0,
          free_throws: 0,
          offensive_rebounds: 0,
          defensive_rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          fouls: 0,
          technical_fouls: 0,
          unsportsmanlike_fouls: 0,
        }
      })),
      ...awayTeamPlayers.map(p => ({
        player_id: p.id,
        team_id: gameData.away_team_id,
        player_name: p.name,
        jersey_number: p.jersey_number,
        stats: {
          points_2: 0,
          points_3: 0,
          free_throws: 0,
          offensive_rebounds: 0,
          defensive_rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          fouls: 0,
          technical_fouls: 0,
          unsportsmanlike_fouls: 0,
        }
      }))
    ];
    setPlayerStats(stats);
    setStep(2);
  };

  const updatePlayerStat = (playerId, statKey, value) => {
    setPlayerStats(prev =>
      prev.map(ps =>
        ps.player_id === playerId
          ? { ...ps, stats: { ...ps.stats, [statKey]: parseInt(value) || 0 } }
          : ps
      )
    );
  };

  const calculateScores = () => {
    const homeStats = playerStats.filter(ps => ps.team_id === gameData.home_team_id);
    const awayStats = playerStats.filter(ps => ps.team_id === gameData.away_team_id);

    const homeScore = homeStats.reduce((sum, ps) =>
      sum + (ps.stats.points_2 * 2) + (ps.stats.points_3 * 3) + ps.stats.free_throws, 0
    );
    const awayScore = awayStats.reduce((sum, ps) =>
      sum + (ps.stats.points_2 * 2) + (ps.stats.points_3 * 3) + ps.stats.free_throws, 0
    );

    setGameData(prev => ({ ...prev, home_score: homeScore, away_score: awayScore }));
  };

  const handleSubmit = () => {
    calculateScores();
    createGameMutation.mutate({
      ...gameData,
      playerStats,
    });
  };

  const homeTeam = teams.find(t => t.id === gameData.home_team_id);
  const awayTeam = teams.find(t => t.id === gameData.away_team_id);

  if (step === 1) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>League *</Label>
            <Select value={gameData.league_id} onValueChange={(value) => setGameData({ ...gameData, league_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select league" />
              </SelectTrigger>
              <SelectContent>
                {leagues.map(league => (
                  <SelectItem key={league.id} value={league.id}>{league.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Game Date *</Label>
            <Input
              type="datetime-local"
              value={gameData.game_date}
              onChange={(e) => setGameData({ ...gameData, game_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Home Team *</Label>
            <Select value={gameData.home_team_id} onValueChange={(value) => setGameData({ ...gameData, home_team_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select home team" />
              </SelectTrigger>
              <SelectContent>
                {teams.filter(t => t.league_id === gameData.league_id && t.id !== gameData.away_team_id).map(team => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Away Team *</Label>
            <Select value={gameData.away_team_id} onValueChange={(value) => setGameData({ ...gameData, away_team_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select away team" />
              </SelectTrigger>
              <SelectContent>
                {teams.filter(t => t.league_id === gameData.league_id && t.id !== gameData.home_team_id).map(team => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Venue (Optional)</Label>
            <Input
              placeholder="Enter venue location"
              value={gameData.location}
              onChange={(e) => setGameData({ ...gameData, location: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={initializePlayerStats}
            disabled={!gameData.league_id || !gameData.game_date || !gameData.home_team_id || !gameData.away_team_id}
            className="bg-gradient-to-r from-orange-500 to-orange-600"
          >
            Next: Enter Player Stats
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-100 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-600">Game Details</p>
            <p className="font-semibold text-lg">
              {homeTeam?.name} vs {awayTeam?.name}
            </p>
            <p className="text-sm text-slate-600">{new Date(gameData.game_date).toLocaleString()}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setStep(1)}>
            Edit Details
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: homeTeam?.color }}>
              {homeTeam?.name?.[0]}
            </div>
            {homeTeam?.name}
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {playerStats.filter(ps => ps.team_id === gameData.home_team_id).map(ps => (
              <PlayerStatRow key={ps.player_id} playerStat={ps} updateStat={updatePlayerStat} />
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: awayTeam?.color }}>
              {awayTeam?.name?.[0]}
            </div>
            {awayTeam?.name}
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {playerStats.filter(ps => ps.team_id === gameData.away_team_id).map(ps => (
              <PlayerStatRow key={ps.player_id} playerStat={ps} updateStat={updatePlayerStat} />
            ))}
          </div>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createGameMutation.isPending}
          className="bg-gradient-to-r from-green-500 to-green-600"
        >
          <Save className="w-4 h-4 mr-2" />
          {createGameMutation.isPending ? 'Saving...' : 'Save Game'}
        </Button>
      </div>
    </div>
  );
}

function PlayerStatRow({ playerStat, updateStat }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center text-xs font-bold">
            {playerStat.jersey_number}
          </div>
          <span className="font-medium text-sm">{playerStat.player_name}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? '−' : '+'}
        </Button>
      </div>

      {expanded && (
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div>
            <Label className="text-xs">2PT</Label>
            <Input
              type="number"
              min="0"
              value={playerStat.stats.points_2}
              onChange={(e) => updateStat(playerStat.player_id, 'points_2', e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">3PT</Label>
            <Input
              type="number"
              min="0"
              value={playerStat.stats.points_3}
              onChange={(e) => updateStat(playerStat.player_id, 'points_3', e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">FT</Label>
            <Input
              type="number"
              min="0"
              value={playerStat.stats.free_throws}
              onChange={(e) => updateStat(playerStat.player_id, 'free_throws', e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">OREB</Label>
            <Input
              type="number"
              min="0"
              value={playerStat.stats.offensive_rebounds}
              onChange={(e) => updateStat(playerStat.player_id, 'offensive_rebounds', e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">DREB</Label>
            <Input
              type="number"
              min="0"
              value={playerStat.stats.defensive_rebounds}
              onChange={(e) => updateStat(playerStat.player_id, 'defensive_rebounds', e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">AST</Label>
            <Input
              type="number"
              min="0"
              value={playerStat.stats.assists}
              onChange={(e) => updateStat(playerStat.player_id, 'assists', e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">STL</Label>
            <Input
              type="number"
              min="0"
              value={playerStat.stats.steals}
              onChange={(e) => updateStat(playerStat.player_id, 'steals', e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">BLK</Label>
            <Input
              type="number"
              min="0"
              value={playerStat.stats.blocks}
              onChange={(e) => updateStat(playerStat.player_id, 'blocks', e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">TO</Label>
            <Input
              type="number"
              min="0"
              value={playerStat.stats.turnovers}
              onChange={(e) => updateStat(playerStat.player_id, 'turnovers', e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">FOULS</Label>
            <Input
              type="number"
              min="0"
              value={playerStat.stats.fouls}
              onChange={(e) => updateStat(playerStat.player_id, 'fouls', e.target.value)}
              className="h-8"
            />
          </div>
        </div>
      )}
    </div>
  );
}
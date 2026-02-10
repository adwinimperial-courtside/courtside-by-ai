import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { X, Save, Upload } from "lucide-react";
import { findPlayerOfGame } from "../utils/pogCalculator";
import GameConfirmationModal from "./GameConfirmationModal";

export default function ManualGameEntry({ leagues, teams, players, onClose }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [gameData, setGameData] = useState({
    league_id: "",
    game_date: "",
    home_team_id: "",
    away_team_id: "",
    location: "",
    player_of_game: "",
    home_score: 0,
    away_score: 0,
  });
  const [playerStats, setPlayerStats] = useState([]);
  const [winningTeamId, setWinningTeamId] = useState("");
  const [confirmationData, setConfirmationData] = useState(null);

  const homeTeamPlayers = players.filter(p => p.team_id === gameData.home_team_id);
  const awayTeamPlayers = players.filter(p => p.team_id === gameData.away_team_id);

  const createGameMutation = useMutation({
    mutationFn: async (data) => {
      // Prepare player stats for database
      const statsForDb = data.playerStats.map(stat => {
        const points3Value = (stat.stats.points_3 || 0) * 3;
        const ftValue = stat.stats.free_throws || 0;
        const totalPoints = stat.stats.total_points || 0;
        const points2Value = Math.max(0, Math.floor((totalPoints - points3Value - ftValue) / 2));
        
        return {
          player_id: stat.player_id,
          team_id: stat.team_id,
          is_starter: true,
          points_2: points2Value,
          points_3: stat.stats.points_3,
          free_throws: stat.stats.free_throws,
          offensive_rebounds: stat.stats.offensive_rebounds,
          defensive_rebounds: stat.stats.defensive_rebounds,
          assists: stat.stats.assists,
          steals: stat.stats.steals,
          blocks: stat.stats.blocks,
          turnovers: stat.stats.turnovers,
          fouls: stat.stats.fouls,
          technical_fouls: stat.stats.technical_fouls,
          unsportsmanlike_fouls: stat.stats.unsportsmanlike_fouls,
        };
      });

      // Calculate Player of the Game automatically from winning team
      const gameForPOG = {
        home_team_id: data.home_team_id,
        away_team_id: data.away_team_id,
        home_score: data.home_score,
        away_score: data.away_score
      };
      const playerOfGameId = findPlayerOfGame(statsForDb, gameForPOG);

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
        player_of_game: playerOfGameId,
        entry_type: 'manual',
      });

      // Create player stats with game_id
      await Promise.all(
        statsForDb.map(stat => 
          base44.entities.PlayerStats.create({
            ...stat,
            game_id: game.id,
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
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['playerStats'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setConfirmationData(game);
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
          total_points: 0,
          points_3: 0,
          free_throws: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          offensive_rebounds: 0,
          defensive_rebounds: 0,
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
          total_points: 0,
          points_3: 0,
          free_throws: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          offensive_rebounds: 0,
          defensive_rebounds: 0,
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

  const homeFileInputRef = useRef(null);
  const awayFileInputRef = useRef(null);

  const handleCsvImport = async (e, teamId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      
      const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
      const playerIdx = headers.findIndex(h => h === 'PLAYER');
      const ptsIdx = headers.findIndex(h => h === 'POINTS');
      const tptIdx = headers.findIndex(h => h === '3 POINTS');
      const ftIdx = headers.findIndex(h => h === 'FT');
      const astIdx = headers.findIndex(h => h === 'ASSIST');
      const stlIdx = headers.findIndex(h => h === 'STEAL');
      const blkIdx = headers.findIndex(h => h === 'BLOCK');
      const orebIdx = headers.findIndex(h => h === 'OREB');
      const drebIdx = headers.findIndex(h => h === 'DREB');
      const toIdx = headers.findIndex(h => h === 'TURNOVER');
      const foulIdx = headers.findIndex(h => h === 'FOUL');
      const tfIdx = headers.findIndex(h => h === 'TECHNICAL');
      const unspoIdx = headers.findIndex(h => h === 'UNSPORTSMANLIKE');

      setPlayerStats(prev =>
        prev.map(ps => {
          if (ps.team_id !== teamId) return ps;

          const playerRow = lines.slice(1).find(line => {
            const cols = line.split(',').map(c => c.trim());
            return cols[playerIdx]?.toLowerCase() === ps.player_name.toLowerCase();
          });

          if (!playerRow) return ps;

          const cols = playerRow.split(',').map(c => c.trim());
          return {
            ...ps,
            stats: {
              ...ps.stats,
              total_points: parseInt(cols[ptsIdx]) || 0,
              points_3: parseInt(cols[tptIdx]) || 0,
              free_throws: parseInt(cols[ftIdx]) || 0,
              assists: parseInt(cols[astIdx]) || 0,
              steals: parseInt(cols[stlIdx]) || 0,
              blocks: parseInt(cols[blkIdx]) || 0,
              offensive_rebounds: parseInt(cols[orebIdx]) || 0,
              defensive_rebounds: parseInt(cols[drebIdx]) || 0,
              turnovers: parseInt(cols[toIdx]) || 0,
              fouls: parseInt(cols[foulIdx]) || 0,
              technical_fouls: parseInt(cols[tfIdx]) || 0,
              unsportsmanlike_fouls: parseInt(cols[unspoIdx]) || 0,
            }
          };
        })
      );
    } catch (error) {
      alert("Error reading CSV file. Ensure it has columns: PLAYER, POINTS, 3 POINTS, FT, ASSIST, STEAL, BLOCK, OREB, DREB, TURNOVER, FOUL, TECHNICAL, UNSPORTSMANLIKE");
    }
  };

  const calculateScores = () => {
    const homeStats = playerStats.filter(ps => ps.team_id === gameData.home_team_id);
    const awayStats = playerStats.filter(ps => ps.team_id === gameData.away_team_id);

    const homeScore = homeStats.reduce((sum, ps) => sum + ps.stats.total_points, 0);
    const awayScore = awayStats.reduce((sum, ps) => sum + ps.stats.total_points, 0);

    setGameData(prev => ({ ...prev, home_score: homeScore, away_score: awayScore }));
  };

  const handleSubmit = () => {
    const homeStats = playerStats.filter(ps => ps.team_id === gameData.home_team_id);
    const awayStats = playerStats.filter(ps => ps.team_id === gameData.away_team_id);

    const homeScore = homeStats.reduce((sum, ps) => sum + ps.stats.total_points, 0);
    const awayScore = awayStats.reduce((sum, ps) => sum + ps.stats.total_points, 0);

    createGameMutation.mutate({
      ...gameData,
      home_score: homeScore,
      away_score: awayScore,
      playerStats,
    });
  };

  const homeTeam = teams.find(t => t.id === gameData.home_team_id);
  const awayTeam = teams.find(t => t.id === gameData.away_team_id);

  if (confirmationData) {
    return (
      <GameConfirmationModal
        isOpen={!!confirmationData}
        game={confirmationData}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        playerOfGame={confirmationData.player_of_game}
        players={players}
        onClose={() => {
          setConfirmationData(null);
          onClose();
        }}
      />
    );
  }

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

  const homeStats = playerStats.filter(ps => ps.team_id === gameData.home_team_id);
  const awayStats = playerStats.filter(ps => ps.team_id === gameData.away_team_id);

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

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: homeTeam?.color }}>
                {homeTeam?.name?.[0]}
              </div>
              {homeTeam?.name}
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => homeFileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </Button>
            <input
              ref={homeFileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => handleCsvImport(e, gameData.home_team_id)}
              className="hidden"
            />
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Player</th>
                  <th className="px-3 py-2 text-center font-semibold">PTS</th>
                  <th className="px-3 py-2 text-center font-semibold">3PT</th>
                  <th className="px-3 py-2 text-center font-semibold">FT</th>
                  <th className="px-3 py-2 text-center font-semibold">AST</th>
                  <th className="px-3 py-2 text-center font-semibold">STL</th>
                  <th className="px-3 py-2 text-center font-semibold">BLK</th>
                  <th className="px-3 py-2 text-center font-semibold">OREB</th>
                  <th className="px-3 py-2 text-center font-semibold">DREB</th>
                  <th className="px-3 py-2 text-center font-semibold">TO</th>
                  <th className="px-3 py-2 text-center font-semibold">FOUL</th>
                  <th className="px-3 py-2 text-center font-semibold">TF</th>
                  <th className="px-3 py-2 text-center font-semibold">UNSPO</th>
                </tr>
              </thead>
              <tbody>
                {homeStats.map((ps, idx) => (
                  <tr key={ps.player_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-2 font-semibold">{ps.jersey_number}</td>
                    <td className="px-3 py-2">{ps.player_name}</td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.total_points} onChange={(e) => updatePlayerStat(ps.player_id, 'total_points', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.points_3} onChange={(e) => updatePlayerStat(ps.player_id, 'points_3', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.free_throws} onChange={(e) => updatePlayerStat(ps.player_id, 'free_throws', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.assists} onChange={(e) => updatePlayerStat(ps.player_id, 'assists', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.steals} onChange={(e) => updatePlayerStat(ps.player_id, 'steals', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.blocks} onChange={(e) => updatePlayerStat(ps.player_id, 'blocks', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.offensive_rebounds} onChange={(e) => updatePlayerStat(ps.player_id, 'offensive_rebounds', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.defensive_rebounds} onChange={(e) => updatePlayerStat(ps.player_id, 'defensive_rebounds', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.turnovers} onChange={(e) => updatePlayerStat(ps.player_id, 'turnovers', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.fouls} onChange={(e) => updatePlayerStat(ps.player_id, 'fouls', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.technical_fouls} onChange={(e) => updatePlayerStat(ps.player_id, 'technical_fouls', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.unsportsmanlike_fouls} onChange={(e) => updatePlayerStat(ps.player_id, 'unsportsmanlike_fouls', e.target.value)} className="h-8 w-16 text-center" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: awayTeam?.color }}>
                {awayTeam?.name?.[0]}
              </div>
              {awayTeam?.name}
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => awayFileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </Button>
            <input
              ref={awayFileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => handleCsvImport(e, gameData.away_team_id)}
              className="hidden"
            />
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Player</th>
                  <th className="px-3 py-2 text-center font-semibold">PTS</th>
                  <th className="px-3 py-2 text-center font-semibold">3PT</th>
                  <th className="px-3 py-2 text-center font-semibold">FT</th>
                  <th className="px-3 py-2 text-center font-semibold">AST</th>
                  <th className="px-3 py-2 text-center font-semibold">STL</th>
                  <th className="px-3 py-2 text-center font-semibold">BLK</th>
                  <th className="px-3 py-2 text-center font-semibold">OREB</th>
                  <th className="px-3 py-2 text-center font-semibold">DREB</th>
                  <th className="px-3 py-2 text-center font-semibold">TO</th>
                  <th className="px-3 py-2 text-center font-semibold">FOUL</th>
                  <th className="px-3 py-2 text-center font-semibold">TF</th>
                  <th className="px-3 py-2 text-center font-semibold">UNSPO</th>
                </tr>
              </thead>
              <tbody>
                {awayStats.map((ps, idx) => (
                  <tr key={ps.player_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-2 font-semibold">{ps.jersey_number}</td>
                    <td className="px-3 py-2">{ps.player_name}</td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.total_points} onChange={(e) => updatePlayerStat(ps.player_id, 'total_points', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.points_3} onChange={(e) => updatePlayerStat(ps.player_id, 'points_3', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.free_throws} onChange={(e) => updatePlayerStat(ps.player_id, 'free_throws', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.assists} onChange={(e) => updatePlayerStat(ps.player_id, 'assists', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.steals} onChange={(e) => updatePlayerStat(ps.player_id, 'steals', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.blocks} onChange={(e) => updatePlayerStat(ps.player_id, 'blocks', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.offensive_rebounds} onChange={(e) => updatePlayerStat(ps.player_id, 'offensive_rebounds', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.defensive_rebounds} onChange={(e) => updatePlayerStat(ps.player_id, 'defensive_rebounds', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.turnovers} onChange={(e) => updatePlayerStat(ps.player_id, 'turnovers', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.fouls} onChange={(e) => updatePlayerStat(ps.player_id, 'fouls', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.technical_fouls} onChange={(e) => updatePlayerStat(ps.player_id, 'technical_fouls', e.target.value)} className="h-8 w-16 text-center" /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={ps.stats.unsportsmanlike_fouls} onChange={(e) => updatePlayerStat(ps.player_id, 'unsportsmanlike_fouls', e.target.value)} className="h-8 w-16 text-center" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose}>
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createGameMutation.isPending}
          className="bg-gradient-to-r from-green-500 to-green-600 flex-1"
        >
          <Save className="w-4 h-4 mr-2" />
          {createGameMutation.isPending ? 'Saving Game...' : 'Complete & Save Game'}
        </Button>
      </div>
    </div>
  );
}
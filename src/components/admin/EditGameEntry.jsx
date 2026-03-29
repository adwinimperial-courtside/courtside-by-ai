import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function EditGameEntry({ leagues, teams, players, onClose }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedLeague, setSelectedLeague] = useState("");
  const [selectedGame, setSelectedGame] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
  const [winningTeamId, setWinningTeamId] = useState("");
  const [addPlayerModal, setAddPlayerModal] = useState(false);
  const [addPlayerTeamId, setAddPlayerTeamId] = useState(null);

  const { data: completedGames = [] } = useQuery({
    queryKey: ['completedGames', selectedLeague],
    queryFn: () => selectedLeague ? base44.entities.Game.filter({ league_id: selectedLeague, status: 'completed' }, '-game_date') : Promise.resolve([]),
    enabled: !!selectedLeague,
  });

  const { data: existingStats = [] } = useQuery({
    queryKey: ['editGameStats', selectedGame?.id],
    queryFn: () => selectedGame ? base44.entities.PlayerStats.filter({ game_id: selectedGame.id }) : Promise.resolve([]),
    enabled: !!selectedGame,
  });

  useEffect(() => {
    if (existingStats.length > 0 && selectedGame) {
      const isEdited = selectedGame.edited || selectedGame.entry_type === 'manual';
      const stats = existingStats.map(stat => {
        const player = players.find(p => p.id === stat.player_id);
        const totalPoints = isEdited
          ? (stat.points_2 || 0) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0)
          : ((stat.points_2 || 0) * 2) + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0);
        return {
          stat_id: stat.id,
          player_id: stat.player_id,
          team_id: stat.team_id,
          player_name: player?.name,
          jersey_number: player?.jersey_number,
          stats: {
            total_points: totalPoints,
            points_3: stat.points_3 || 0,
            free_throws: stat.free_throws || 0,
            assists: stat.assists || 0,
            steals: stat.steals || 0,
            blocks: stat.blocks || 0,
            offensive_rebounds: stat.offensive_rebounds || 0,
            defensive_rebounds: stat.defensive_rebounds || 0,
            turnovers: stat.turnovers || 0,
            fouls: stat.fouls || 0,
            technical_fouls: stat.technical_fouls || 0,
            unsportsmanlike_fouls: stat.unsportsmanlike_fouls || 0,
          }
        };
      });
      setPlayerStats(stats);
    }
  }, [existingStats, players, selectedGame]);

  const updateGameMutation = useMutation({
    mutationFn: async (data) => {
      // Update and create player stats
      await Promise.all(
        data.playerStats.map(stat => {
          const points3Value = (stat.stats.points_3 || 0) * 3;
          const ftValue = stat.stats.free_throws || 0;
          const totalPoints = stat.stats.total_points || 0;
          // Store remaining points directly (no /2) so display is lossless
          const points2Value = Math.max(0, totalPoints - points3Value - ftValue);
          
          // New player (no stat_id)
          if (!stat.stat_id) {
            return base44.entities.PlayerStats.create({
              game_id: data.game.id,
              player_id: stat.player_id,
              team_id: stat.team_id,
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
            });
          }
          
          // Existing player
          return base44.entities.PlayerStats.update(stat.stat_id, {
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
          });
        })
      );

      // Delete removed players
      const existingPlayerIds = existingStats.map(s => s.player_id);
      const currentPlayerIds = data.playerStats.map(ps => ps.player_id);
      const removedPlayerIds = existingPlayerIds.filter(id => !currentPlayerIds.includes(id));
      
      await Promise.all(
        removedPlayerIds.map(playerId => {
          const statToDelete = existingStats.find(s => s.player_id === playerId);
          if (statToDelete) {
            return base44.entities.PlayerStats.delete(statToDelete.id);
          }
        })
      );

      // Update game with new scores and mark as edited
      await base44.entities.Game.update(data.game.id, {
        home_score: data.home_score,
        away_score: data.away_score,
        player_of_game: data.player_of_game,
        edited: true,
      });

      return data.game;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['allPlayerStats'] });
      queryClient.invalidateQueries({ queryKey: ['completedGames'] });
      alert('Game updated successfully!');
      onClose();
    },
  });

  const updatePlayerStat = (playerId, statKey, value) => {
    setPlayerStats(prev =>
      prev.map(ps =>
        ps.player_id === playerId
          ? { ...ps, stats: { ...ps.stats, [statKey]: parseInt(value) || 0 } }
          : ps
      )
    );
  };

  const removePlayer = (playerId) => {
    setPlayerStats(prev => prev.filter(ps => ps.player_id !== playerId));
  };

  const addPlayer = (teamId) => {
    setAddPlayerTeamId(teamId);
    setAddPlayerModal(true);
  };

  const selectPlayer = (player) => {
    setPlayerStats(prev => [...prev, {
      stat_id: null,
      player_id: player.id,
      team_id: addPlayerTeamId,
      player_name: player.name,
      jersey_number: player.jersey_number,
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
    }]);
    setAddPlayerModal(false);
  };

  const selectGame = (gameId) => {
    const game = completedGames.find(g => g.id === gameId);
    setSelectedGame(game);
    setStep(2);
  };

  const proceedToPlayerSelection = () => {
    const homeStats = playerStats.filter(ps => ps.team_id === selectedGame.home_team_id);
    const awayStats = playerStats.filter(ps => ps.team_id === selectedGame.away_team_id);

    const homeScore = homeStats.reduce((sum, ps) => sum + ps.stats.total_points, 0);
    const awayScore = awayStats.reduce((sum, ps) => sum + ps.stats.total_points, 0);

    const winningTeam = homeScore > awayScore ? selectedGame.home_team_id : selectedGame.away_team_id;
    
    setWinningTeamId(winningTeam);
    setStep(3);
  };

  const handleSubmit = () => {
    const homeStats = playerStats.filter(ps => ps.team_id === selectedGame.home_team_id);
    const awayStats = playerStats.filter(ps => ps.team_id === selectedGame.away_team_id);

    const homeScore = homeStats.reduce((sum, ps) => sum + ps.stats.total_points, 0);
    const awayScore = awayStats.reduce((sum, ps) => sum + ps.stats.total_points, 0);

    updateGameMutation.mutate({
      game: selectedGame,
      playerStats,
      home_score: homeScore,
      away_score: awayScore,
      player_of_game: selectedGame.player_of_game,
    });
  };

  const homeTeam = teams.find(t => t.id === selectedGame?.home_team_id);
  const awayTeam = teams.find(t => t.id === selectedGame?.away_team_id);

  const availablePlayersForModal = addPlayerTeamId 
    ? players.filter(p => 
        p.team_id === addPlayerTeamId && 
        !playerStats.some(ps => ps.player_id === p.id)
      )
    : [];

  const homeStats = playerStats.filter(ps => ps.team_id === selectedGame?.home_team_id);
  const awayStats = playerStats.filter(ps => ps.team_id === selectedGame?.away_team_id);

  return (
    <>
      {step === 1 && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select League *</Label>
              <Select value={selectedLeague} onValueChange={setSelectedLeague}>
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

            {selectedLeague && (
              <div className="space-y-2">
                <Label>Select Completed Game *</Label>
                <Select onValueChange={selectGame}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select game to edit" />
                  </SelectTrigger>
                  <SelectContent>
                    {completedGames.map(game => {
                      const home = teams.find(t => t.id === game.home_team_id);
                      const away = teams.find(t => t.id === game.away_team_id);
                      return (
                        <SelectItem key={game.id} value={game.id}>
                          {home?.name} vs {away?.name} - {new Date(game.game_date).toLocaleDateString()} ({game.home_score}-{game.away_score})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-slate-100 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-slate-600">Editing Game</p>
                <p className="font-semibold text-lg">
                  {homeTeam?.name} vs {awayTeam?.name}
                </p>
                <p className="text-sm text-slate-600">{new Date(selectedGame.game_date).toLocaleString()}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                Change Game
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
                  onClick={() => addPlayer(selectedGame.home_team_id)}
                  className="h-8"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Player
                </Button>
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
                      <th className="px-3 py-2 text-center font-semibold">Actions</th>
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
                        <td className="px-3 py-2 text-center">
                          <Button size="sm" variant="ghost" onClick={() => removePlayer(ps.player_id)} className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
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
                  onClick={() => addPlayer(selectedGame.away_team_id)}
                  className="h-8"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Player
                </Button>
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
                      <th className="px-3 py-2 text-center font-semibold">Actions</th>
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
                        <td className="px-3 py-2 text-center">
                          <Button size="sm" variant="ghost" onClick={() => removePlayer(ps.player_id)} className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
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
              onClick={proceedToPlayerSelection}
              className="bg-gradient-to-r from-blue-500 to-blue-600"
            >
              Next: Select Player of the Game
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border-2 border-blue-300">
            <div className="text-center mb-4">
              <h3 className="text-2xl font-bold text-blue-900 mb-2">Review Changes</h3>
              <div className="text-4xl font-bold text-blue-700">
                {homeStats.reduce((sum, ps) => sum + ps.stats.total_points, 0)} - {awayStats.reduce((sum, ps) => sum + ps.stats.total_points, 0)}
              </div>
              <p className="text-slate-600 mt-2">
                {homeTeam?.name} vs {awayTeam?.name}
              </p>
            </div>
          </div>

          <div className="bg-slate-100 p-6 rounded-lg">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: teams.find(t => t.id === winningTeamId)?.color }}>
                {teams.find(t => t.id === winningTeamId)?.name?.[0]}
              </div>
              Select Player of the Game from {teams.find(t => t.id === winningTeamId)?.name}
            </h3>
            <Select 
              value={selectedGame.player_of_game || ""} 
              onValueChange={(value) => setSelectedGame({ ...selectedGame, player_of_game: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select player of the game" />
              </SelectTrigger>
              <SelectContent>
                {playerStats.filter(ps => ps.team_id === winningTeamId).map(ps => (
                  <SelectItem key={ps.player_id} value={ps.player_id}>
                    #{ps.jersey_number} {ps.player_name} - {ps.stats.total_points} PTS
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back to Stats
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={updateGameMutation.isPending}
              className="bg-gradient-to-r from-blue-500 to-blue-600 flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateGameMutation.isPending ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={addPlayerModal} onOpenChange={setAddPlayerModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Player</DialogTitle>
            <DialogDescription>Select a player to add to the game</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {availablePlayersForModal.length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-4">No available players</p>
            ) : (
              availablePlayersForModal.map(player => (
                <button
                  key={player.id}
                  onClick={() => selectPlayer(player)}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-all"
                >
                  <div className="font-semibold">#{player.jersey_number} {player.name}</div>
                  {player.position && <div className="text-xs text-slate-600">{player.position}</div>}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { validatePointsRow } from "./ManualGameEntry";
// EDIT_FORMAT_AWARE_V1: detect this game's points_2 storage convention at read time.
import { resolveGameFormat } from "../stats/statEngine";

export default function EditGameEntry({ leagues, teams, players, onClose }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedLeague, setSelectedLeague] = useState("");
  const [selectedGame, setSelectedGame] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
  const [winningTeamId, setWinningTeamId] = useState("");
  const [addPlayerModal, setAddPlayerModal] = useState(false);
  const [addPlayerTeamId, setAddPlayerTeamId] = useState(null);
  const [surplusRowIds, setSurplusRowIds] = useState([]);
  const [saveError, setSaveError] = useState("");
  // EDIT_FORMAT_AWARE_V1: 'raw' (manual: points_2 = 2-pt POINTS) or 'count' (digital: points_2 = number of made twos).
  // Pinned ONCE at load from the original stored stats+score, then reused on save so a digital game never flips to raw.
  const [gameFormat, setGameFormat] = useState("raw");

  const { data: completedGames = [] } = useQuery({
    queryKey: ['completedGames', selectedLeague],
    queryFn: () => selectedLeague ? base44.entities.Game.filter({ league_id: selectedLeague, status: 'completed' }, '-game_date') : Promise.resolve([]),
    enabled: !!selectedLeague,
  });

  // EDIT_DIGITAL_UNLOCK_V1: completed manual OR live/digital games can be edited.
  // Forfeit / default-result games stay locked (they carry award-exclusion flags set by the Default Winner flow).
  const editableGames = completedGames.filter(
    g => (g.entry_type === 'manual' || g.entry_type === 'digital') && !g.is_default_result
  );

  const { data: existingStats = [] } = useQuery({
    queryKey: ['editGameStats', selectedGame?.id],
    queryFn: () => selectedGame ? base44.entities.PlayerStats.filter({ game_id: selectedGame.id }) : Promise.resolve([]),
    enabled: !!selectedGame,
  });

  useEffect(() => {
    if (existingStats.length > 0 && selectedGame) {
      // EDIT_FORMAT_AWARE_V1: detect storage convention ONCE from the original stored rows + final score,
      // BEFORE any edit (selectedGame is untouched here). Pin it so save writes back in the same format.
      // Pass the raw, un-merged rows (duplicates included) — that is what resolveGameFormat expects.
      const fmt = resolveGameFormat(selectedGame, existingStats);
      setGameFormat(fmt);
      // Legacy duplicate rows (old substitution bugs) are merged here per player;
      // the surplus rows are remembered and deleted on save.
      const byPlayer = new Map();
      const surplus = [];
      for (const stat of existingStats) {
        if (!byPlayer.has(stat.player_id)) {
          byPlayer.set(stat.player_id, { ...stat });
        } else {
          const merged = byPlayer.get(stat.player_id);
          merged.points_2 = (merged.points_2 || 0) + (stat.points_2 || 0);
          merged.points_3 = (merged.points_3 || 0) + (stat.points_3 || 0);
          merged.free_throws = (merged.free_throws || 0) + (stat.free_throws || 0);
          merged.assists = (merged.assists || 0) + (stat.assists || 0);
          merged.steals = (merged.steals || 0) + (stat.steals || 0);
          merged.blocks = (merged.blocks || 0) + (stat.blocks || 0);
          merged.offensive_rebounds = (merged.offensive_rebounds || 0) + (stat.offensive_rebounds || 0);
          merged.defensive_rebounds = (merged.defensive_rebounds || 0) + (stat.defensive_rebounds || 0);
          merged.turnovers = (merged.turnovers || 0) + (stat.turnovers || 0);
          merged.fouls = (merged.fouls || 0) + (stat.fouls || 0);
          merged.technical_fouls = (merged.technical_fouls || 0) + (stat.technical_fouls || 0);
          merged.unsportsmanlike_fouls = (merged.unsportsmanlike_fouls || 0) + (stat.unsportsmanlike_fouls || 0);
          surplus.push(stat.id);
        }
      }
      setSurplusRowIds(surplus);
      const stats = Array.from(byPlayer.values()).map(stat => {
        const player = players.find(p => p.id === stat.player_id);
        // EDIT_FORMAT_AWARE_V1: count format stores made-twos as a count (×2); raw stores 2-pt points (×1).
        const twoPoints = fmt === 'count' ? ((stat.points_2 || 0) * 2) : (stat.points_2 || 0);
        const totalPoints = twoPoints + ((stat.points_3 || 0) * 3) + (stat.free_throws || 0);
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
          // EDIT_FORMAT_AWARE_V1: validatePointsRow guarantees (total - 3*3PM - FT) is even and >= 0.
          // Write points_2 in the SAME format this game already uses:
          //   count (digital) → store the number of made twos (rawTwoPoints / 2, exact because it's even)
          //   raw   (manual)  → store the 2-point POINTS unchanged
          // A digital game must NEVER be flipped to raw.
          const rawTwoPoints = Math.max(0, totalPoints - points3Value - ftValue);
          const points2Value = data.gameFormat === 'count' ? Math.round(rawTwoPoints / 2) : rawTwoPoints;
          
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

      // EDIT_REMOVE_ALL_ROWS_V1: delete EVERY stat row of removed players (not just the
      // first match), plus the surplus duplicate rows merged at load time.
      const currentPlayerIds = data.playerStats.map(ps => ps.player_id);
      const removedRowIds = existingStats
        .filter(s => !currentPlayerIds.includes(s.player_id))
        .map(s => s.id);
      const rowsToDelete = [...new Set([...removedRowIds, ...surplusRowIds])];

      await Promise.all(
        rowsToDelete.map(rowId => base44.entities.PlayerStats.delete(rowId))
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
      onClose();
    },
    onError: () => {
      // EDIT_ENTRY_VALIDATE_V1: alert() is blocked in base44 — show an on-page banner instead
      setSaveError("Saving failed. Please check your connection and tap Save Changes again.");
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
    const game = editableGames.find(g => g.id === gameId);
    setSelectedGame(game);
    setSurplusRowIds([]);
    setSaveError("");
    setStep(2);
  };

  // EDIT_ENTRY_VALIDATE_V1: rows whose points math is impossible block saving
  const invalidRows = playerStats.filter(ps => !validatePointsRow(ps.stats).ok);

  const proceedToPlayerSelection = () => {
    if (invalidRows.length > 0) return;

    const homeStats = playerStats.filter(ps => ps.team_id === selectedGame.home_team_id);
    const awayStats = playerStats.filter(ps => ps.team_id === selectedGame.away_team_id);

    const homeScore = homeStats.reduce((sum, ps) => sum + ps.stats.total_points, 0);
    const awayScore = awayStats.reduce((sum, ps) => sum + ps.stats.total_points, 0);

    const winningTeam = homeScore > awayScore ? selectedGame.home_team_id : selectedGame.away_team_id;
    
    setWinningTeamId(winningTeam);
    setStep(3);
  };

  const handleSubmit = () => {
    if (invalidRows.length > 0) return;

    const homeStats = playerStats.filter(ps => ps.team_id === selectedGame.home_team_id);
    const awayStats = playerStats.filter(ps => ps.team_id === selectedGame.away_team_id);

    const homeScore = homeStats.reduce((sum, ps) => sum + ps.stats.total_points, 0);
    const awayScore = awayStats.reduce((sum, ps) => sum + ps.stats.total_points, 0);

    setSaveError("");
    updateGameMutation.mutate({
      game: selectedGame,
      playerStats,
      gameFormat,
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

  // EDIT_ENTRY_VALIDATE_V1 / FOCUS_SELECT_V1: shared renderer; inputs select-all on focus so typing replaces the 0
  const renderStatRows = (statsList) => statsList.map((ps, idx) => {
    const check = validatePointsRow(ps.stats);
    const rowBg = !check.ok ? 'bg-red-50' : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50');
    return (
      <React.Fragment key={ps.player_id}>
        <tr className={rowBg}>
          <td className="px-3 py-2 font-semibold">{ps.jersey_number}</td>
          <td className="px-3 py-2">{ps.player_name}</td>
          <td className="px-3 py-2"><Input type="number" min="0" onFocus={(e) => e.target.select()} value={ps.stats.total_points} onChange={(e) => updatePlayerStat(ps.player_id, 'total_points', e.target.value)} className={`h-8 w-16 text-center ${!check.ok ? 'border-red-400 ring-1 ring-red-400' : ''}`} /></td>
          <td className="px-3 py-2"><Input type="number" min="0" onFocus={(e) => e.target.select()} value={ps.stats.points_3} onChange={(e) => updatePlayerStat(ps.player_id, 'points_3', e.target.value)} className={`h-8 w-16 text-center ${!check.ok ? 'border-red-400 ring-1 ring-red-400' : ''}`} /></td>
          <td className="px-3 py-2"><Input type="number" min="0" onFocus={(e) => e.target.select()} value={ps.stats.free_throws} onChange={(e) => updatePlayerStat(ps.player_id, 'free_throws', e.target.value)} className={`h-8 w-16 text-center ${!check.ok ? 'border-red-400 ring-1 ring-red-400' : ''}`} /></td>
          <td className="px-3 py-2 text-center">
            {check.ok ? (
              <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-semibold">{check.twosMade}</span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold"><AlertCircle className="w-3 h-3" />—</span>
            )}
          </td>
          <td className="px-3 py-2"><Input type="number" min="0" onFocus={(e) => e.target.select()} value={ps.stats.assists} onChange={(e) => updatePlayerStat(ps.player_id, 'assists', e.target.value)} className="h-8 w-16 text-center" /></td>
          <td className="px-3 py-2"><Input type="number" min="0" onFocus={(e) => e.target.select()} value={ps.stats.steals} onChange={(e) => updatePlayerStat(ps.player_id, 'steals', e.target.value)} className="h-8 w-16 text-center" /></td>
          <td className="px-3 py-2"><Input type="number" min="0" onFocus={(e) => e.target.select()} value={ps.stats.blocks} onChange={(e) => updatePlayerStat(ps.player_id, 'blocks', e.target.value)} className="h-8 w-16 text-center" /></td>
          <td className="px-3 py-2"><Input type="number" min="0" onFocus={(e) => e.target.select()} value={ps.stats.offensive_rebounds} onChange={(e) => updatePlayerStat(ps.player_id, 'offensive_rebounds', e.target.value)} className="h-8 w-16 text-center" /></td>
          <td className="px-3 py-2"><Input type="number" min="0" onFocus={(e) => e.target.select()} value={ps.stats.defensive_rebounds} onChange={(e) => updatePlayerStat(ps.player_id, 'defensive_rebounds', e.target.value)} className="h-8 w-16 text-center" /></td>
          <td className="px-3 py-2"><Input type="number" min="0" onFocus={(e) => e.target.select()} value={ps.stats.turnovers} onChange={(e) => updatePlayerStat(ps.player_id, 'turnovers', e.target.value)} className="h-8 w-16 text-center" /></td>
          <td className="px-3 py-2"><Input type="number" min="0" onFocus={(e) => e.target.select()} value={ps.stats.fouls} onChange={(e) => updatePlayerStat(ps.player_id, 'fouls', e.target.value)} className="h-8 w-16 text-center" /></td>
          <td className="px-3 py-2"><Input type="number" min="0" onFocus={(e) => e.target.select()} value={ps.stats.technical_fouls} onChange={(e) => updatePlayerStat(ps.player_id, 'technical_fouls', e.target.value)} className="h-8 w-16 text-center" /></td>
          <td className="px-3 py-2"><Input type="number" min="0" onFocus={(e) => e.target.select()} value={ps.stats.unsportsmanlike_fouls} onChange={(e) => updatePlayerStat(ps.player_id, 'unsportsmanlike_fouls', e.target.value)} className="h-8 w-16 text-center" /></td>
          <td className="px-3 py-2 text-center">
            <Button size="sm" variant="ghost" onClick={() => removePlayer(ps.player_id)} className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600">
              <Trash2 className="w-3 h-3" />
            </Button>
          </td>
        </tr>
        {!check.ok && (
          <tr className="bg-red-50">
            <td colSpan={16} className="px-3 pb-2 pt-0 text-xs text-red-700">{check.message}</td>
          </tr>
        )}
      </React.Fragment>
    );
  });

  const tableHeader = (
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <th className="px-3 py-2 text-left font-semibold">#</th>
        <th className="px-3 py-2 text-left font-semibold">Player</th>
        <th className="px-3 py-2 text-center font-semibold">PTS</th>
        <th className="px-3 py-2 text-center font-semibold">3PM</th>
        <th className="px-3 py-2 text-center font-semibold">FT</th>
        <th className="px-3 py-2 text-center font-semibold">2PM</th>
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
  );

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
                <Label>Select Game to Edit *</Label>
                <Select onValueChange={selectGame}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select game to edit" />
                  </SelectTrigger>
                  <SelectContent>
                    {editableGames.map(game => {
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
                <p className="text-xs text-slate-500">Completed manual and live-scored games can be edited. Forfeit and default-result games are locked.</p>
                {editableGames.length === 0 && (
                  <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">No editable games in this league yet.</p>
                )}
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
                {/* EDIT_FORMAT_AWARE_V1: show which kind of game this is so the admin knows it loaded correctly. */}
                {selectedGame.entry_type === 'digital' ? (
                  <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700">Live / digital game</span>
                ) : (
                  <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-600">Manual entry</span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                Change Game
              </Button>
            </div>
          </div>

          <p className="text-sm text-slate-500">Enter each player's total points, made threes and free throws — twos are worked out automatically in the 2PM column.</p>

          {/* EDIT_LIVE_SCORE_V1: running scoreboard pinned to the top of the edit step so the admin can
              validate against the stored final score while typing, without scrolling to the review step.
              Derives from the same totals as save — never blocks input. */}
          {(() => {
            const editHome = homeStats.reduce((sum, ps) => sum + (ps.stats.total_points || 0), 0);
            const editAway = awayStats.reduce((sum, ps) => sum + (ps.stats.total_points || 0), 0);
            const storedHome = selectedGame.home_score || 0;
            const storedAway = selectedGame.away_score || 0;
            const scoreMatches = editHome === storedHome && editAway === storedAway;
            return (
              <div className="sticky top-0 z-20 rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
                <div className="flex items-stretch">
                  <div className="flex-1 text-center py-3 px-2">
                    <p className="text-xs text-slate-500 truncate">{homeTeam?.name}</p>
                    <p className="text-3xl font-bold leading-none">{editHome}</p>
                  </div>
                  <div className="flex items-center px-2 text-slate-400 text-xl">–</div>
                  <div className="flex-1 text-center py-3 px-2">
                    <p className="text-xs text-slate-500 truncate">{awayTeam?.name}</p>
                    <p className="text-3xl font-bold leading-none">{editAway}</p>
                  </div>
                </div>
                {scoreMatches ? (
                  <div className="flex items-center justify-center gap-2 py-2 bg-green-50">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-xs font-medium text-green-700">Matches stored final {storedHome}–{storedAway}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-2 bg-amber-50">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="text-xs font-medium text-amber-700">Edited {editHome}–{editAway} · stored final was {storedHome}–{storedAway}</span>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: homeTeam?.color }}>
                    {homeTeam?.name?.[0]}
                  </div>
                  {homeTeam?.name}
                  {/* EDIT_LIVE_SCORE_V1: per-team running total so the admin can see which side is off. */}
                  <span className="ml-1 text-sm font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">{homeStats.reduce((sum, ps) => sum + (ps.stats.total_points || 0), 0)} pts</span>
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
                  {tableHeader}
                  <tbody>
                    {renderStatRows(homeStats)}
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
                  {/* EDIT_LIVE_SCORE_V1: per-team running total so the admin can see which side is off. */}
                  <span className="ml-1 text-sm font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">{awayStats.reduce((sum, ps) => sum + (ps.stats.total_points || 0), 0)} pts</span>
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
                  {tableHeader}
                  <tbody>
                    {renderStatRows(awayStats)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {invalidRows.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{invalidRows.length} row{invalidRows.length === 1 ? '' : 's'} need{invalidRows.length === 1 ? 's' : ''} fixing before you can continue — look for the red rows above.</span>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={proceedToPlayerSelection}
              disabled={invalidRows.length > 0}
              className="bg-gradient-to-r from-blue-500 to-blue-600"
            >
              Next: review &amp; save
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

          {/* EDIT_SCORE_CHECK_V1: warn-and-allow. Compare the stored final score against the edited totals.
              Never blocks saving — just makes a score change a deliberate, visible decision. */}
          {(() => {
            const editedHome = homeStats.reduce((sum, ps) => sum + ps.stats.total_points, 0);
            const editedAway = awayStats.reduce((sum, ps) => sum + ps.stats.total_points, 0);
            const storedHome = selectedGame.home_score || 0;
            const storedAway = selectedGame.away_score || 0;
            const scoreMatches = editedHome === storedHome && editedAway === storedAway;
            return scoreMatches ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-3">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Score check passes — stored final {storedHome}–{storedAway} matches your edited totals.</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>This changes the final score. Stored was <strong>{storedHome}–{storedAway}</strong>; saving will set it to <strong>{editedHome}–{editedAway}</strong>. Make sure that's correct before you save.</span>
              </div>
            );
          })()}

          <div className="bg-slate-100 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: teams.find(t => t.id === winningTeamId)?.color }}>
                  {teams.find(t => t.id === winningTeamId)?.name?.[0]}
                </div>
                Player of the game
              </h3>
              <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded">already set · change only if needed</span>
            </div>
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

          {saveError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

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
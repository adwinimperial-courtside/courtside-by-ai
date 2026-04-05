import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { FileText, User, Clock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GameLogPage() {
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  if (currentUser && currentUser.user_type !== "app_admin" && currentUser.user_type !== "league_admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">You don't have permission to view this page.</p>
      </div>
    );
  }

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
  });

  const { data: games = [] } = useQuery({
    queryKey: ["games", selectedLeagueId],
    queryFn: () => base44.entities.Game.filter({ league_id: selectedLeagueId }, "-game_date"),
    enabled: !!selectedLeagueId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const [filterPoints, setFilterPoints] = useState(false);

  const { data: gameLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["gameLogs", selectedGameId],
    queryFn: () => base44.entities.GameLog.filter({ game_id: selectedGameId }, "created_date"),
    enabled: !!selectedGameId,
  });

  const POINTS_STAT_TYPES = ["points_2", "points_3", "free_throws"];

  const selectedGame = games.find(g => g.id === selectedGameId);
  const homeTeam = teams.find(t => t.id === selectedGame?.home_team_id);
  const awayTeam = teams.find(t => t.id === selectedGame?.away_team_id);

  const statTypeColors = {
    points_2: "bg-green-100 text-green-800",
    points_3: "bg-blue-100 text-blue-800",
    free_throws: "bg-yellow-100 text-yellow-800",
    free_throws_missed: "bg-red-100 text-red-800",
    offensive_rebounds: "bg-purple-100 text-purple-800",
    defensive_rebounds: "bg-indigo-100 text-indigo-800",
    assists: "bg-cyan-100 text-cyan-800",
    steals: "bg-teal-100 text-teal-800",
    blocks: "bg-orange-100 text-orange-800",
    turnovers: "bg-red-100 text-red-800",
    fouls: "bg-amber-100 text-amber-800",
    technical_fouls: "bg-red-200 text-red-900",
    unsportsmanlike_fouls: "bg-red-200 text-red-900",
  };

  const getActionLabel = (log) => {
    const added = log.new_value > log.old_value;
    return added ? "Added" : "Removed";
  };

  const getActionColor = (log) => {
    const added = log.new_value > log.old_value;
    return added ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800";
  };

  const buildRows = (logs) => logs.map((log) => {
    const player = players.find(p => p.id === log.player_id);
    const team = teams.find(t => t.id === log.team_id);
    const added = log.new_value > log.old_value;
    return {
      Time: log.created_date ? format(new Date(log.created_date), "HH:mm:ss") : "",
      Player: player?.name || "Unknown",
      Jersey: player?.jersey_number ?? "",
      Team: team?.name || "",
      Action: added ? "Added" : "Removed",
      Stat: log.stat_label || log.stat_type,
      "Old Value": log.old_value ?? "",
      "New Value": log.new_value ?? "",
      "Home Score": log.old_home_score ?? "",
      "Away Score": log.old_away_score ?? "",
      "Logged By": log.logged_by || "",
      "Device": log.device_name || "",
    };
  });

  const downloadCSV = () => {
    const rows = buildRows(gameLogs);
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `game-log-${selectedGameId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExcel = () => {
    const rows = buildRows(gameLogs);
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const tableRows = [
      `<tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>`,
      ...rows.map(r => `<tr>${headers.map(h => `<td>${r[h]}</td>`).join("")}</tr>`)
    ].join("");
    const html = `<html><head><meta charset="UTF-8"></head><body><table>${tableRows}</table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `game-log-${selectedGameId}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getScoreAtTime = (log) => {
    let homeScore = log.old_home_score ?? 0;
    let awayScore = log.old_away_score ?? 0;
    const pointsChange = (log.stat_points ?? 0) * (log.new_value > log.old_value ? 1 : -1);
    if (log.team_id === selectedGame?.home_team_id) {
      homeScore += pointsChange;
    } else {
      awayScore += pointsChange;
    }
    return `${homeTeam?.name || "Home"} ${homeScore} – ${awayScore} ${awayTeam?.name || "Away"}`;
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-orange-500" />
          Game Log
        </h1>
        <p className="text-slate-500 text-sm mt-1">Track every action recorded during a game</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Select
          value={selectedLeagueId}
          onValueChange={(val) => { setSelectedLeagueId(val); setSelectedGameId(""); }}
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Select League" />
          </SelectTrigger>
          <SelectContent>
            {leagues.map(l => (
              <SelectItem key={l.id} value={l.id}>{l.name} – {l.season}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedGameId}
          onValueChange={setSelectedGameId}
          disabled={!selectedLeagueId}
        >
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue placeholder="Select Game" />
          </SelectTrigger>
          <SelectContent>
            {games.map(g => {
              const home = teams.find(t => t.id === g.home_team_id);
              const away = teams.find(t => t.id === g.away_team_id);
              return (
                <SelectItem key={g.id} value={g.id}>
                  {home?.name} vs {away?.name} – {format(new Date(g.game_date), "MMM d, yyyy")}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Game Header */}
      {selectedGame && (
        <Card className="mb-6 border-slate-200">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-lg font-bold text-slate-900">
                <span>{homeTeam?.name}</span>
                <span className="text-slate-400">vs</span>
                <span>{awayTeam?.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-slate-100 text-slate-700">
                  {format(new Date(selectedGame.game_date), "MMM d, yyyy • h:mm a")}
                </Badge>
                <Badge className={
                  selectedGame.status === "completed" ? "bg-green-100 text-green-800" :
                  selectedGame.status === "in_progress" ? "bg-orange-100 text-orange-800" :
                  "bg-blue-100 text-blue-800"
                }>
                  {selectedGame.status.replace("_", " ")}
                </Badge>
                <Badge className="bg-slate-100 text-slate-600">
                  {gameLogs.length} actions
                </Badge>
                {gameLogs.length > 0 && (
                  <>
                    <Button size="sm" variant="outline" onClick={downloadCSV} className="h-7 text-xs gap-1">
                      <Download className="w-3 h-3" /> CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={downloadExcel} className="h-7 text-xs gap-1">
                      <Download className="w-3 h-3" /> Excel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      {selectedGameId && !logsLoading && gameLogs.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setFilterPoints(false)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!filterPoints ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            All Actions
          </button>
          <button
            onClick={() => setFilterPoints(true)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterPoints ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Points Only (2PT / 3PT / FT)
          </button>
        </div>
      )}

      {/* Log Entries */}
      {!selectedLeagueId && (
        <div className="text-center py-16 text-slate-400">Select a league to get started</div>
      )}
      {selectedLeagueId && !selectedGameId && (
        <div className="text-center py-16 text-slate-400">Select a game to view its log</div>
      )}
      {selectedGameId && logsLoading && (
        <div className="text-center py-16 text-slate-400">Loading game log...</div>
      )}
      {selectedGameId && !logsLoading && gameLogs.length === 0 && (
        <div className="text-center py-16 text-slate-400">No log entries found for this game</div>
      )}

      {gameLogs.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-700">Game Activity Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {gameLogs.filter(log => !filterPoints || POINTS_STAT_TYPES.includes(log.stat_type)).map((log, index) => {
                const player = players.find(p => p.id === log.player_id);
                const team = teams.find(t => t.id === log.team_id);
                return (
                  <div key={log.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-slate-400 font-mono w-6 text-right flex-shrink-0">
                          {index + 1}
                        </span>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: team?.color || "#f97316" }}
                        >
                          {player?.jersey_number ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-slate-900 text-sm truncate">
                              {player?.name || "Unknown Player"}
                            </span>
                            <span className="text-xs text-slate-400">({team?.name})</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <Badge className={`text-xs px-1.5 py-0 ${getActionColor(log)}`}>
                              {getActionLabel(log)}
                            </Badge>
                            <Badge className={`text-xs px-1.5 py-0 ${statTypeColors[log.stat_type] || "bg-slate-100 text-slate-700"}`}>
                              {log.stat_label || log.stat_type}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              {log.old_value} → {log.new_value}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
                        <span className="text-xs font-mono text-slate-600 bg-slate-100 rounded px-2 py-0.5">
                          {getScoreAtTime(log)}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <User className="w-3 h-3" />
                          <span>{log.logged_by || "Unknown"}</span>
                        </div>
                        {log.created_date && (
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>{format(new Date(log.created_date), "HH:mm:ss")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
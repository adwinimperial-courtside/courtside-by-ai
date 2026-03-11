import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, AlertCircle, XCircle, Search, RefreshCw } from "lucide-react";

const CONFIDENCE_COLORS = {
  high: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-orange-100 text-orange-800",
};

const STATUS_ICONS = {
  matched: <CheckCircle className="w-4 h-4 text-green-600" />,
  needs_review: <AlertCircle className="w-4 h-4 text-yellow-600" />,
  unmatched: <XCircle className="w-4 h-4 text-red-500" />,
};

function isConfirmed(match, editingLeagueIds) {
  return (
    (match.match_method === "manual_admin" || match.match_method === "manual_user") &&
    !editingLeagueIds.has(match.league_id)
  );
}

export default function PlayerLeagueMatchModal({ player, onClose }) {
  const [isRunning, setIsRunning] = useState(true);
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState(null);
  const [savingLeagueId, setSavingLeagueId] = useState(null);
  const [pickingLeagueId, setPickingLeagueId] = useState(null);
  const [editingLeagueIds, setEditingLeagueIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { runMatching(); }, []);

  const runMatching = async () => {
    setIsRunning(true);
    setError(null);
    setEditingLeagueIds(new Set());
    setPickingLeagueId(null);
    try {
      const res = await base44.functions.invoke("matchPlayerLeagues", {
        user_id: player.id,
        display_name: player.display_name || null,
        full_name: player.full_name || null,
        handle: player.handle || null,
        assigned_league_ids: player.assigned_league_ids || [],
      });
      setMatches(res.data.matches || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const updateMatchLocal = (leagueId, updates) => {
    setMatches(prev => prev.map(m => m.league_id === leagueId ? { ...m, ...updates } : m));
  };

  const acceptMatch = async (match) => {
    setSavingLeagueId(match.league_id);
    await base44.entities.UserLeagueIdentity.update(match.identity_record_id, {
      match_method: "manual_admin",
      matched_at: new Date().toISOString(),
      matched_by: "admin",
    });
    updateMatchLocal(match.league_id, { match_method: "manual_admin" });
    setEditingLeagueIds(prev => { const s = new Set(prev); s.delete(match.league_id); return s; });
    setSavingLeagueId(null);
  };

  const selectPlayer = async (match, rosterPlayer) => {
    setSavingLeagueId(match.league_id);
    await base44.entities.UserLeagueIdentity.update(match.identity_record_id, {
      team_id: rosterPlayer.team_id,
      matched_player_name: rosterPlayer.name,
      matched_player_id: rosterPlayer.id,
      match_status: "matched",
      match_confidence: "high",
      match_method: "manual_admin",
      matched_at: new Date().toISOString(),
      matched_by: "admin",
    });
    updateMatchLocal(match.league_id, {
      matched_player_name: rosterPlayer.name,
      matched_player_id: rosterPlayer.id,
      team_id: rosterPlayer.team_id,
      team_name: rosterPlayer.team_name,
      match_status: "matched",
      match_confidence: "high",
      match_method: "manual_admin",
    });
    setEditingLeagueIds(prev => { const s = new Set(prev); s.delete(match.league_id); return s; });
    setPickingLeagueId(null);
    setSearchQuery("");
    setSavingLeagueId(null);
  };

  const markUnmatched = async (match) => {
    setSavingLeagueId(match.league_id);
    await base44.entities.UserLeagueIdentity.update(match.identity_record_id, {
      matched_player_name: null,
      matched_player_id: null,
      team_id: null,
      match_status: "unmatched",
      match_confidence: null,
      match_method: "manual_admin",
      matched_at: new Date().toISOString(),
      matched_by: "admin",
    });
    updateMatchLocal(match.league_id, {
      match_status: "unmatched",
      match_method: "manual_admin",
      matched_player_name: null,
      matched_player_id: null,
      team_id: null,
      team_name: null,
    });
    setEditingLeagueIds(prev => { const s = new Set(prev); s.delete(match.league_id); return s; });
    setSavingLeagueId(null);
  };

  const enableEdit = (leagueId) => {
    setEditingLeagueIds(prev => new Set([...prev, leagueId]));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Match Leagues — {player.full_name}
          </DialogTitle>
          <div className="flex gap-4 text-sm text-slate-500 flex-wrap">
            {player.display_name && <span>Display name: <strong className="text-slate-700">{player.display_name}</strong></span>}
            {player.handle && <span>Handle: <strong className="text-slate-700">@{player.handle}</strong></span>}
          </div>
        </DialogHeader>

        {isRunning ? (
          <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
            Running matching logic…
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-600 text-sm">{error}</div>
        ) : matches.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">No leagues assigned to this player.</div>
        ) : (
          <div className="space-y-3 mt-2">
            {matches.map(match => {
              const isSaving = savingLeagueId === match.league_id;
              const isPicking = pickingLeagueId === match.league_id;
              const confirmed = isConfirmed(match, editingLeagueIds);

              const filteredRoster = (match.roster_players || []).filter(p =>
                !searchQuery ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.team_name.toLowerCase().includes(searchQuery.toLowerCase())
              );

              return (
                <div
                  key={match.league_id}
                  className={`border rounded-lg p-4 transition-colors ${confirmed ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {STATUS_ICONS[match.match_status] || <XCircle className="w-4 h-4 text-slate-400" />}
                      <span className="font-semibold text-slate-800 text-sm">{match.league_name}</span>
                      {confirmed && (
                        <Badge className="bg-green-100 text-green-800 text-xs">Confirmed</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {match.match_confidence && (
                        <Badge className={`text-xs ${CONFIDENCE_COLORS[match.match_confidence]}`}>
                          {match.match_confidence} confidence
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs text-slate-500">
                        {(match.match_method || "none").replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>

                  {/* Match summary */}
                  <div className="text-sm text-slate-600 mb-3">
                    {match.matched_player_name ? (
                      <div className="flex items-center gap-2">
                        <span>
                          Matched to: <strong className="text-slate-900">{match.matched_player_name}</strong>
                          {match.team_name && (
                            <span className="text-slate-400"> · {match.team_name}</span>
                          )}
                        </span>
                        <Badge className="bg-green-100 text-green-800 text-xs ml-auto">Matched</Badge>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 italic">
                          {match.match_status === "unmatched" ? "No match found" : "Needs review — no single candidate"}
                        </span>
                        <Badge className={`text-xs ml-auto ${match.match_status === "unmatched" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                          {match.match_status === "unmatched" ? "Not Matched" : "Needs Review"}
                        </Badge>
                      </div>
                    )}
                    {match.note && (
                      <span className="ml-2 text-orange-600 text-xs">({match.note})</span>
                    )}
                  </div>

                  {/* Player picker */}
                  {isPicking && (
                    <div className="mb-3 border border-slate-200 rounded-md p-3 bg-slate-50">
                      <div className="flex items-center gap-2 mb-2">
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                        <Input
                          placeholder="Search roster players…"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-44 overflow-y-auto space-y-0.5">
                        {filteredRoster.length === 0 ? (
                          <p className="text-sm text-slate-400 py-2 text-center">No players found</p>
                        ) : filteredRoster.map(p => (
                          <button
                            key={p.id}
                            onClick={() => { setSearchQuery(""); selectPlayer(match, p); }}
                            className="w-full text-left text-sm px-3 py-1.5 rounded hover:bg-white flex items-center justify-between transition-colors"
                          >
                            <span className="font-medium text-slate-800">{p.name}</span>
                            <span className="text-slate-400 text-xs">
                              {p.team_name}{p.jersey_number ? ` #${p.jersey_number}` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {confirmed ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-slate-500 hover:text-slate-800 px-2"
                      onClick={() => enableEdit(match.league_id)}
                      disabled={isSaving}
                    >
                      Edit
                    </Button>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {match.matched_player_name && !isPicking && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                          onClick={() => acceptMatch(match)}
                          disabled={isSaving}
                        >
                          Accept Match
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className={!match.matched_player_name && !isPicking ? "bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs" : "variant-outline h-7 text-xs"}
                        variant={!match.matched_player_name && !isPicking ? "default" : "outline"}
                        onClick={() => {
                          setPickingLeagueId(isPicking ? null : match.league_id);
                          setSearchQuery("");
                        }}
                        disabled={isSaving}
                      >
                        {isPicking ? "Cancel" : "Choose Different Player"}
                      </Button>
                      {!isPicking && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-slate-500 hover:text-red-600 hover:border-red-300"
                          onClick={() => markUnmatched(match)}
                          disabled={isSaving}
                        >
                          Mark Unmatched
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 text-xs"
            onClick={runMatching}
            disabled={isRunning}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isRunning ? "animate-spin" : ""}`} />
            Re-run Matching
          </Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
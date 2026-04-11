import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, User, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Simple fuzzy score: how well does `candidate` match `query`
function fuzzyScore(query, candidate) {
  if (!query || !candidate) return 0;
  const q = query.toLowerCase().trim();
  const c = candidate.toLowerCase().trim();
  if (c === q) return 100;
  if (c.includes(q) || q.includes(c)) return 80;
  // Character overlap score
  const qChars = q.split("");
  let matches = 0;
  let pos = 0;
  for (const ch of qChars) {
    const idx = c.indexOf(ch, pos);
    if (idx !== -1) { matches++; pos = idx + 1; }
  }
  return Math.round((matches / Math.max(q.length, c.length)) * 60);
}

function getBestScore(player, displayName, handle) {
  const scores = [
    fuzzyScore(displayName, player.name),
    handle ? fuzzyScore(handle, player.name) : 0,
  ];
  return Math.max(...scores);
}

export default function PlayerMatchModal({ application, leagues, teams, onClose, onApproved }) {
  const queryClient = useQueryClient();
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [search, setSearch] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Collect all team IDs from the application
  const teamIds = useMemo(() => {
    if (application.league_team_pairs?.length > 0) {
      return application.league_team_pairs.map(p => p.team_id).filter(Boolean);
    }
    return application.team_id ? [application.team_id] : [];
  }, [application]);

  const pairs = useMemo(() => {
    if (application.league_team_pairs?.length > 0) return application.league_team_pairs;
    if (application.league_id && application.team_id) {
      return [{ league_id: application.league_id, team_id: application.team_id }];
    }
    return [];
  }, [application]);

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['players_for_teams', teamIds.join(",")],
    queryFn: () => base44.entities.Player.list(),
    enabled: teamIds.length > 0,
  });

  const teamPlayers = useMemo(() => {
    return players.filter(p => teamIds.includes(p.team_id));
  }, [players, teamIds]);

  const rankedPlayers = useMemo(() => {
    const query = search.trim() || application.display_name || "";
    const handle = application.handle || "";
    return [...teamPlayers]
      .map(p => ({ ...p, score: getBestScore(p, query, search ? "" : handle) }))
      .sort((a, b) => b.score - a.score);
  }, [teamPlayers, search, application.display_name, application.handle]);

  const handleMatchAndApprove = async () => {
    if (!selectedPlayerId) return;
    setIsProcessing(true);
    try {
      // Approve the application
      await base44.functions.invoke('approveUserApplication', {
        applicationId: application.id,
        action: 'approve',
      });

      // Create UserLeagueIdentity records for each pair
      const selectedPlayer = players.find(p => p.id === selectedPlayerId);
      for (const pair of pairs) {
        const existing = await base44.entities.UserLeagueIdentity.filter({
          user_id: application.user_id,
          league_id: pair.league_id,
        });
        const identityData = {
          user_id: application.user_id,
          league_id: pair.league_id,
          team_id: pair.team_id,
          matched_player_id: selectedPlayerId,
          matched_player_name: selectedPlayer?.name || application.display_name,
          match_status: "matched",
          match_method: "manual_admin",
          matched_at: new Date().toISOString(),
          matched_by: "admin",
        };
        if (existing?.length > 0) {
          await base44.entities.UserLeagueIdentity.update(existing[0].id, identityData);
        } else {
          await base44.entities.UserLeagueIdentity.create(identityData);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['user_applications_pending'] });
      onApproved();
    } catch (error) {
      alert("Failed: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-orange-500" />
            Match Player Identity
          </DialogTitle>
        </DialogHeader>

        {/* Applicant info */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-sm space-y-1 mb-2">
          <div><span className="text-slate-500">Applicant:</span> <span className="font-medium">{application.user_name}</span></div>
          {application.display_name && <div><span className="text-slate-500">Display Name:</span> <span className="font-medium">{application.display_name}</span></div>}
          {application.handle && <div><span className="text-slate-500">Nickname:</span> <span className="font-medium">{application.handle}</span></div>}
          <div className="pt-1 space-y-0.5">
            {pairs.map((pair, i) => {
              const league = leagues.find(l => l.id === pair.league_id);
              const team = teams.find(t => t.id === pair.team_id);
              return (
                <div key={i} className="text-xs text-slate-500">
                  {league?.name} · <span className="font-medium text-slate-700">{team?.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Player list */}
        <div className="max-h-64 overflow-y-auto space-y-1 mt-1">
          {isLoading ? (
            <p className="text-slate-400 text-sm text-center py-4">Loading players...</p>
          ) : rankedPlayers.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No players found on this team</p>
          ) : (
            rankedPlayers.map(player => {
              const team = teams.find(t => t.id === player.team_id);
              const isSelected = selectedPlayerId === player.id;
              return (
                <div
                  key={player.id}
                  onClick={() => setSelectedPlayerId(player.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer border transition-all ${
                    isSelected
                      ? "bg-orange-50 border-orange-300"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <p className="font-medium text-sm text-slate-900">{player.name}</p>
                    <p className="text-xs text-slate-500">#{player.jersey_number} · {team?.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {player.score >= 60 && (
                      <Badge className="bg-green-100 text-green-700 text-xs">Strong match</Badge>
                    )}
                    {player.score >= 30 && player.score < 60 && (
                      <Badge className="bg-yellow-100 text-yellow-700 text-xs">Possible</Badge>
                    )}
                    {isSelected && <Check className="w-4 h-4 text-orange-500" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleMatchAndApprove}
            disabled={!selectedPlayerId || isProcessing}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Check className="w-4 h-4 mr-1" />
            {isProcessing ? "Processing..." : "Match & Approve"}
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            disabled={isProcessing}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-1" />
            Ignore
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, User, AlertTriangle, Unlink } from "lucide-react";

// PLAYER_MATCH_MODAL_V2 — known-team roster only, server-side identity write, on-page errors
// RELEASE_CLAIM_V1 — app_admin can free a roster slot held by a stale UserLeagueIdentity, then retry

const CONFIDENCE_META = {
  strong: { cls: "bg-green-100 text-green-700", label: "Strong match" },
  number_match_name_differs: { cls: "bg-amber-100 text-amber-700", label: "⚠ Number matches, name differs" },
  name_match_number_differs: { cls: "bg-amber-100 text-amber-700", label: "Name matches, number differs" },
  ambiguous: { cls: "bg-amber-100 text-amber-700", label: "Multiple possible — pick one" },
  none: { cls: "bg-slate-100 text-slate-600", label: "No suggestion — pick manually" },
};

export default function PlayerMatchModal({ application, leagues, teams, onClose, onApproved }) {
  const queryClient = useQueryClient();
  const [selections, setSelections] = useState({}); // team_id -> player_id
  const [banner, setBanner] = useState(null); // { type, text }
  const [isProcessing, setIsProcessing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [releasable, setReleasable] = useState([]); // RELEASE_CLAIM_V1

  // RELEASE_CLAIM_V1 — only app admins may release a roster link
  const { data: me } = useQuery({
    queryKey: ['me_for_match_modal', 'RELEASE_CLAIM_V1'],
    queryFn: () => base44.auth.me(),
  });
  const isAppAdmin = !!me && (me.role === 'admin' || me.user_type === 'app_admin');

  const pairs = useMemo(() => {
    if (application.league_team_pairs?.length > 0) {
      return application.league_team_pairs.filter(p => p && p.team_id);
    }
    if (application.league_id && application.team_id) {
      return [{ league_id: application.league_id, team_id: application.team_id }];
    }
    return [];
  }, [application]);

  const teamIds = useMemo(() => pairs.map(p => p.team_id), [pairs]);

  const suggestionsByTeam = useMemo(() => {
    const map = {};
    (application.match_suggestions || []).forEach(s => { if (s && s.team_id) map[s.team_id] = s; });
    return map;
  }, [application]);

  // Fetch ONLY the rosters for the known teams (small, no pagination risk)
  const { data: rostersByTeam = {}, isLoading } = useQuery({
    queryKey: ['roster_for_teams', teamIds.join(",")],
    queryFn: async () => {
      const arrays = await Promise.all(teamIds.map(tid => base44.entities.Player.filter({ team_id: tid })));
      const out = {};
      teamIds.forEach((tid, i) => { out[tid] = Array.isArray(arrays[i]) ? arrays[i] : []; });
      return out;
    },
    enabled: teamIds.length > 0,
  });

  // Pre-select the suggested player for each team once rosters arrive (only if it really exists on the roster)
  useEffect(() => {
    if (initialized || isLoading || teamIds.length === 0) return;
    const init = {};
    teamIds.forEach(tid => {
      const sug = suggestionsByTeam[tid];
      const roster = rostersByTeam[tid] || [];
      if (sug && sug.suggested_player_id && roster.some(p => p.id === sug.suggested_player_id)) {
        init[tid] = sug.suggested_player_id;
      }
    });
    setSelections(init);
    setInitialized(true);
  }, [initialized, isLoading, teamIds, suggestionsByTeam, rostersByTeam]);

  const allSelected = teamIds.length > 0 && teamIds.every(tid => selections[tid]);

  const handleApprove = async () => {
    if (!allSelected) return;
    setIsProcessing(true);
    setBanner(null);
    try {
      const player_matches = pairs.map(pair => {
        const pid = selections[pair.team_id];
        const roster = rostersByTeam[pair.team_id] || [];
        const player = roster.find(p => p.id === pid);
        return {
          league_id: pair.league_id,
          team_id: pair.team_id,
          matched_player_id: pid,
          matched_player_name: player?.name || application.display_name || "",
        };
      });

      const res = await base44.functions.invoke('approveUserApplication', {
        applicationId: application.id,
        action: 'approve',
        player_matches,
      });
      const data = res?.data || {};
      const conflicts = Array.isArray(data.conflicts) ? data.conflicts : [];

      if (conflicts.length > 0) {
        const msgs = conflicts.map(c => {
          const league = leagues.find(l => l.id === c.league_id);
          if (c.reason === 'already_claimed') {
            return `${league?.name || c.league_id}: that roster player is already linked to another user${c.claimed_by ? ` (${c.claimed_by})` : ''}.`;
          }
          return `${league?.name || c.league_id}: ${c.reason}.`;
        });
        // RELEASE_CLAIM_V1 — remember which slots could be released
        const rel = [];
        conflicts.forEach(c => {
          if (c.reason !== 'already_claimed') return;
          const pair = pairs.find(p => p.league_id === c.league_id);
          const pid = pair ? selections[pair.team_id] : null;
          if (pid) rel.push({ league_id: c.league_id, player_id: pid, claimed_by: c.claimed_by || '' });
        });
        setReleasable(rel);
        setBanner({ type: 'error', text: `Could not approve — ${msgs.join(' ')} Pick a different roster player or decline.` });
        setIsProcessing(false);
        return;
      }

      setReleasable([]);

      queryClient.invalidateQueries({ queryKey: ['user_applications_pending'] });
      queryClient.invalidateQueries({ queryKey: ['review_requests'] });
      onApproved();
    } catch (error) {
      setBanner({ type: 'error', text: "Failed to approve: " + (error?.message || "unknown error") });
      setIsProcessing(false);
    }
  };

  // RELEASE_CLAIM_V1 — delete the stale identity row(s), then retry the approval
  const handleRelease = async () => {
    if (releasable.length === 0) return;
    if (!window.confirm("Release the existing roster link and approve this applicant? The other account will lose its link to this roster player.")) return;
    setIsProcessing(true);
    setBanner(null);
    try {
      for (const r of releasable) {
        await base44.functions.invoke('approveUserApplication', {
          applicationId: application.id,
          action: 'release_claim',
          league_id: r.league_id,
          player_id: r.player_id,
        });
      }
      setReleasable([]);
      setIsProcessing(false);
      await handleApprove();
    } catch (error) {
      setBanner({ type: 'error', text: "Could not release the existing link: " + (error?.message || "unknown error") });
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!window.confirm("Decline this player application? The applicant will not be granted access.")) return;
    setIsProcessing(true);
    setBanner(null);
    try {
      await base44.functions.invoke('approveUserApplication', { applicationId: application.id, action: 'reject' });
      queryClient.invalidateQueries({ queryKey: ['user_applications_pending'] });
      queryClient.invalidateQueries({ queryKey: ['review_requests'] });
      onApproved();
    } catch (error) {
      setBanner({ type: 'error', text: "Failed to decline: " + (error?.message || "unknown error") });
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-orange-500" />
            Confirm Player
          </DialogTitle>
        </DialogHeader>

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-sm space-y-1">
          <div><span className="text-slate-500">Applicant:</span> <span className="font-medium">{application.user_name}</span></div>
          {application.display_name && <div><span className="text-slate-500">Claimed name:</span> <span className="font-medium">{application.display_name}</span></div>}
          <div><span className="text-slate-500">Claimed jersey:</span> <span className="font-medium">#{application.jersey_number || "—"}</span></div>
          {application.handle && <div><span className="text-slate-500">Nickname:</span> <span className="font-medium">{application.handle}</span></div>}
        </div>

        {banner && (
          <div className={`rounded-lg p-3 text-sm ${banner.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{banner.text}</span>
            </div>
            {/* RELEASE_CLAIM_V1 */}
            {isAppAdmin && releasable.length > 0 && (
              <div className="mt-2.5">
                <Button onClick={handleRelease} disabled={isProcessing} variant="outline" className="w-full border-red-300 text-red-700 hover:bg-red-100 bg-white">
                  <Unlink className="w-4 h-4 mr-1.5" />
                  Release that link and approve
                </Button>
                <p className="text-xs text-red-600/80 mt-1.5 text-center">Removes the old link, then approves. This is logged.</p>
              </div>
            )}
          </div>
        )}

        <div className="max-h-[22rem] overflow-y-auto space-y-3">
          {isLoading ? (
            <p className="text-slate-400 text-sm text-center py-4">Loading rosters...</p>
          ) : (
            pairs.map((pair, idx) => {
              const league = leagues.find(l => l.id === pair.league_id);
              const team = teams.find(t => t.id === pair.team_id);
              const roster = rostersByTeam[pair.team_id] || [];
              const sug = suggestionsByTeam[pair.team_id];
              const suggestedId = sug?.suggested_player_id || null;
              const meta = CONFIDENCE_META[sug?.confidence] || CONFIDENCE_META.none;
              const sorted = [...roster].sort((a, b) => {
                if (a.id === suggestedId) return -1;
                if (b.id === suggestedId) return 1;
                return (parseInt(a.jersey_number) || 999) - (parseInt(b.jersey_number) || 999);
              });
              return (
                <div key={idx} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-600">{league?.name} · <span className="text-slate-800">{team?.name}</span></p>
                    <Badge className={`text-xs ${meta.cls}`}>{meta.label}</Badge>
                  </div>
                  {sug?.reason && <p className="text-xs text-slate-500 mb-2">{sug.reason}</p>}
                  {roster.length === 0 ? (
                    <p className="text-slate-400 text-sm py-2">No players on this team's roster yet. Add the player to the roster first, then approve.</p>
                  ) : (
                    <div className="space-y-1">
                      {sorted.map(player => {
                        const isSelected = selections[pair.team_id] === player.id;
                        const isSuggested = player.id === suggestedId;
                        return (
                          <div
                            key={player.id}
                            onClick={() => setSelections(prev => ({ ...prev, [pair.team_id]: player.id }))}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer border transition-all ${isSelected ? "bg-orange-50 border-orange-300" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                          >
                            <div>
                              <p className="font-medium text-sm text-slate-900">{player.name}</p>
                              <p className="text-xs text-slate-500">#{player.jersey_number || "—"}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isSuggested && <Badge className="bg-orange-100 text-orange-700 text-xs">Suggested</Badge>}
                              {isSelected && <Check className="w-4 h-4 text-orange-500" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={handleApprove} disabled={!allSelected || isProcessing} className="flex-1 bg-green-600 hover:bg-green-700">
            <Check className="w-4 h-4 mr-1" />
            {isProcessing ? "Processing..." : "Confirm & Approve"}
          </Button>
          <Button onClick={handleDecline} variant="outline" disabled={isProcessing} className="flex-1 border-red-200 text-red-600 hover:bg-red-50">
            <X className="w-4 h-4 mr-1" />
            Decline
          </Button>
        </div>
        <Button onClick={onClose} variant="ghost" disabled={isProcessing} className="w-full text-slate-500">
          Cancel (decide later)
        </Button>
      </DialogContent>
    </Dialog>
  );
}
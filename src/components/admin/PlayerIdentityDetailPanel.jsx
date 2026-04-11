import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, Link2, User, Mail, Calendar, Shield, Trophy, Tag } from "lucide-react";
import PlayerLeagueMatchModal from "@/components/admin/PlayerLeagueMatchModal";

const STATUS_COLORS = {
  completed: "bg-green-100 text-green-800",
  missing: "bg-yellow-100 text-yellow-800",
};

export default function PlayerIdentityDetailPanel({ player, leagues, teams, identities, onClose, onSaved }) {
  const [editValues, setEditValues] = useState({
    full_name: player.full_name || "",
    display_name: player.display_name || "",
    handle: player.handle || "",
  });
  const [saving, setSaving] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const queryClient = useQueryClient();

  // Reset when player changes
  useEffect(() => {
    setEditValues({
      full_name: player.full_name || "",
      display_name: player.display_name || "",
      handle: player.handle || "",
    });
  }, [player.id]);

  const handleSave = async () => {
    setSaving(true);
    const trimmedFullName = editValues.full_name.trim();
    const trimmedDisplayName = editValues.display_name.trim();
    const promises = [
      base44.entities.User.update(player.id, {
        display_name: trimmedDisplayName,
        handle: editValues.handle.trim(),
        player_name_status: trimmedDisplayName ? "completed" : "missing",
      }),
    ];
    if (trimmedFullName && trimmedFullName !== player.full_name) {
      promises.push(base44.functions.invoke("updateUserFullName", { userId: player.id, full_name: trimmedFullName }));
    }
    await Promise.all(promises);
    queryClient.invalidateQueries({ queryKey: ["player_users"] });
    setSaving(false);
    onSaved?.();
  };

  const leaguePairs = player.league_team_pairs || [];
  const leagueIds = player.assigned_league_ids || [];

  const playerIdentities = identities.filter(i => i.user_id === player.id);

  const getMatchBadge = (identity) => {
    if (identity.match_status === "matched") return <Badge className="bg-green-100 text-green-800 text-xs">Matched</Badge>;
    if (identity.match_status === "needs_review") return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Needs Review</Badge>;
    return <Badge className="bg-red-100 text-red-800 text-xs">Unmatched</Badge>;
  };

  const formatDate = (val) => {
    const d = val ? new Date(val) : null;
    return d && !isNaN(d) ? d.toLocaleDateString() : "—";
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-lg flex-shrink-0">
              {(player.full_name || player.email || "?")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 truncate">{player.full_name || player.email}</p>
              <p className="text-xs text-slate-500 truncate">{player.user_type || "player"}</p>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} className="flex-shrink-0">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Identity Fields */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Identity Fields</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Full Name
                </label>
                <Input
                  value={editValues.full_name}
                  onChange={e => setEditValues(v => ({ ...v, full_name: e.target.value }))}
                  placeholder="Full name"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1 flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" /> Display Name <span className="text-slate-400 font-normal">(shown in stats & awards)</span>
                </label>
                <Input
                  value={editValues.display_name}
                  onChange={e => setEditValues(v => ({ ...v, display_name: e.target.value }))}
                  placeholder="Display name"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Handle <span className="text-slate-400 font-normal">(nickname, optional)</span>
                </label>
                <Input
                  value={editValues.handle}
                  onChange={e => setEditValues(v => ({ ...v, handle: e.target.value }))}
                  placeholder="@handle"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </section>

          {/* Read-only info */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Account Info</h3>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-600 break-all">{player.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-600">Joined {formatDate(player.created_date)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-600 capitalize">{player.user_type || "player"}</span>
                <Badge className={STATUS_COLORS[player.player_name_status] || "bg-slate-100 text-slate-500"}>
                  {player.player_name_status || "not set"}
                </Badge>
              </div>
            </div>
          </section>

          {/* League / Team Assignments */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">League & Team Assignments</h3>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={() => setShowMatchModal(true)}
              >
                <Link2 className="w-3 h-3" />
                Match Leagues
              </Button>
            </div>

            {leaguePairs.length > 0 ? (
              <div className="space-y-2">
                {leaguePairs.map((pair, i) => {
                  const league = leagues.find(l => l.id === pair.league_id);
                  const team = teams.find(t => t.id === pair.team_id);
                  const identity = playerIdentities.find(id => id.league_id === pair.league_id);
                  return (
                    <div key={i} className="bg-white border border-slate-200 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{league?.name || pair.league_id}</p>
                          {team && <p className="text-xs text-slate-500 mt-0.5">{team.name}</p>}
                          {identity?.matched_player_name && (
                            <p className="text-xs text-green-700 mt-1">→ Matched: <span className="font-medium">{identity.matched_player_name}</span></p>
                          )}
                        </div>
                        {identity ? getMatchBadge(identity) : <Badge className="bg-slate-100 text-slate-500 text-xs">No Identity</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : leagueIds.length > 0 ? (
              <div className="space-y-2">
                {leagueIds.map(id => {
                  const league = leagues.find(l => l.id === id);
                  const identity = playerIdentities.find(pi => pi.league_id === id);
                  return (
                    <div key={id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800 truncate">{league?.name || id}</p>
                      {identity ? getMatchBadge(identity) : <Badge className="bg-slate-100 text-slate-500 text-xs">No Identity</Badge>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No leagues assigned.</p>
            )}
          </section>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-slate-200 bg-white flex-shrink-0 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : <><Check className="w-4 h-4 mr-1.5" />Save Changes</>}
          </Button>
        </div>
      </div>

      {showMatchModal && (
        <PlayerLeagueMatchModal
          player={player}
          onClose={() => {
            setShowMatchModal(false);
            queryClient.invalidateQueries({ queryKey: ["userLeagueIdentities"] });
          }}
        />
      )}
    </>
  );
}
import React, { useRef, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Camera, Upload, Trash2, Loader2, Flame } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function computeStats(stats) {
  const gp = stats.length;
  if (gp === 0) return { gp: 0, ppg: null, rpg: null, apg: null };
  let pts = 0, reb = 0, ast = 0;
  stats.forEach(s => {
    pts += (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0);
    reb += (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0);
    ast += s.assists || 0;
  });
  return {
    gp,
    ppg: (pts / gp).toFixed(1),
    rpg: (reb / gp).toFixed(1),
    apg: (ast / gp).toFixed(1),
  };
}

function getScoringRank(myPlayerId, allStats) {
  if (!myPlayerId || !allStats.length) return null;
  const playerPts = {};
  allStats.forEach(s => {
    const pts = (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0);
    if (!playerPts[s.player_id]) playerPts[s.player_id] = { pts: 0, gp: 0 };
    playerPts[s.player_id].pts += pts;
    playerPts[s.player_id].gp += 1;
  });
  const ranked = Object.entries(playerPts)
    .map(([id, d]) => ({ id, ppg: d.gp > 0 ? d.pts / d.gp : 0 }))
    .sort((a, b) => b.ppg - a.ppg);
  const idx = ranked.findIndex(r => r.id === myPlayerId);
  return idx >= 0 ? idx + 1 : null;
}

function getDoubleDoubles(stats) {
  return stats.filter(s => {
    const pts = (s.points_2||0)*2 + (s.points_3||0)*3 + (s.free_throws||0);
    const reb = (s.offensive_rebounds||0) + (s.defensive_rebounds||0);
    return [pts >= 10, reb >= 10, (s.assists||0) >= 10].filter(Boolean).length >= 2;
  }).length;
}

function getTwentyPlusGames(stats) {
  return stats.filter(s => (s.points_2||0)*2 + (s.points_3||0)*3 + (s.free_throws||0) >= 20).length;
}

function getHotStreak(stats, games) {
  if (!stats.length || !games.length) return 0;
  const sorted = [...games]
    .filter(g => g.status === 'completed')
    .sort((a, b) => new Date(b.game_date) - new Date(a.game_date))
    .slice(0, 5);
  let streak = 0;
  for (const game of sorted) {
    const s = stats.find(st => st.game_id === game.id);
    if (!s) break;
    const pts = (s.points_2||0)*2 + (s.points_3||0)*3 + (s.free_throws||0);
    if (pts >= 15) streak++;
    else break;
  }
  return streak;
}

export default function PlayerDashboardCard({
  currentUser, team, playerRecord, myStats, allStats, games, leagueName, onPhotoUpdate
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const displayName = currentUser?.display_name || currentUser?.full_name || "Player";
  const handle = currentUser?.handle;
  const photoUrl = currentUser?.profile_photo_url;
  const initials = displayName.charAt(0).toUpperCase();

  const stats = useMemo(() => computeStats(myStats), [myStats]);
  const doubleDoubles = useMemo(() => getDoubleDoubles(myStats), [myStats]);
  const twentyPlus = useMemo(() => getTwentyPlusGames(myStats), [myStats]);
  const hotStreak = useMemo(() => getHotStreak(myStats, games), [myStats, games]);
  const scoringRank = useMemo(() => getScoringRank(playerRecord?.id, allStats), [playerRecord, allStats]);

  // Season progress: completed games vs all team games
  const completedGames = useMemo(() => games.filter(g => g.status === 'completed').length, [games]);
  const totalGames = games.length;
  const progressPct = totalGames > 0 ? Math.round((completedGames / totalGames) * 100) : 0;

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Photo must be less than 5MB"); return; }
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.auth.updateMe({ profile_photo_url: file_url });
    setUploading(false);
    onPhotoUpdate?.();
    e.target.value = "";
  };

  const handleRemovePhoto = async () => {
    await base44.auth.updateMe({ profile_photo_url: null });
    onPhotoUpdate?.();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Scoring rank bar */}
      {scoringRank && (
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center gap-3">
          <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1">
            📊 Scoring Rank: #{scoringRank}
          </span>
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:block">Season Progress:</span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
              <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-xs text-slate-500 font-medium">{progressPct}%</span>
          </div>
        </div>
      )}

      {/* Player identity */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative flex-shrink-0 group cursor-pointer">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-indigo-100 border-2 border-indigo-200 flex items-center justify-center">
                  {uploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  ) : photoUrl ? (
                    <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-indigo-600">{initials}</span>
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" /> Upload Photo
              </DropdownMenuItem>
              {photoUrl && (
                <DropdownMenuItem onClick={handleRemovePhoto} className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" /> Remove Photo
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900">{displayName}</h2>
              {hotStreak >= 3 && (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">
                  <Flame className="w-3 h-3" /> Hot Streak
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {team?.name || leagueName || "—"}
              {playerRecord?.position ? ` | ${playerRecord.position}` : ""}
              {playerRecord?.jersey_number !== undefined ? ` # ${playerRecord.jersey_number}` : ""}
            </p>
            {handle && <p className="text-xs text-slate-400">@{handle}</p>}
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: "PPG", value: stats.ppg },
            { label: "RPG", value: stats.rpg },
            { label: "APG", value: stats.apg },
            { label: "GP", value: stats.gp > 0 ? stats.gp : null },
          ].map(({ label, value }) => (
            <div key={label} className="bg-indigo-50 rounded-xl p-2 text-center">
              <p className="text-lg font-bold text-indigo-700">{value ?? "—"}</p>
              <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>

        {/* Recognition badges */}
        {(doubleDoubles > 0 || twentyPlus > 0 || hotStreak >= 3) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {doubleDoubles > 0 && (
              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold">
                🏆 Double-Double ×{doubleDoubles}
              </span>
            )}
            {twentyPlus > 0 && (
              <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold">
                🎯 20+ Points Game ×{twentyPlus}
              </span>
            )}
            {hotStreak >= 3 && (
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">
                {"🔥".repeat(Math.min(hotStreak, 3))} {hotStreak} Game Hot Streak
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
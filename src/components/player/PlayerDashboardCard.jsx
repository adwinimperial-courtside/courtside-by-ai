import React, { useRef, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Camera, Upload, Trash2, Loader2, Flame, TrendingUp } from "lucide-react";
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
  return { gp, ppg: (pts / gp).toFixed(1), rpg: (reb / gp).toFixed(1), apg: (ast / gp).toFixed(1) };
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
  currentUser, team, playerRecord, myStats, allStats, games, teamId, leagueName, onPhotoUpdate
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const displayName = currentUser?.display_name || currentUser?.full_name || "Player";
  const handle = currentUser?.handle;
  const photoUrl = currentUser?.profile_photo_url;
  const initials = displayName.charAt(0).toUpperCase();

  const stats = useMemo(() => computeStats(myStats), [myStats]);
  const hotStreak = useMemo(() => getHotStreak(myStats, games), [myStats, games]);
  const scoringRank = useMemo(() => getScoringRank(playerRecord?.id, allStats), [playerRecord, allStats]);

  // Player participation: games with stats / team games played
  const playerGamesPlayed = useMemo(() => myStats.length, [myStats]);
  const teamGamesPlayed = useMemo(() => games.filter(g => g.status === 'completed').length, [games]);
  const progressPct = teamGamesPlayed > 0 ? Math.round((playerGamesPlayed / teamGamesPlayed) * 100) : 0;



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

  const statTiles = [
    { label: "PPG", value: stats.ppg },
    { label: "RPG", value: stats.rpg },
    { label: "APG", value: stats.apg },
    { label: "GP",  value: stats.gp > 0 ? stats.gp : null },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden -mt-20 pt-6 pb-6 px-6 relative z-20 mb-8">

      {/* ── 1. Ranking + Game Participation ── */}
      <div className="pb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          {scoringRank ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
              <TrendingUp className="w-4 h-4" />
              Scoring Rank: #{scoringRank}
            </span>
          ) : (
            <span className="text-xs text-slate-400 font-medium">Game Participation</span>
          )}
          {teamGamesPlayed > 0 && (
            <span className="text-sm font-bold text-slate-700 bg-indigo-50 px-3 py-1 rounded-full">{progressPct}%</span>
          )}
        </div>
        {teamGamesPlayed > 0 && (
          <>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">{playerGamesPlayed} of {teamGamesPlayed} team games played</p>
          </>
        )}
      </div>

      {/* ── 2. Player Identity ── */}
      <div className="flex items-start gap-6 pb-8 border-b border-slate-100">
        {/* Avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative flex-shrink-0 group cursor-pointer">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-indigo-100 border-4 border-indigo-200 flex items-center justify-center shadow-md">
                {uploading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                ) : photoUrl ? (
                  <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-indigo-600">{initials}</span>
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
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

        {/* Name / team / position */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h2 className="text-3xl font-bold text-slate-900 leading-tight">{displayName}</h2>
            {hotStreak >= 3 && (
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">
                <Flame className="w-4 h-4" /> Hot
              </span>
            )}
          </div>
          <p className="text-base text-slate-600 font-semibold leading-snug">
            {[
              team?.name || leagueName,
              playerRecord?.position,
              playerRecord?.jersey_number !== undefined ? `#${playerRecord.jersey_number}` : null,
            ].filter(Boolean).join(" • ")}
          </p>
          {handle && (
            <p className="text-sm text-slate-500 font-medium mt-2">@{handle}</p>
          )}
        </div>
      </div>

      {/* ── 3. Stat Tiles ── */}
      <div className="pt-6">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Season Stats</p>
        <div className="grid grid-cols-4 gap-3">
          {statTiles.map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl py-4 px-2 text-center border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-2xl font-bold text-slate-900 leading-none">{value ?? "—"}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-2">{label}</p>
            </div>
          ))}
        </div>
      </div>


    </div>
  );
}
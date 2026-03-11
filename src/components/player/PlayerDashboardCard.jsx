import React, { useRef, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Camera, Upload, Trash2, Loader2, Flame, TrendingUp, TrendingDown } from "lucide-react";
import { getRankMovement } from "@/components/utils/rankMovementTracker";
import { getMilestoneProgress } from "./milestoneCalculator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function didPlayerParticipate(stat) {
  // Check if player actually participated based on priority:
  // 1. explicit did_play flag
  // 2. starter status
  // 3. minutes_played > 0
  // 4. any recorded stat or foul > 0
  if (stat.did_play) return true;
  if (stat.is_starter) return true;
  if ((stat.minutes_played || 0) > 0) return true;
  const hasStats = (stat.points_2 || 0) + (stat.points_3 || 0) + (stat.free_throws || 0) +
                   (stat.assists || 0) + (stat.steals || 0) + (stat.blocks || 0) +
                   (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0) +
                   (stat.fouls || 0) + (stat.technical_fouls || 0) + (stat.unsportsmanlike_fouls || 0) > 0;
  return hasStats;
}

function computeStats(stats) {
  const participatedStats = stats.filter(didPlayerParticipate);
  const gp = participatedStats.length;
  if (gp === 0) return { gp: 0, ppg: null, rpg: null, apg: null };
  
  const totals = participatedStats.reduce((acc, s) => ({
    points: acc.points + ((s.points_2 || 0) * 2) + ((s.points_3 || 0) * 3) + (s.free_throws || 0),
    rebounds: acc.rebounds + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0),
    assists: acc.assists + (s.assists || 0)
  }), { points: 0, rebounds: 0, assists: 0 });
  
  return {
    gp,
    ppg: (totals.points / gp).toFixed(1),
    rpg: (totals.rebounds / gp).toFixed(1),
    apg: (totals.assists / gp).toFixed(1)
  };
}

function getCategoryRank(myPlayerId, allStats, categoryKey) {
  if (!myPlayerId || !allStats.length) return null;

  const playerStats = {};
  allStats.forEach(s => {
    if (!didPlayerParticipate(s)) return; // Only count participated games
    if (!playerStats[s.player_id]) playerStats[s.player_id] = { total: 0, gp: 0 };
    let catValue = 0;
    if (categoryKey === 'points') {
      catValue = (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0);
    } else if (categoryKey === 'rebounds') {
      catValue = (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0);
    } else if (categoryKey === 'assists') {
      catValue = s.assists || 0;
    } else if (categoryKey === 'steals') {
      catValue = s.steals || 0;
    } else if (categoryKey === 'blocks') {
      catValue = s.blocks || 0;
    }
    playerStats[s.player_id].total += catValue;
    playerStats[s.player_id].gp += 1;
  });

  const ranked = Object.entries(playerStats)
    .map(([id, d]) => ({ id, ppg: d.gp > 0 ? d.total / d.gp : 0 }))
    .sort((a, b) => b.ppg - a.ppg);

  const idx = ranked.findIndex(r => r.id === myPlayerId);
  if (idx < 0) return null;

  const totalPlayers = ranked.length;
  const percentile = totalPlayers > 0 ? Math.round(((totalPlayers - idx) / totalPlayers) * 100) : 0;

  return { rank: idx + 1, ppg: parseFloat(ranked[idx].ppg), percentile };
}

function getPrimaryRank(myPlayerId, allStats, myStats) {
  const THRESHOLDS = {
    points: 8,
    rebounds: 4,
    assists: 3,
    steals: 1,
    blocks: 0.8,
  };

  const CATEGORIES = ['points', 'rebounds', 'assists', 'steals', 'blocks'];
  const PRIORITY = { assists: 0, points: 1, rebounds: 2, steals: 3, blocks: 4 };

  if (!myPlayerId || !allStats.length || !myStats.length) return null;

  // Calculate player's averages
  const myAverages = {};
  CATEGORIES.forEach(cat => {
    const catRankData = getCategoryRank(myPlayerId, allStats, cat);
    if (catRankData) {
      myAverages[cat] = catRankData.ppg;
    }
  });

  // Filter valid categories by threshold and notability
  const validCandidates = [];
  CATEGORIES.forEach(cat => {
    const threshold = THRESHOLDS[cat];
    if (myAverages[cat] >= threshold) {
      const rankData = getCategoryRank(myPlayerId, allStats, cat);
      const isTopTen = rankData.rank <= 10;
      const isTop25Percentile = rankData.percentile >= 75;
      if (isTopTen || isTop25Percentile) {
        validCandidates.push({ cat, ...rankData });
      }
    }
  });

  if (!validCandidates.length) return null;

  // Sort by: best percentile, then lowest rank, then priority order
  validCandidates.sort((a, b) => {
    if (b.percentile !== a.percentile) return b.percentile - a.percentile;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return PRIORITY[a.cat] - PRIORITY[b.cat];
  });

  return validCandidates[0];
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
  currentUser, team, playerRecord, myStats, allStats, games, teamId, leagueId, leagueName, onPhotoUpdate
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const displayName = currentUser?.display_name || currentUser?.full_name || "Player";
  const handle = currentUser?.handle;
  const photoUrl = currentUser?.profile_photo_url;
  const initials = displayName.charAt(0).toUpperCase();

  const stats = useMemo(() => computeStats(myStats), [myStats]);
  const hotStreak = useMemo(() => getHotStreak(myStats, games), [myStats, games]);
  const primaryRank = useMemo(() => getPrimaryRank(playerRecord?.id, allStats, myStats), [playerRecord?.id, allStats, myStats]);
  const rankMovement = useMemo(() => {
    if (!primaryRank || !leagueId || !playerRecord?.id) return { change: 0, direction: 'neutral' };
    return getRankMovement(leagueId, playerRecord.id, primaryRank.rank, primaryRank.cat);
  }, [primaryRank, leagueId, playerRecord?.id]);

  // Milestone progress
  const milestone = useMemo(() => getMilestoneProgress(myStats, games), [myStats, games]);



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
    <div className="space-y-3 -mt-16 pt-0 pb-0 px-3 relative z-20 mb-8 w-full max-w-full overflow-x-hidden">

      {/* ── 1. Hero Rank Card ── */}
      {primaryRank && (
        <div className="bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 rounded-2xl px-3 py-3 text-white shadow-lg w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold opacity-90 uppercase tracking-wide truncate">TOP PERFORMER</p>
              <p className="text-xl sm:text-2xl font-black mt-0.5 truncate">{primaryRank.cat.charAt(0).toUpperCase() + primaryRank.cat.slice(1)} Rank</p>
              <p className="text-2xl sm:text-3xl font-black mt-0">#{primaryRank.rank}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="bg-white/20 backdrop-blur rounded-xl px-2 py-1">
                <p className="text-xs font-bold opacity-90">Percentile</p>
                <p className="text-xl sm:text-2xl font-black">{primaryRank.percentile}%</p>
              </div>
              {rankMovement.direction !== 'neutral' && (
                <div className={`mt-1 flex items-center justify-end gap-0.5 font-bold text-xs ${rankMovement.direction === 'up' ? 'text-green-300' : 'text-orange-300'}`}>
                  {rankMovement.direction === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {rankMovement.change}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. Progress Bar ── */}
      {milestone && (
        <div className="w-full overflow-x-hidden">
          <div className="flex items-center justify-between mb-2 gap-2">
            <p className="text-xs font-black text-slate-700 uppercase tracking-wide truncate flex-1">{milestone.name}</p>
            <span className="inline-flex items-center bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg text-xs font-bold flex-shrink-0">{Math.round(milestone.progress)}%</span>
          </div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden shadow-sm">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 rounded-full transition-all duration-500 shadow-lg"
              style={{ width: `${Math.min(milestone.progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-600 font-bold mt-1.5">{milestone.current} / {milestone.target} {milestone.unit}</p>
        </div>
      )}

      {/* ── 3. Player Card ── */}
      <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden w-full">
        {/* Photo Hero on Mobile */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 px-4 pt-4 pb-2 w-full overflow-x-hidden">
          <div className="flex flex-col items-center text-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative group cursor-pointer mb-3 flex-shrink-0">
                  <div className="w-36 h-36 rounded-full overflow-hidden bg-gradient-to-br from-indigo-200 to-blue-200 border-4 border-indigo-300 flex items-center justify-center shadow-xl flex-shrink-0">
                    {uploading ? (
                       <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                     ) : photoUrl ? (
                       <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
                     ) : (
                       <span className="text-6xl font-black text-indigo-600">{initials}</span>
                     )}
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
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

            {/* Name and Info */}
            <div className="w-full px-1 min-w-0">
              <div className="flex items-center gap-1 justify-center flex-wrap mb-2">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 truncate">{displayName}</h2>
                {hotStreak >= 3 && (
                  <span className="inline-flex items-center gap-0.5 bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-xs font-black flex-shrink-0">
                    <Flame className="w-3 h-3" /> HOT
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 font-bold truncate">
                {[
                  team?.name || leagueName,
                  playerRecord?.position,
                  playerRecord?.jersey_number !== undefined ? `#${playerRecord.jersey_number}` : null,
                ].filter(Boolean).join(" • ")}
              </p>
              {handle && (
                <p className="text-xs text-slate-500 font-bold mt-0.5 truncate">@{handle}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stat Tiles */}
        <div className="px-3 py-3 grid grid-cols-2 gap-2 w-full">
          {statTiles.map(({ label, value }) => (
            <div key={label} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl py-3 px-2 text-center border border-blue-200 shadow-sm overflow-hidden">
              <p className="text-xl sm:text-2xl font-black text-indigo-600 leading-none truncate">{value ?? "—"}</p>
              <p className="text-xs text-slate-600 font-bold uppercase tracking-wide mt-1 truncate">{label}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
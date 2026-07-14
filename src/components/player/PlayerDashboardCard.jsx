import React, { useRef, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Camera, Upload, Trash2, Loader2, Flame, TrendingUp, TrendingDown } from "lucide-react";
import { getRankMovement } from "@/components/utils/rankMovementTracker";
import { getMilestoneProgress } from "./milestoneCalculator";
// CARD_FORMAT_V1 — points math comes from the stat engine (format-aware).
import { calcPoints as enginePoints } from "@/components/stats/statEngine";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// PROFILE_GOLD_V1 — trophy-room theme palette (sampled from the hero background image)
const GOLD_HI = "#E5C688";
const GOLD_MID = "#C8A468";
const GOLD_DEEP = "#8A6B42";
const GOLD_CHIP_TEXT = "#1A1206";
const WARM_WHITE = "#EFE6D4";
const WARM_MUTED = "#877A63";
const SURFACE = "#15110B";
const BORDER_GOLD = "#3A2E1B";
const DIVIDER = "#2A2114";
const HERO_BG_URL = "https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/867069f1e_courtside-hero-background-only.png";

function didPlayerParticipate(stat) {
  if (stat.did_play) return true;
  if (stat.is_starter) return true;
  if ((stat.minutes_played || 0) > 0) return true;
  const hasStats = (stat.points_2 || 0) + (stat.points_3 || 0) + (stat.free_throws || 0) +
                   (stat.assists || 0) + (stat.steals || 0) + (stat.blocks || 0) +
                   (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0) +
                   (stat.fouls || 0) + (stat.technical_fouls || 0) + (stat.unsportsmanlike_fouls || 0) > 0;
  return hasStats;
}

// CARD_FORMAT_V1 — per-stat points via the engine, with the game's detected format.
function statPoints(stat, gamesById, formatMap) {
  const game = gamesById.get(stat.game_id);
  return enginePoints(stat, game, formatMap ? formatMap[stat.game_id] : undefined);
}

// PROFILE_GOLD_V1 — extended with steals and blocks per game
function computeStats(stats, games, formatMap) {
  const participatedStats = stats.filter(didPlayerParticipate);
  const gp = participatedStats.length;
  if (gp === 0) return { gp: 0, ppg: null, rpg: null, apg: null, spg: null, bpg: null };

  const gamesById = new Map(games.map(g => [g.id, g])); // CARD_FORMAT_V1
  const totals = participatedStats.reduce((acc, s) => ({
    points: acc.points + statPoints(s, gamesById, formatMap),
    rebounds: acc.rebounds + (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0),
    assists: acc.assists + (s.assists || 0),
    steals: acc.steals + (s.steals || 0),
    blocks: acc.blocks + (s.blocks || 0)
  }), { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 });

  return {
    gp,
    ppg: (totals.points / gp).toFixed(1),
    rpg: (totals.rebounds / gp).toFixed(1),
    apg: (totals.assists / gp).toFixed(1),
    spg: (totals.steals / gp).toFixed(1),
    bpg: (totals.blocks / gp).toFixed(1)
  };
}

function getCategoryRank(myPlayerId, allStats, categoryKey, games, formatMap) {
  if (!myPlayerId || !allStats.length) return null;

  const gamesById = new Map((games || []).map(g => [g.id, g])); // CARD_FORMAT_V1
  const playerStats = {};
  allStats.forEach(s => {
    if (!didPlayerParticipate(s)) return;
    if (!playerStats[s.player_id]) playerStats[s.player_id] = { total: 0, gp: 0 };
    let catValue = 0;
    if (categoryKey === 'points') {
      catValue = statPoints(s, gamesById, formatMap);
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

function getPrimaryRank(myPlayerId, allStats, myStats, games, formatMap) {
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

  const myAverages = {};
  CATEGORIES.forEach(cat => {
    const catRankData = getCategoryRank(myPlayerId, allStats, cat, games, formatMap);
    if (catRankData) {
      myAverages[cat] = catRankData.ppg;
    }
  });

  const validCandidates = [];
  CATEGORIES.forEach(cat => {
    const threshold = THRESHOLDS[cat];
    if (myAverages[cat] >= threshold) {
      const rankData = getCategoryRank(myPlayerId, allStats, cat, games, formatMap);
      const isTopTen = rankData.rank <= 10;
      const isTop25Percentile = rankData.percentile >= 75;
      if (isTopTen || isTop25Percentile) {
        validCandidates.push({ cat, ...rankData });
      }
    }
  });

  if (!validCandidates.length) return null;

  validCandidates.sort((a, b) => {
    if (b.percentile !== a.percentile) return b.percentile - a.percentile;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return PRIORITY[a.cat] - PRIORITY[b.cat];
  });

  return validCandidates[0];
}

function getHotStreak(stats, games, formatMap) {
  if (!stats.length || !games.length) return 0;
  const sorted = [...games]
    .filter(g => g.status === 'completed')
    .sort((a, b) => new Date(b.game_date) - new Date(a.game_date))
    .slice(0, 5);
  let streak = 0;
  for (const game of sorted) {
    const s = stats.find(st => st.game_id === game.id);
    if (!s) break;
    const pts = enginePoints(s, game, formatMap ? formatMap[game.id] : undefined); // CARD_FORMAT_V1
    if (pts >= 15) streak++;
    else break;
  }
  return streak;
}

// PROFILE_GOLD_V1 — chip label per rank category
const RANK_LABELS = {
  points: "IN SCORING",
  rebounds: "IN REBOUNDING",
  assists: "IN ASSISTS",
  steals: "IN STEALS",
  blocks: "IN BLOCKS",
};

export default function PlayerDashboardCard({
  currentUser, team, playerRecord, myStats, allStats, games, teamId, leagueId, leagueName, onPhotoUpdate, readOnly = false, formatMap = null
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const displayName = currentUser?.display_name || currentUser?.full_name || "Player";
  const handle = currentUser?.handle;
  const photoUrl = currentUser?.profile_photo_url;
  const initials = displayName.charAt(0).toUpperCase();

  const stats = useMemo(() => computeStats(myStats, games, formatMap), [myStats, games, formatMap]);
  const hotStreak = useMemo(() => getHotStreak(myStats, games, formatMap), [myStats, games, formatMap]);
  const primaryRank = useMemo(() => getPrimaryRank(playerRecord?.id, allStats, myStats, games, formatMap), [playerRecord?.id, allStats, myStats, games, formatMap]);
  const rankMovement = useMemo(() => {
    if (!primaryRank || !leagueId || !playerRecord?.id) return { change: 0, direction: 'neutral' };
    return getRankMovement(leagueId, playerRecord.id, primaryRank.rank, primaryRank.cat);
  }, [primaryRank, leagueId, playerRecord?.id]);

  // Milestone progress — CARD_FORMAT_V1
  const milestone = useMemo(() => getMilestoneProgress(myStats, games, formatMap), [myStats, games, formatMap]);

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

  // PROFILE_GOLD_V1 — five stat columns including defense
  const statTiles = [
    { label: "PPG", value: stats.ppg, highlight: true },
    { label: "RPG", value: stats.rpg },
    { label: "APG", value: stats.apg },
    { label: "SPG", value: stats.spg },
    { label: "BPG", value: stats.bpg },
  ];

  const avatarCircle = (
    <div
      className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
      style={{
        background: SURFACE,
        border: `3px solid ${GOLD_MID}`,
        boxShadow: `0 0 34px rgba(200, 164, 104, 0.30)`,
      }}
    >
      {uploading ? (
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: GOLD_MID }} />
      ) : photoUrl ? (
        <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
      ) : (
        <span className="text-4xl font-bold" style={{ color: GOLD_MID }}>{initials}</span>
      )}
    </div>
  );

  return (
    <div
      className="rounded-2xl overflow-hidden relative z-20 mb-8"
      style={{ border: `1px solid ${BORDER_GOLD}`, backgroundColor: "#0B0A08" }}
    >
      {/* PROFILE_GOLD_V1 — trophy room background with dark overlay for readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(11,10,8,0.72) 0%, rgba(11,10,8,0.90) 70%, rgba(11,10,8,0.97) 100%), url(${HERO_BG_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      />

      <div className="relative pt-6 pb-6 px-5 md:px-6">

        {/* ── 1. Identity row: stacked gold name left, headshot right ── */}
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h2
              className="text-3xl md:text-4xl font-extrabold uppercase leading-[0.95] tracking-tight"
              style={{
                backgroundImage: `linear-gradient(180deg, ${GOLD_HI} 0%, ${GOLD_MID} 50%, ${GOLD_DEEP} 100%)`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {displayName}
            </h2>

            <p className="text-sm font-semibold tracking-widest uppercase mt-2" style={{ color: WARM_WHITE }}>
              {[
                team?.name,
                playerRecord?.position,
                playerRecord?.jersey_number !== undefined ? `#${playerRecord.jersey_number}` : null,
              ].filter(Boolean).join(" · ")}
            </p>

            <div className="flex items-center gap-2 flex-wrap mt-2">
              {primaryRank && (
                <span
                  className="inline-flex items-center text-[11px] font-semibold tracking-wide px-3 py-1 rounded-full"
                  style={{ background: GOLD_MID, color: GOLD_CHIP_TEXT }}
                >
                  #{primaryRank.rank} {RANK_LABELS[primaryRank.cat] || ""}
                </span>
              )}
              {rankMovement.direction === 'up' && (
                <span className="flex items-center gap-0.5 text-xs font-bold text-green-500">
                  <TrendingUp className="w-3 h-3" /> +{rankMovement.change}
                </span>
              )}
              {rankMovement.direction === 'down' && (
                <span className="flex items-center gap-0.5 text-xs font-bold text-red-400">
                  <TrendingDown className="w-3 h-3" /> -{rankMovement.change}
                </span>
              )}
              {hotStreak >= 3 && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1 rounded-full"
                  style={{ background: "rgba(200,164,104,0.15)", color: GOLD_HI, border: `1px solid ${BORDER_GOLD}` }}
                >
                  <Flame className="w-3.5 h-3.5" /> Hot
                </span>
              )}
            </div>

            <p className="text-[11px] tracking-[0.14em] uppercase mt-2" style={{ color: WARM_MUTED }}>
              {leagueName || ""}
              {handle ? `${leagueName ? " · " : ""}@${handle}` : ""}
            </p>
          </div>

          {readOnly ? (
            avatarCircle
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative flex-shrink-0 group cursor-pointer rounded-full">
                  {avatarCircle}
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-5 h-5" style={{ color: GOLD_HI }} />
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
          )}
          {!readOnly && <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />}
        </div>

        {/* ── 2. Season stat strip: PPG · RPG · APG · SPG · BPG ── */}
        <div
          className="mt-5 rounded-xl px-1 pt-3 pb-2"
          style={{ background: "rgba(21,17,11,0.85)", border: `1px solid ${BORDER_GOLD}` }}
        >
          <div className="grid grid-cols-5">
            {statTiles.map(({ label, value, highlight }, i) => (
              <div
                key={label}
                className="text-center"
                style={i < statTiles.length - 1 ? { borderRight: `1px solid ${DIVIDER}` } : undefined}
              >
                <p className="text-lg md:text-xl font-bold leading-none" style={{ color: highlight ? GOLD_HI : WARM_WHITE }}>
                  {value ?? "—"}
                </p>
                <p className="text-[10px] tracking-[0.1em] mt-1.5" style={{ color: WARM_MUTED }}>{label}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-[10px] tracking-[0.14em] mt-2" style={{ color: WARM_MUTED }}>
            {stats.gp > 0 ? `${stats.gp} GAMES PLAYED` : "NO GAMES YET"}
          </p>
        </div>

        {/* ── 3. Milestone progress ── */}
        {milestone && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: WARM_MUTED }}>{milestone.name}</p>
              <span className="text-[11px] font-bold" style={{ color: GOLD_HI }}>{Math.round(milestone.progress)}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: DIVIDER }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(milestone.progress, 100)}%`,
                  backgroundImage: `linear-gradient(90deg, ${GOLD_DEEP} 0%, ${GOLD_MID} 60%, ${GOLD_HI} 100%)`,
                }}
              />
            </div>
            <p className="text-xs font-semibold mt-1.5" style={{ color: WARM_WHITE }}>
              {milestone.current} / {milestone.target} {milestone.unit}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
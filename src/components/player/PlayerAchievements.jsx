import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { calculatePlayerBadges } from "./badgeCalculator";
import { BADGE_DEFINITIONS } from "./badgeDefinitions";
import BadgeCard from "./BadgeCard";

// PROFILE_GOLD_V1 — trophy-room palette (matches PlayerDashboardCard / BadgeCard)
const GOLD_MID = "#C8A468";
const WARM_MUTED = "#877A63";
const CARD_BG = "#100D08";
const CARD_BORDER = "#2A2114";

const COLLAPSED_COUNT = 8;

// CARD_FORMAT_V1 — optional formatMap (gameId -> 'raw'|'count') for engine points.
export default function PlayerAchievements({ myStats, games, teamId, playerRecord, formatMap = null, allStats = null }) {
  const [showAll, setShowAll] = useState(false);

  // PROFILE_GOLD_V1 — build ALL badges: earned first (sorted by count desc), then locked.
  const { tiles, earnedCount, totalCount } = useMemo(() => {
    const badgeCounts = calculatePlayerBadges(myStats, games, formatMap, allStats); // CARD_FORMAT_V1

    const all = Object.keys(BADGE_DEFINITIONS).map((badgeKey) => ({
      badgeKey,
      count: badgeCounts[badgeKey] || 0,
      ...BADGE_DEFINITIONS[badgeKey],
    }));

    const earned = all.filter(b => b.count > 0).sort((a, b) => b.count - a.count);
    const locked = all.filter(b => b.count === 0);

    return {
      tiles: [...earned, ...locked],
      earnedCount: earned.length,
      totalCount: all.length,
    };
  }, [myStats, games, formatMap, allStats]);

  const visibleTiles = showAll ? tiles : tiles.slice(0, COLLAPSED_COUNT);

  return (
    <div
      className="rounded-2xl p-4 md:p-5"
      style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold tracking-[0.1em]" style={{ color: GOLD_MID }}>
          TROPHY CABINET
        </h3>
        <span className="text-xs font-semibold tracking-wide" style={{ color: WARM_MUTED }}>
          {earnedCount} / {totalCount} EARNED
        </span>
      </div>

      {earnedCount === 0 && (
        <p className="text-xs mb-3" style={{ color: WARM_MUTED }}>
          Play games to start earning trophies. Tap any badge to see how it&apos;s unlocked.
        </p>
      )}

      <div className="grid grid-cols-4 gap-2">
        {visibleTiles.map(badge => (
          <BadgeCard
            key={badge.badgeKey}
            badgeKey={badge.badgeKey}
            badgeName={badge.badge_name}
            badgeIcon={badge.badge_icon}
            badgeDescription={badge.badge_description}
            badgeRule={badge.badge_rule}
            count={badge.count}
            locked={badge.count === 0}
          />
        ))}
      </div>

      {tiles.length > COLLAPSED_COUNT && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-3 flex items-center gap-1 text-xs font-semibold tracking-wide mx-auto"
          style={{ color: GOLD_MID }}
        >
          {showAll ? (
            <>SHOW LESS <ChevronUp className="w-3.5 h-3.5" /></>
          ) : (
            <>VIEW ALL {totalCount} <ChevronDown className="w-3.5 h-3.5" /></>
          )}
        </button>
      )}
    </div>
  );
}
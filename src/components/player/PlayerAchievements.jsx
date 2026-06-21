import React, { useMemo } from "react";
import { calculatePlayerBadges } from "./badgeCalculator";
import { BADGE_DEFINITIONS } from "./badgeDefinitions";
import BadgeCard from "./BadgeCard";

// CARD_FORMAT_V1 — optional formatMap (gameId -> 'raw'|'count') for engine points.
export default function PlayerAchievements({ myStats, games, teamId, playerRecord, formatMap = null, allStats = null }) {
  const badges = useMemo(() => {
    const badgeCounts = calculatePlayerBadges(myStats, games, formatMap, allStats); // CARD_FORMAT_V1
    
    // Filter only unlocked badges (count > 0) and sort by count descending
    return Object.entries(badgeCounts)
      .filter(([_, count]) => count > 0)
      .sort(([keyA, countA], [keyB, countB]) => countB - countA)
      .map(([badgeKey, count]) => ({
        badgeKey,
        count,
        ...BADGE_DEFINITIONS[badgeKey],
      }));
  }, [myStats, games, formatMap, allStats]);

  if (badges.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Achievements</h3>
        <p className="text-sm text-slate-500">
          No badges unlocked yet. Play more games to earn achievements!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Achievements</h3>
      
      <div className="flex flex-wrap gap-3">
        {badges.map(badge => (
          <BadgeCard
            key={badge.badgeKey}
            badgeKey={badge.badgeKey}
            badgeName={badge.badge_name}
            badgeIcon={badge.badge_icon}
            badgeDescription={badge.badge_description}
            badgeRule={badge.badge_rule}
            count={badge.count}
          />
        ))}
      </div>
    </div>
  );
}
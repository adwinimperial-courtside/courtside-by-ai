import React, { useState, useRef, useEffect } from "react";
import {
  X, Target, Medal, Bomb, Flame, Handshake, Zap, Crown, Sparkles,
  Dumbbell, Magnet, Hand, Lock, Ban, Shield, Layers, Gem, Star, Clock, Orbit,
} from "lucide-react";

// PROFILE_GOLD_V1 — trophy-room palette (matches PlayerDashboardCard)
const GOLD_HI = "#E5C688";
const GOLD_MID = "#C8A468";
const GOLD_DEEP = "#6E5330";
const WARM_WHITE = "#EFE6D4";
const WARM_MUTED = "#877A63";
const BORDER_GOLD = "#3A2E1B";
const ICON_ON_GOLD = "#241A08";

// PROFILE_GOLD_V1 — one graphic icon per badge key (replaces emoji on this page)
const BADGE_ICONS = {
  double_digits: Target,
  twenty_club: Medal,
  thirty_bomb: Bomb,
  scoring_streak: Flame,
  facilitator: Handshake,
  playmaker: Zap,
  floor_general: Crown,
  glass_cleaner: Sparkles,
  board_beast: Dumbbell,
  rebound_machine: Magnet,
  pickpocket: Hand,
  lockdown_defender: Lock,
  shot_blocker: Ban,
  defensive_wall: Shield,
  double_double: Layers,
  triple_double: Gem,
  player_of_the_game: Star,
  clutch_performer: Clock,
  all_around_game: Orbit,
};

export default function BadgeCard({ badgeKey, badgeName, badgeIcon, badgeDescription, badgeRule, count, locked = false }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const badgeRef = useRef(null);
  const tooltipRef = useRef(null);

  const IconComp = BADGE_ICONS[badgeKey] || Target;

  // Handle hover on desktop
  const handleMouseEnter = () => {
    if (window.innerWidth >= 768) {
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    if (window.innerWidth >= 768) {
      setShowTooltip(false);
    }
  };

  // Handle tap on mobile
  const handleTap = (e) => {
    e.stopPropagation();
    if (window.innerWidth < 768) {
      setShowTooltip(!showTooltip);
    }
  };

  // Close tooltip when clicking outside on mobile
  useEffect(() => {
    if (!showTooltip || window.innerWidth >= 768) return;

    const handleClickOutside = (e) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target) &&
          tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setShowTooltip(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showTooltip]);

  // Position tooltip near badge
  useEffect(() => {
    if (showTooltip && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.bottom + 8,
        left: Math.max(8, rect.left + rect.width / 2 - 150),
      });
    }
  }, [showTooltip]);

  return (
    <>
      <button
        ref={badgeRef}
        onClick={handleTap}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="rounded-xl px-1 pt-3 pb-2 text-center transition-transform duration-150 hover:scale-[1.03] cursor-pointer w-full"
        style={
          locked
            ? { background: "#0E0D0B", border: "1px solid #242220" }
            : {
                backgroundImage: "linear-gradient(180deg, #1E170D 0%, #120E08 100%)",
                border: `1px solid ${BORDER_GOLD}`,
              }
        }
      >
        <div
          className="w-12 h-12 mx-auto rounded-full flex items-center justify-center"
          style={
            locked
              ? { backgroundImage: "radial-gradient(circle at 35% 30%, #35322D 0%, #211F1C 60%, #141311 100%)" }
              : { backgroundImage: `radial-gradient(circle at 35% 30%, ${GOLD_HI} 0%, ${GOLD_MID} 45%, ${GOLD_DEEP} 100%)` }
          }
        >
          {locked ? (
            <Lock className="w-5 h-5" style={{ color: "#5F5A52" }} />
          ) : (
            <IconComp className="w-6 h-6" style={{ color: ICON_ON_GOLD }} />
          )}
        </div>
        <p
          className="text-[10px] font-semibold tracking-wide uppercase mt-2 leading-tight"
          style={{ color: locked ? "#5F5A52" : WARM_WHITE }}
        >
          {badgeName}
        </p>
        <p className="text-[11px] font-bold mt-0.5" style={{ color: locked ? "transparent" : GOLD_MID }}>
          {locked ? "·" : `×${count}`}
        </p>
      </button>

      {/* Tooltip - Fixed Positioning */}
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="fixed rounded-xl p-4 z-50 max-w-xs"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            background: "#15110B",
            border: `1px solid ${BORDER_GOLD}`,
            boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
          }}
        >
          {/* Close button on mobile */}
          {window.innerWidth < 768 && (
            <button
              onClick={() => setShowTooltip(false)}
              className="absolute top-2 right-2 p-1 rounded-lg"
            >
              <X className="w-4 h-4" style={{ color: WARM_MUTED }} />
            </button>
          )}

          <div className="space-y-3">
            {/* Icon + Name */}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={
                  locked
                    ? { backgroundImage: "radial-gradient(circle at 35% 30%, #35322D 0%, #211F1C 60%, #141311 100%)" }
                    : { backgroundImage: `radial-gradient(circle at 35% 30%, ${GOLD_HI} 0%, ${GOLD_MID} 45%, ${GOLD_DEEP} 100%)` }
                }
              >
                <IconComp className="w-4 h-4" style={{ color: locked ? "#5F5A52" : ICON_ON_GOLD }} />
              </div>
              <h3 className="font-bold" style={{ color: WARM_WHITE }}>{badgeName}</h3>
            </div>

            {/* Description */}
            <p className="text-sm" style={{ color: "#C9BFA9" }}>{badgeDescription}</p>

            {/* Rule */}
            <div className="rounded-lg p-2" style={{ background: "#100D08", border: "1px solid #2A2114" }}>
              <p className="text-xs font-medium" style={{ color: WARM_MUTED }}>
                <span style={{ color: GOLD_MID }}>Unlock: </span>
                {badgeRule}
              </p>
            </div>

            {/* Count */}
            <p className="text-xs" style={{ color: WARM_MUTED }}>
              {locked ? (
                <span>Not earned yet</span>
              ) : (
                <>
                  <span className="font-semibold" style={{ color: GOLD_HI }}>Unlocked:</span> {count} {count === 1 ? "time" : "times"}
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
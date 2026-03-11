import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

export default function BadgeCard({ badgeKey, badgeName, badgeIcon, badgeDescription, badgeRule, count }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const badgeRef = useRef(null);
  const tooltipRef = useRef(null);

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
        className="bg-white rounded-full px-4 py-2 shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 flex items-center gap-2 cursor-pointer"
      >
        <span className="text-lg">{badgeIcon}</span>
        <span className="font-semibold text-slate-800 text-sm">{badgeName}</span>
        <span className="text-xs text-slate-500 font-medium">x{count}</span>
      </button>

      {/* Tooltip - Fixed Positioning */}
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="fixed bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 max-w-xs"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          {/* Close button on mobile */}
          {window.innerWidth < 768 && (
            <button
              onClick={() => setShowTooltip(false)}
              className="absolute top-2 right-2 p-1 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          )}

          <div className="space-y-3">
            {/* Icon + Name */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">{badgeIcon}</span>
              <h3 className="font-bold text-slate-900">{badgeName}</h3>
            </div>

            {/* Description */}
            <p className="text-sm text-slate-700">{badgeDescription}</p>

            {/* Rule */}
            <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
              <p className="text-xs text-slate-600 font-medium">
                <span className="text-slate-500">Unlock: </span>
                {badgeRule}
              </p>
            </div>

            {/* Count */}
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Unlocked:</span> {count} {count === 1 ? "time" : "times"}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
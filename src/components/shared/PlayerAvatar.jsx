import React from "react";

// PLAYER_AVATAR_V1 — single shared avatar for displaying a player anywhere in the app.
// Shows the roster photo when photo_url is set; otherwise falls back to the
// jersey-number circle (identical to the previous look). Never used inside
// the live stat tracker path.
//
// Props:
//   player    - object with optional photo_url, jersey_number, name
//   size      - diameter in pixels (default 40)
//   teamColor - background color for the jersey circle (default Courtside orange)
//   className - extra classes applied to the outer element
export default function PlayerAvatar({ player, size = 40, teamColor = "#F26B1F", className = "" }) {
  const dim = { width: size, height: size };
  const photoUrl = player?.photo_url;
  const jersey = player?.jersey_number;
  const name = player?.name || "Player";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={dim}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      style={{ ...dim, backgroundColor: teamColor, fontSize: Math.max(11, Math.round(size * 0.4)) }}
      className={`rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
      aria-label={name}
    >
      {jersey !== undefined && jersey !== null && String(jersey).trim() !== "" ? jersey : ""}
    </div>
  );
}
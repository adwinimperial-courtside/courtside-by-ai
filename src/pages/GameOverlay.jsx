import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

// This page is designed to be used as an OBS Browser Source overlay.
// It has a transparent background and shows a compact scoreboard widget.
// URL: /GameOverlay?gameId=GAME_ID

export default function GameOverlayPage() {
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get("gameId");

  const [game, setGame] = useState(null);
  const [homeTeam, setHomeTeam] = useState(null);
  const [awayTeam, setAwayTeam] = useState(null);
  const [league, setLeague] = useState(null);
  const [overlayLogo, setOverlayLogo] = useState(null);
  const [clockDisplay, setClockDisplay] = useState("0:00");
  const clockRef = useRef(null);

  useEffect(() => {
    if (!gameId) return;

    const loadData = async () => {
      const [g, settings] = await Promise.all([
        base44.entities.Game.get(gameId),
        base44.entities.OverlaySettings.list('-created_date', 1),
      ]);
      setGame(g);
      if (settings?.[0]?.logo_url) setOverlayLogo(settings[0].logo_url);

      const [ht, at, lg] = await Promise.all([
        base44.entities.Team.get(g.home_team_id),
        base44.entities.Team.get(g.away_team_id),
        base44.entities.League.get(g.league_id),
      ]);
      setHomeTeam(ht);
      setAwayTeam(at);
      setLeague(lg);
    };

    loadData();

    const unsub = base44.entities.Game.subscribe((event) => {
      if (event.id === gameId && event.type === "update") {
        setGame(event.data);
      }
    });
    return unsub;
  }, [gameId]);

  // Clock calculation
  useEffect(() => {
    if (!game) return;
    const updateClock = () => {
      if (!game.clock_running || !game.clock_started_at) {
        const secs = Math.max(0, game.clock_time_left || 0);
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        setClockDisplay(`${m}:${String(s).padStart(2, "0")}`);
        return;
      }
      const elapsed = Math.floor((Date.now() - new Date(game.clock_started_at).getTime()) / 1000);
      const secs = Math.max(0, (game.clock_time_left || 0) - elapsed);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      setClockDisplay(`${m}:${String(s).padStart(2, "0")}`);
    };
    updateClock();
    clearInterval(clockRef.current);
    if (game.clock_running) {
      clockRef.current = setInterval(updateClock, 1000);
    }
    return () => clearInterval(clockRef.current);
  }, [game]);

  if (!gameId || !game || !homeTeam || !awayTeam) {
    return <div style={{ background: "transparent" }} />;
  }

  const periodLabel = () => {
    const p = game.clock_period || 1;
    if (game.period_type === "halves") return p === 1 ? "H1" : p === 2 ? "H2" : `OT${p - 2}`;
    return p <= (game.period_count || 4) ? `Q${p}` : `OT${p - (game.period_count || 4)}`;
  };

  // Fouls: sum from home_team_fouls / away_team_fouls object keyed by period
  const getCurrentFoulPeriod = () => {
    const p = game.clock_period || 1;
    return String(p);
  };
  const foulPeriod = getCurrentFoulPeriod();
  const homeFouls = game.home_team_fouls?.[foulPeriod] || 0;
  const awayFouls = game.away_team_fouls?.[foulPeriod] || 0;

  // Timeouts: used per period from home_timeouts / away_timeouts
  const totalTimeouts = game.game_rules?.timeouts_per_period ?? game.game_rules?.timeouts_per_half ?? 3;
  const homeTimeoutsUsed = game.home_timeouts?.[foulPeriod] || 0;
  const awayTimeoutsUsed = game.away_timeouts?.[foulPeriod] || 0;
  const homeTimeoutsLeft = Math.max(0, totalTimeouts - homeTimeoutsUsed);
  const awayTimeoutsLeft = Math.max(0, totalTimeouts - awayTimeoutsUsed);

  const leagueName = league?.name?.toUpperCase() || "LEAGUE";
  const shortName = (name) => name?.substring(0, 3).toUpperCase() || "???";

  const teamDot = (color) => (
    <span
      style={{
        display: "inline-block",
        width: 18,
        height: 18,
        borderRadius: 4,
        backgroundColor: color || "#888",
        flexShrink: 0,
      }}
    />
  );

  const timeoutDots = (left, total) => {
    const dots = [];
    for (let i = 0; i < total; i++) {
      dots.push(
        <span
          key={i}
          style={{
            display: "inline-block",
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: i < left ? "#f97316" : "#444",
            marginRight: 2,
          }}
        />
      );
    }
    return dots;
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "transparent",
        pointerEvents: "none",
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      {/* Logo — top right */}
      {overlayLogo && (
        <div style={{ position: "absolute", top: 12, right: 12 }}>
          <img
            src={overlayLogo}
            alt="Overlay Logo"
            style={{ width: 72, height: 72, objectFit: "contain", borderRadius: 12 }}
          />
        </div>
      )}

      {/* Score widget — bottom right */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          background: "rgba(18, 20, 28, 0.93)",
          borderRadius: 10,
          overflow: "hidden",
          minWidth: 200,
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Header: League + Period + Clock */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "5px 10px",
            background: "rgba(30,34,50,0.95)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                background: "#e53e3e",
                color: "#fff",
                fontSize: 9,
                fontWeight: 700,
                padding: "1px 5px",
                borderRadius: 3,
                letterSpacing: 1,
              }}
            >
              LIVE
            </span>
            <span style={{ color: "#9ba3c2", fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>
              {leagueName.length > 12 ? leagueName.substring(0, 12) + "…" : leagueName}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#f97316", fontSize: 11, fontWeight: 700 }}>{periodLabel()}</span>
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{clockDisplay}</span>
          </div>
        </div>

        {/* Home Team Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "7px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {teamDot(homeTeam.color)}
            <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>
              {shortName(homeTeam.name)}
            </span>
          </div>
          <span style={{ color: "#fff", fontSize: 18, fontWeight: 800, minWidth: 28, textAlign: "right" }}>
            {game.home_score || 0}
          </span>
        </div>

        {/* Away Team Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "7px 10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {teamDot(awayTeam.color)}
            <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>
              {shortName(awayTeam.name)}
            </span>
          </div>
          <span style={{ color: "#fff", fontSize: 18, fontWeight: 800, minWidth: 28, textAlign: "right" }}>
            {game.away_score || 0}
          </span>
        </div>

        {/* Footer: Fouls + Timeouts */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "5px 10px",
            background: "rgba(30,34,50,0.95)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Home: TO left | Fouls */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {timeoutDots(homeTimeoutsLeft, Math.max(totalTimeouts, 1))}
            </div>
            <span style={{ color: "#9ba3c2", fontSize: 9 }}>F {homeFouls}</span>
          </div>
          {/* Away: Fouls | TO right */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {timeoutDots(awayTimeoutsLeft, Math.max(totalTimeouts, 1))}
            </div>
            <span style={{ color: "#9ba3c2", fontSize: 9 }}>F {awayFouls}</span>
          </div>
        </div>

        {/* Branding footer */}
        <div style={{ textAlign: "center", padding: "3px 10px", background: "rgba(18,20,28,0.98)" }}>
          <span style={{ color: "#555", fontSize: 8, letterSpacing: 1 }}>COURTSIDE BY AI</span>
        </div>
      </div>
    </div>
  );
}
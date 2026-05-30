import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

// OBS Browser Source overlay — no layout, transparent background.
// URL: /GameOverlay?gameId=GAME_ID
// OBS custom CSS: body { background: transparent !important; overflow: hidden; }

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
        base44.entities.OverlaySettings.list("-created_date", 1),
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

  // Live clock
  useEffect(() => {
    if (!game) return;
    const updateClock = () => {
      if (!game.clock_running || !game.clock_started_at) {
        const secs = Math.max(0, game.clock_time_left || 0);
        setClockDisplay(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`);
        return;
      }
      const elapsed = Math.floor((Date.now() - new Date(game.clock_started_at).getTime()) / 1000);
      const secs = Math.max(0, (game.clock_time_left || 0) - elapsed);
      setClockDisplay(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`);
    };
    updateClock();
    clearInterval(clockRef.current);
    if (game.clock_running) clockRef.current = setInterval(updateClock, 1000);
    return () => clearInterval(clockRef.current);
  }, [game]);

  if (!gameId || !game || !homeTeam || !awayTeam) {
    return <div style={{ background: "transparent", width: "100vw", height: "100vh" }} />;
  }

  const periodLabel = () => {
    const p = game.clock_period || 1;
    const total = game.period_count || 4;
    if (game.period_type === "halves") return p === 1 ? "1ST HALF" : p === 2 ? "2ND HALF" : `OT${p - 2}`;
    return p <= total ? `Q${p}` : `OT${p - total}`;
  };

  const foulPeriod = String(game.clock_period || 1);
  const totalTimeouts = game.game_rules?.timeouts_per_period ?? game.game_rules?.timeouts_per_half ?? 3;
  const homeTimeoutsUsed = game.home_timeouts?.[foulPeriod] || 0;
  const awayTimeoutsUsed = game.away_timeouts?.[foulPeriod] || 0;
  const homeTimeoutsLeft = Math.max(0, totalTimeouts - homeTimeoutsUsed);
  const awayTimeoutsLeft = Math.max(0, totalTimeouts - awayTimeoutsUsed);
  const homeFouls = game.home_team_fouls?.[foulPeriod] || 0;
  const awayFouls = game.away_team_fouls?.[foulPeriod] || 0;

  const shortName = (name) => (name || "???").substring(0, 4).toUpperCase();
  const leagueShort = (league?.name || "LEAGUE").substring(0, 20).toUpperCase();

  const TeamColorBox = ({ color }) => (
    <div style={{
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: color || "#888",
      flexShrink: 0,
    }} />
  );

  const TimeoutDots = ({ left, total }) => (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {Array.from({ length: Math.max(total, 1) }).map((_, i) => (
        <div key={i} style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: i < left ? "#f97316" : "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.25)",
        }} />
      ))}
    </div>
  );

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "transparent",
      pointerEvents: "none",
      fontFamily: "'Segoe UI', 'Arial Black', Arial, sans-serif",
    }}>

      {/* Logo — top right */}
      {overlayLogo && (
        <div style={{
          position: "absolute",
          top: 18,
          right: 18,
          filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.6))",
        }}>
          <img
            src={overlayLogo}
            alt="Logo"
            style={{ width: 100, height: 100, objectFit: "contain", borderRadius: 16 }}
          />
        </div>
      )}

      {/* Scorebug — bottom right, broadcast-style */}
      <div style={{
        position: "absolute",
        bottom: 30,
        right: 30,
        width: 460,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}>

        {/* Header bar: LIVE + League + Period + Clock */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "rgba(12, 14, 24, 0.97)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              background: "#e53e3e",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 7px",
              borderRadius: 4,
              letterSpacing: 1.5,
            }}>LIVE</div>
            <span style={{ color: "#9ba3c2", fontSize: 11, fontWeight: 600, letterSpacing: 0.8 }}>
              {leagueShort}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              color: "#f97316",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 0.5,
            }}>{periodLabel()}</span>
            <span style={{
              color: "#ffffff",
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: 1,
              fontVariantNumeric: "tabular-nums",
            }}>{clockDisplay}</span>
          </div>
        </div>

        {/* Home Team Row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "rgba(18, 20, 32, 0.97)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TeamColorBox color={homeTeam.color} />
            <span style={{
              color: "#f0f4ff",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}>{shortName(homeTeam.name)}</span>
          </div>
          <span style={{
            color: "#ffffff",
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: -1,
            fontVariantNumeric: "tabular-nums",
            minWidth: 52,
            textAlign: "right",
          }}>{game.home_score || 0}</span>
        </div>

        {/* Away Team Row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "rgba(22, 24, 38, 0.97)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TeamColorBox color={awayTeam.color} />
            <span style={{
              color: "#f0f4ff",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}>{shortName(awayTeam.name)}</span>
          </div>
          <span style={{
            color: "#ffffff",
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: -1,
            fontVariantNumeric: "tabular-nums",
            minWidth: 52,
            textAlign: "right",
          }}>{game.away_score || 0}</span>
        </div>

        {/* Footer: Timeouts + Fouls */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "rgba(12, 14, 24, 0.98)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
        }}>
          {/* Home side */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <TimeoutDots left={homeTimeoutsLeft} total={totalTimeouts} />
            <span style={{ color: "#9ba3c2", fontSize: 11, fontWeight: 600 }}>F {homeFouls}</span>
          </div>
          {/* Center divider label */}
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>
            TO · F
          </span>
          {/* Away side */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <TimeoutDots left={awayTimeoutsLeft} total={totalTimeouts} />
            <span style={{ color: "#9ba3c2", fontSize: 11, fontWeight: 600 }}>F {awayFouls}</span>
          </div>
        </div>

        {/* Branding strip */}
        <div style={{
          textAlign: "center",
          padding: "4px 10px",
          background: "rgba(8, 10, 18, 0.99)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: 2, fontWeight: 700, whiteSpace: "nowrap" }}>
            COURTSIDE&nbsp;BY&nbsp;AI
          </span>
        </div>
      </div>
    </div>
  );
}
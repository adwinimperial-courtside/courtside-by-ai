import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

// OBS Browser Source overlay — no layout, transparent background.
// URL: /GameOverlay?gameId=GAME_ID
// OBS custom CSS: body { background: transparent !important; overflow: hidden; }

export default function GameOverlayPage() {
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get("gameId");
  const userId = params.get("userId");

  const [game, setGame] = useState(null);
  const [homeTeam, setHomeTeam] = useState(null);
  const [awayTeam, setAwayTeam] = useState(null);
  const [league, setLeague] = useState(null);
  const [overlayLogo, setOverlayLogo] = useState(null);
  const [leagueLogo, setLeagueLogo] = useState(null);
  const [tickerText, setTickerText] = useState("");
  const [tickerEnabled, setTickerEnabled] = useState(false);
  const [clockDisplay, setClockDisplay] = useState("0:00");
  const clockRef = useRef(null);

  useEffect(() => {
    if (!gameId) return;
    const loadData = async () => {
      const [g, allSettings] = await Promise.all([
        base44.entities.Game.get(gameId),
        base44.entities.OverlaySettings.list("-created_date", 50),
      ]);
      setGame(g);

      // Find settings: prefer matching userId param, then fall back to league match, then first
      let settings = null;
      if (userId) {
        settings = allSettings.find(s => s.user_id === userId || s.created_by_id === userId);
      }
      if (!settings) {
        settings = allSettings.find(s => s.league_id === g.league_id);
      }
      if (!settings && allSettings.length > 0) {
        settings = allSettings[0];
      }

      if (settings?.logo_url) setOverlayLogo(settings.logo_url);
      if (settings?.league_logo_url) setLeagueLogo(settings.league_logo_url);
      if (settings?.ticker_text) setTickerText(settings.ticker_text);
      setTickerEnabled(settings?.ticker_enabled !== false && !!settings?.ticker_text);

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
      width: 16,
      height: 16,
      borderRadius: 4,
      backgroundColor: color || "#888",
      flexShrink: 0,
    }} />
  );

  const TimeoutDots = ({ left, total }) => (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: Math.max(total, 1) }).map((_, i) => (
        <div key={i} style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          backgroundColor: i < left ? "#f97316" : "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.2)",
        }} />
      ))}
    </div>
  );

  // Foul dots: up to 5 shown, filled yellow/amber when accumulated
  const MAX_FOUL_DOTS = 5;
  const FoulDots = ({ fouls }) => (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: MAX_FOUL_DOTS }).map((_, i) => (
        <div key={i} style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          backgroundColor: i < fouls ? "#facc15" : "rgba(255,255,255,0.1)",
          border: `1px solid ${i < fouls ? "#facc15" : "rgba(255,255,255,0.15)"}`,
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

      {/* League Logo — top left */}
      {leagueLogo && (
        <div style={{
          position: "absolute",
          top: 18,
          left: 18,
          filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.6))",
        }}>
          <img
            src={leagueLogo}
            alt="League Logo"
            style={{ width: 100, height: 100, objectFit: "contain", borderRadius: 16 }}
          />
        </div>
      )}

      {/* App Logo — top right */}
      {overlayLogo && (
        <div style={{
          position: "absolute",
          top: 18,
          right: 18,
          filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.6))",
        }}>
          <img
            src={overlayLogo}
            alt="App Logo"
            style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 12 }}
          />
        </div>
      )}

      {/* Ticker — bottom full width */}
      {tickerEnabled && tickerText && (
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 38,
          background: "rgba(10, 12, 22, 0.95)",
          borderTop: "2px solid #f97316",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}>
          {/* LIVE label */}
          <div style={{
            background: "#f97316",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            padding: "0 14px",
            height: "100%",
            display: "flex",
            alignItems: "center",
            letterSpacing: 1.5,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}>
            📢 TICKER
          </div>
          {/* Scrolling text */}
          <div style={{ overflow: "hidden", flex: 1, height: "100%", display: "flex", alignItems: "center" }}>
            <style>{`
              @keyframes ticker-scroll {
                0%   { transform: translateX(100%); }
                100% { transform: translateX(-100%); }
              }
            `}</style>
            <span style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: 0.5,
              animation: "ticker-scroll 20s linear infinite",
            }}>
              {tickerText}&nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp;{tickerText}
            </span>
          </div>
        </div>
      )}

      {/* Scorebug — bottom right, broadcast-style compact */}
      <div style={{
        position: "absolute",
        bottom: tickerEnabled && tickerText ? 46 : 20,
        right: 20,
        width: 280,
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.7), 0 2px 6px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>

        {/* Header bar: LIVE + Period + Clock */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 10px",
          background: "rgba(12, 14, 24, 0.98)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              background: "#e53e3e",
              color: "#fff",
              fontSize: 8,
              fontWeight: 800,
              padding: "1px 5px",
              borderRadius: 3,
              letterSpacing: 1.2,
            }}>LIVE</div>
            <span style={{ color: "#9ba3c2", fontSize: 9, fontWeight: 600, letterSpacing: 0.6, whiteSpace: "nowrap" }}>
              COURTSIDE-BY-AI
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              color: "#f97316",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.4,
            }}>{periodLabel()}</span>
            <span style={{
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: 0.5,
              fontVariantNumeric: "tabular-nums",
            }}>{clockDisplay}</span>
          </div>
        </div>

        {/* Teams + Scores */}
        <div style={{ background: "rgba(18, 20, 32, 0.98)" }}>
          {/* Home Team Row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "5px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <TeamColorBox color={homeTeam.color} />
              <span style={{
                color: "#f0f4ff",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}>{shortName(homeTeam.name)}</span>
            </div>
            <span style={{
              color: "#ffffff",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: -0.5,
              fontVariantNumeric: "tabular-nums",
              minWidth: 36,
              textAlign: "right",
            }}>{game.home_score || 0}</span>
          </div>

          {/* Away Team Row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "5px 10px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <TeamColorBox color={awayTeam.color} />
              <span style={{
                color: "#f0f4ff",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}>{shortName(awayTeam.name)}</span>
            </div>
            <span style={{
              color: "#ffffff",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: -0.5,
              fontVariantNumeric: "tabular-nums",
              minWidth: 36,
              textAlign: "right",
            }}>{game.away_score || 0}</span>
          </div>
        </div>

        {/* Footer: Timeouts + Fouls rows */}
        <div style={{
          padding: "5px 10px",
          background: "rgba(12, 14, 24, 0.98)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}>
          {/* Timeouts row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <TimeoutDots left={homeTimeoutsLeft} total={totalTimeouts} />
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, fontWeight: 700, letterSpacing: 1 }}>TIMEOUTS</span>
            <TimeoutDots left={awayTimeoutsLeft} total={totalTimeouts} />
          </div>
          {/* Fouls row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <FoulDots fouls={homeFouls} />
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, fontWeight: 700, letterSpacing: 1 }}>FOULS</span>
            <FoulDots fouls={awayFouls} />
          </div>
        </div>
      </div>
    </div>
  );
}
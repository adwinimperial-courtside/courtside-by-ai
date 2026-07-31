import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { usePlayerCardQueue, lastBasketFrom, PlayerCardStrip } from "@/components/overlay/OverlayPlayerCards";

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

  const [stats, setStats] = useState([]);
  const [players, setPlayers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [timeoutPanel, setTimeoutPanel] = useState(null);
  const [leaderPage, setLeaderPage] = useState(0);
  const prevTimeoutsRef = useRef(null);
  const debounceRef = useRef(null);
  const rosterSigRef = useRef("");
  const lastFetchRef = useRef(0);
  const timeoutHideRef = useRef(null);

  useEffect(() => {
    if (!gameId) return;
    const loadData = async () => {
      const g = await base44.entities.Game.get(gameId);
      setGame(g);

      let leagueSettings = null;
      try {
        leagueSettings = await base44.entities.OverlaySettings.filter(
          { league_id: g.league_id },
          "-created_date",
          100
        );
      } catch (err) {
        console.warn("OVERLAY_SETTINGS_SCOPE_V1 scoped fetch failed, falling back to list", err);
      }
      if (!Array.isArray(leagueSettings)) {
        const allSettings = await base44.entities.OverlaySettings.list("-created_date", 200);
        leagueSettings = allSettings.filter(s => s.league_id === g.league_id);
      }
      let settings = null;
      if (userId) {
        settings = leagueSettings.find(s => s.user_id === userId || s.created_by_id === userId);
      }
      if (!settings && leagueSettings.length > 0) {
        settings = leagueSettings[0];
      }

      const showSponsorLogo = settings?.logo_enabled !== false;
      const showLeagueLogo = settings?.league_logo_enabled !== false;
      if (showSponsorLogo && settings?.logo_url) setOverlayLogo(settings.logo_url);
      if (showLeagueLogo && settings?.league_logo_url) setLeagueLogo(settings.league_logo_url);
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
      if (showLeagueLogo && !settings?.league_logo_url && lg?.group_id) {
        try {
          const grp = await base44.entities.LeagueGroup.get(lg.group_id);
          if (grp?.logo_url) setLeagueLogo(grp.logo_url);
        } catch (err) {
          console.warn("OVERLAY_GROUP_LOGO_V1 fallback failed", err);
        }
      }
    };
    loadData();

    const unsub = base44.entities.Game.subscribe((event) => {
      if (event.id === gameId && event.type === "update") {
        setGame(event.data);
      }
    });
    return unsub;
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;

    const loadLive = async () => {
      try {
        const [st, lgs] = await Promise.all([
          base44.entities.PlayerStats.filter({ game_id: gameId }),
          base44.entities.GameLog.filter({ game_id: gameId }, "-created_date", 60),
        ]);
        setStats(st || []);
        setLogs(lgs || []);
        lastFetchRef.current = Date.now();
        const ids = (st || []).map(s => s.player_id).filter(Boolean);
        const rosterSig = ids.slice().sort().join(",");
        if (ids.length > 0 && rosterSig !== rosterSigRef.current) {
          rosterSigRef.current = rosterSig;
          const pl = await base44.entities.Player.filter({ id: { $in: ids } });
          setPlayers(pl || []);
        }
      } catch (err) {
        console.warn("OVERLAY_PANELS_V1 live fetch failed", err);
      }
    };
    loadLive();

    const queue = () => {
      clearTimeout(debounceRef.current);
      if (Date.now() - lastFetchRef.current >= 5000) {
        loadLive();
        return;
      }
      debounceRef.current = setTimeout(loadLive, 2000);
    };

    const unsubStats = base44.entities.PlayerStats.subscribe((event) => {
      if (event.data?.game_id === gameId) queue();
    });
    const unsubLogs = base44.entities.GameLog.subscribe((event) => {
      if (event.data?.game_id === gameId) queue();
    });

    return () => {
      clearTimeout(debounceRef.current);
      unsubStats();
      unsubLogs();
    };
  }, [gameId]);

  const timeoutsUsed = (obj) =>
    Object.values(obj || {}).reduce((a, b) => a + (Number(b) || 0), 0);

  useEffect(() => {
    if (!game) return;
    const homeUsed = timeoutsUsed(game.home_timeouts);
    const awayUsed = timeoutsUsed(game.away_timeouts);
    const prev = prevTimeoutsRef.current;
    prevTimeoutsRef.current = { home: homeUsed, away: awayUsed };
    if (!prev) return;
    let side = null;
    if (homeUsed > prev.home) side = "home";
    else if (awayUsed > prev.away) side = "away";
    if (!side) return;
    setTimeoutPanel({ side });
    clearTimeout(timeoutHideRef.current);
    timeoutHideRef.current = setTimeout(() => setTimeoutPanel(null), 75000);
  }, [game]);

  useEffect(() => {
    if (game?.clock_running && timeoutPanel) {
      clearTimeout(timeoutHideRef.current);
      setTimeoutPanel(null);
    }
  }, [game?.clock_running, timeoutPanel]);

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

  useEffect(() => {
    const rotate = setInterval(() => setLeaderPage(p => (p + 1) % 3), 8000);
    return () => clearInterval(rotate);
  }, []);

  const playerCard = usePlayerCardQueue({
    stats,
    players,
    game,
    homeTeam,
    awayTeam,
    timeoutPanel,
    photosEnabled: false,
  });
  const lastBasket = lastBasketFrom(logs, players);

  if (!gameId || !game || !homeTeam || !awayTeam) {
    return <div style={{ background: "transparent", width: "100vw", height: "100vh" }} />;
  }

  const periodLabel = () => {
    const p = game.clock_period || 1;
    const total = game.period_count || 4;
    if (game.period_type === "halves") return p === 1 ? "1ST HALF" : p === 2 ? "2ND HALF" : `OT${p - 2}`;
    return p <= total ? `Q${p}` : `OT${p - total}`;
  };

  const period = game.clock_period || 1;
  const periodType = game.period_type || "quarters";
  const totalPeriods = game.period_count || (periodType === "halves" ? 2 : 4);

  const getFoulKey = (p) => {
    if (p > totalPeriods) return String(p);
    if (periodType === "halves") return p === 1 ? "h1" : "h2";
    return String(p);
  };
  const foulKey = getFoulKey(period);

  const getSegment = (p) => {
    if (p > totalPeriods) return "OVERTIME";
    if (periodType === "halves") return p === 1 ? "FIRST_HALF" : "SECOND_HALF";
    return p <= 2 ? "FIRST_HALF" : "SECOND_HALF";
  };
  const segmentKey = getSegment(period);

  const getSegmentAllowance = () => {
    const configured = game.game_rules?.timeoutsPerSegment;
    if (Array.isArray(configured)) {
      const idx = period - 1;
      if (idx >= 0 && idx < configured.length) return configured[idx];
      return 1;
    }
    if (configured != null) return configured;
    if (segmentKey === "OVERTIME") return 1;
    if (segmentKey === "FIRST_HALF") return 2;
    if (periodType === "halves") return 2;
    return 3;
  };
  const segmentAllowance = getSegmentAllowance();

  const homeTimeoutsUsed = game.home_timeouts?.[segmentKey] || 0;
  const awayTimeoutsUsed = game.away_timeouts?.[segmentKey] || 0;
  const homeTimeoutsLeft = Math.max(0, segmentAllowance - homeTimeoutsUsed);
  const awayTimeoutsLeft = Math.max(0, segmentAllowance - awayTimeoutsUsed);
  const homeFouls = game.home_team_fouls?.[foulKey] || 0;
  const awayFouls = game.away_team_fouls?.[foulKey] || 0;

  const shortName = (name) => (name || "???").substring(0, 4).toUpperCase();
  const teamLabel = (t) => (t?.name || "TEAM").substring(0, 12).toUpperCase();

  const sumFor = (teamId, field) =>
    stats.filter(s => s.team_id === teamId).reduce((a, s) => a + (Number(s[field]) || 0), 0);
  const rebFor = (teamId) => sumFor(teamId, "offensive_rebounds") + sumFor(teamId, "defensive_rebounds");

  const statRows = [
    { label: "POINTS", home: game.home_score || 0, away: game.away_score || 0 },
    { label: "3-POINTERS", home: sumFor(homeTeam.id, "points_3"), away: sumFor(awayTeam.id, "points_3") },
    { label: "REBOUNDS", home: rebFor(homeTeam.id), away: rebFor(awayTeam.id) },
    { label: "ASSISTS", home: sumFor(homeTeam.id, "assists"), away: sumFor(awayTeam.id, "assists") },
    { label: "STEALS", home: sumFor(homeTeam.id, "steals"), away: sumFor(awayTeam.id, "steals") },
    { label: "BLOCKS", home: sumFor(homeTeam.id, "blocks"), away: sumFor(awayTeam.id, "blocks") },
  ];

  const computeRun = () => {
    let h = 0, a = 0, bestDiff = 0, bestH = 0, bestA = 0;
    for (const l of logs) {
      const pts = Number(l.stat_points) || 0;
      if (pts === 0) continue;
      if (l.team_id === homeTeam.id) h += pts;
      else if (l.team_id === awayTeam.id) a += pts;
      else continue;
      const diff = Math.abs(h - a);
      if (diff > bestDiff) { bestDiff = diff; bestH = h; bestA = a; }
    }
    if (bestDiff < 6) return null;
    return bestH > bestA
      ? { name: teamLabel(homeTeam), pf: bestH, pa: bestA }
      : { name: teamLabel(awayTeam), pf: bestA, pa: bestH };
  };
  const run = computeRun();

  const playerById = (id) => players.find(p => p.id === id);
  const ptsOf = (s) =>
    (Number(s.points_2) || 0) * 2 + (Number(s.points_3) || 0) * 3 + (Number(s.free_throws) || 0);
  const rebOf = (s) => (Number(s.offensive_rebounds) || 0) + (Number(s.defensive_rebounds) || 0);

  const leaderPages = [
    { title: "SCORING LEADERS", key: (s) => ptsOf(s), cols: [["PTS", ptsOf], ["REB", rebOf], ["AST", (s) => Number(s.assists) || 0]] },
    { title: "REBOUND LEADERS", key: (s) => rebOf(s), cols: [["REB", rebOf], ["PTS", ptsOf], ["BLK", (s) => Number(s.blocks) || 0]] },
    { title: "ASSIST LEADERS", key: (s) => Number(s.assists) || 0, cols: [["AST", (s) => Number(s.assists) || 0], ["PTS", ptsOf], ["STL", (s) => Number(s.steals) || 0]] },
  ];
  const activePage = leaderPages[leaderPage];
  const leaders = [...stats]
    .filter(s => s.did_play !== false)
    .sort((x, y) => activePage.key(y) - activePage.key(x))
    .slice(0, 5);

  const gameOver = game.status === "completed";
  const showTimeout = !!timeoutPanel && !gameOver;
  const showBreak = !showTimeout && !gameOver && game.period_status === "completed";
  const timeoutTeamName = timeoutPanel?.side === "home" ? teamLabel(homeTeam) : teamLabel(awayTeam);

  const TeamBadge = ({ team }) => (
    team?.logo_url ? (
      <div data-marker="OVERLAY_TEAM_LOGO_V1" style={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        backgroundColor: team?.color || "#888",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        <img
          src={team.logo_url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      </div>
    ) : (
      <div data-marker="OVERLAY_TEAM_LOGO_V1" style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        backgroundColor: team?.color || "#888",
        flexShrink: 0,
      }} />
    )
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

  const panelShell = {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: 760,
    borderRadius: 10,
    overflow: "hidden",
    background: "rgba(11, 31, 58, 0.97)",
    boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
  };

  const panelHeader = {
    background: "#F26B1F",
    padding: "9px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  const panelHeaderText = {
    color: "#4A1B0C",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 2,
  };

  const panelFooter = {
    background: "rgba(8, 10, 18, 0.9)",
    padding: "8px 20px",
    display: "flex",
    justifyContent: "space-between",
  };

  const panelFooterText = { color: "#7f8ba4", fontSize: 13, fontWeight: 600 };

  const PanelFooter = () => (
    <div style={panelFooter}>
      <span style={panelFooterText}>
        TIMEOUTS LEFT &nbsp; {shortName(homeTeam.name)} {homeTimeoutsLeft} &middot; {shortName(awayTeam.name)} {awayTimeoutsLeft}
      </span>
      <span style={panelFooterText}>
        TEAM FOULS &nbsp; {homeFouls} &middot; {awayFouls}
      </span>
    </div>
  );

  const TimeoutPanel = () => (
    <div data-marker="OVERLAY_PANELS_V1" style={panelShell}>
      <div style={panelHeader}>
        <span style={panelHeaderText}>TIMEOUT &middot; {timeoutTeamName}</span>
        <span style={{ ...panelHeaderText, letterSpacing: 1.4 }}>TEAM STATS</span>
      </div>

      {run && (
        <div style={{
          padding: "12px 20px 10px",
          textAlign: "center",
          borderBottom: "1px solid rgba(255,255,255,0.09)",
        }}>
          <span style={{ color: "#7f8ba4", fontSize: 15, fontWeight: 700, letterSpacing: 2 }}>
            {run.name} ON A{" "}
          </span>
          <span style={{ color: "#ffffff", fontSize: 30, fontWeight: 900, letterSpacing: -0.5 }}>
            {run.pf}&ndash;{run.pa} RUN
          </span>
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 200px 1fr",
        padding: "12px 26px 6px",
      }}>
        <span style={{ color: "#fff", fontSize: 19, fontWeight: 800, letterSpacing: 1.5, textAlign: "right" }}>
          {teamLabel(homeTeam)}
        </span>
        <span />
        <span style={{ color: "#fff", fontSize: 19, fontWeight: 800, letterSpacing: 1.5 }}>
          {teamLabel(awayTeam)}
        </span>
      </div>

      <div style={{ padding: "0 26px 12px" }}>
        {statRows.map((r) => {
          const homeLead = r.home > r.away;
          const awayLead = r.away > r.home;
          return (
            <div key={r.label} style={{
              display: "grid",
              gridTemplateColumns: "1fr 200px 1fr",
              alignItems: "center",
              padding: "7px 0",
              borderTop: "1px solid rgba(255,255,255,0.07)",
            }}>
              <span style={{
                color: homeLead ? "#F26B1F" : "#9aa5bd",
                fontSize: 28,
                fontWeight: 900,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}>{r.home}</span>
              <span style={{
                color: "#7f8ba4",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 1.6,
                textAlign: "center",
              }}>{r.label}</span>
              <span style={{
                color: awayLead ? "#F26B1F" : "#9aa5bd",
                fontSize: 28,
                fontWeight: 900,
                fontVariantNumeric: "tabular-nums",
              }}>{r.away}</span>
            </div>
          );
        })}
      </div>

      <PanelFooter />
    </div>
  );

  const LeaderPanel = () => (
    <div data-marker="OVERLAY_PANELS_V1" style={panelShell}>
      <div style={panelHeader}>
        <span style={panelHeaderText}>END OF {periodLabel()}</span>
        <span style={{ ...panelHeaderText, letterSpacing: 1.4 }}>
          {activePage.title} &nbsp; {leaderPage + 1}/3
        </span>
      </div>

      <div style={{ padding: "10px 26px 14px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "40px 1fr repeat(3, 78px)",
          alignItems: "center",
          padding: "6px 0",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}>
          <span />
          <span style={{ color: "#7f8ba4", fontSize: 13, fontWeight: 700, letterSpacing: 1.6 }}>PLAYER</span>
          {activePage.cols.map(([label]) => (
            <span key={label} style={{
              color: "#7f8ba4",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1.6,
              textAlign: "right",
            }}>{label}</span>
          ))}
        </div>

        {leaders.length === 0 && (
          <div style={{ color: "#7f8ba4", fontSize: 18, padding: "16px 0", textAlign: "center" }}>
            No stats recorded yet
          </div>
        )}

        {leaders.map((s, i) => {
          const p = playerById(s.player_id);
          const t = s.team_id === homeTeam.id ? homeTeam : awayTeam;
          return (
            <div key={s.id || i} style={{
              display: "grid",
              gridTemplateColumns: "40px 1fr repeat(3, 78px)",
              alignItems: "center",
              padding: "8px 0",
              borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
            }}>
              <span style={{ color: "#F26B1F", fontSize: 20, fontWeight: 900 }}>{i + 1}</span>
              <span style={{ color: "#ffffff", fontSize: 20, fontWeight: 700 }}>
                {p?.jersey_number != null && (
                  <span style={{ color: "#7f8ba4", marginRight: 10 }}>#{p.jersey_number}</span>
                )}
                {p?.name || "Player"}
                <span style={{ color: "#7f8ba4", fontSize: 15, marginLeft: 10 }}>
                  {shortName(t?.name)}
                </span>
              </span>
              {activePage.cols.map(([label, fn]) => (
                <span key={label} style={{
                  color: "#ffffff",
                  fontSize: 22,
                  fontWeight: 900,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}>{fn(s)}</span>
              ))}
            </div>
          );
        })}
      </div>

      <PanelFooter />
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

      {showTimeout && <TimeoutPanel />}
      {showBreak && <LeaderPanel />}

      <PlayerCardStrip card={playerCard} lifted={!!(tickerEnabled && tickerText)} />

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
            padding: "4px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TeamBadge team={homeTeam} />
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
            padding: "4px 10px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TeamBadge team={awayTeam} />
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
            <TimeoutDots left={homeTimeoutsLeft} total={segmentAllowance} />
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, fontWeight: 700, letterSpacing: 1 }}>TIMEOUTS</span>
            <TimeoutDots left={awayTimeoutsLeft} total={segmentAllowance} />
          </div>
          {/* Fouls row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <FoulDots fouls={homeFouls} />
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, fontWeight: 700, letterSpacing: 1 }}>FOULS</span>
            <FoulDots fouls={awayFouls} />
          </div>
          {lastBasket && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 1 }}>
              <span style={{ color: "#F26B1F", fontSize: 9, fontWeight: 800, letterSpacing: 0.8 }}>
                {"\u25B2 " + lastBasket}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
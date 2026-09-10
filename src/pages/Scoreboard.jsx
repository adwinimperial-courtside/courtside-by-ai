import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import ScoreboardDisplay from "@/components/scoreboard/ScoreboardDisplay";
import {
  SCOREBOARD_MARKER,
  TIMEOUT_SECONDS,
  buildView,
  formatCountdown,
  getPeriod,
  getSegment,
  getStoredSeconds,
} from "@/components/scoreboard/scoreboardLogic";

const HEARTBEAT_MS = 10000;
const FONT_LINKS = [
  "https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap",
  "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&display=swap",
];

const START_CSS = `
.sbx-page{position:fixed;inset:0;background:#000;overflow:hidden;cursor:default}
.sbx-stage{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform-origin:center center}
.sbx-start{position:absolute;inset:0;background:#0A1730;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:31px;text-align:center;
  color:#fff;font-family:"Big Shoulders Display","Big Shoulders","Roboto Condensed","Arial Narrow","Helvetica Neue",sans-serif;font-stretch:condensed;z-index:5;padding:0 120px}
.sbx-start .sbx-brand{font-size:36px;font-weight:900;letter-spacing:8px;color:#AFC0DC}
.sbx-start .sbx-brand b{color:#F26B1F}
.sbx-start h1{margin:0;font-size:104px;font-weight:900;line-height:1;text-transform:uppercase;letter-spacing:2px}
.sbx-start .sbx-match{font-size:50px;font-weight:800;color:#AFC0DC}
.sbx-start .sbx-warn{font-size:34px;font-weight:800;color:#FFC928;max-width:1300px}
.sbx-start .sbx-go{margin-top:19px;font-family:inherit;font-size:54px;font-weight:900;letter-spacing:2px;color:#fff;background:#F26B1F;border:0;border-radius:19px;padding:23px 96px;cursor:pointer}
.sbx-start .sbx-go:focus-visible{outline:6px solid #fff;outline-offset:6px}
.sbx-start .sbx-fine{font-size:28px;font-weight:800;color:#AFC0DC;max-width:1300px}
`;

function statusLine(game) {
  if (!game) return "";
  if (game.status === "completed") return "Final";
  if (game.status === "in_progress") return "Game in progress";
  if (game.game_date) {
    const d = new Date(game.game_date);
    if (!Number.isNaN(d.getTime())) {
      return `Starts ${d.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}`;
    }
  }
  return "Not started yet";
}

export default function ScoreboardPage() {
  const gameId = new URLSearchParams(window.location.search).get("gameId");

  const [game, setGame] = useState(null);
  const [homeTeam, setHomeTeam] = useState(null);
  const [awayTeam, setAwayTeam] = useState(null);
  const [leagueLogo, setLeagueLogo] = useState(null);
  const [loadState, setLoadState] = useState(gameId ? "loading" : "no_game");
  const [started, setStarted] = useState(false);
  const [feedLost, setFeedLost] = useState(false);
  const [timeoutInfo, setTimeoutInfo] = useState(null);
  const [scale, setScale] = useState(1);
  const [, setTick] = useState(0);

  const sourceRef = useRef("initial");
  const anchorRef = useRef({ startedAt: null, localStart: 0 });
  const prevGameRef = useRef(null);
  const failRef = useRef(0);
  const wakeRef = useRef(null);

  const acceptGame = useCallback((incoming, source) => {
    if (!incoming) return;
    sourceRef.current = source;
    setGame((prev) => {
      if (prev && prev.updated_date && incoming.updated_date && String(incoming.updated_date) < String(prev.updated_date)) {
        return prev;
      }
      return incoming;
    });
  }, []);

  useEffect(() => {
    const added = FONT_LINKS.map((href) => {
      if (document.querySelector(`link[href="${href}"]`)) return null;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.setAttribute("data-marker", "SCOREBOARD_FONTS_V1");
      document.head.appendChild(link);
      return link;
    });
    return () => added.forEach((l) => l && l.remove());
  }, []);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    if (!gameId) return undefined;
    let cancelled = false;

    const load = async () => {
      try {
        const g = await base44.entities.Game.get(gameId);
        if (cancelled) return;
        if (!g) { setLoadState("not_found"); return; }
        acceptGame(g, "initial");
        setLoadState("ready");

        const [ht, at, lg] = await Promise.all([
          base44.entities.Team.get(g.home_team_id).catch(() => null),
          base44.entities.Team.get(g.away_team_id).catch(() => null),
          base44.entities.League.get(g.league_id).catch(() => null),
        ]);
        if (cancelled) return;
        setHomeTeam(ht);
        setAwayTeam(at);

        let logo = null;
        try {
          const settings = await base44.entities.OverlaySettings.filter({ league_id: g.league_id }, "-created_date", 50);
          const withLogo = (Array.isArray(settings) ? settings : []).find(
            (s) => s.league_logo_url && s.league_logo_enabled !== false
          );
          if (withLogo) logo = withLogo.league_logo_url;
        } catch (err) {
          console.warn("SCOREBOARD_CONSOLE_V1 overlay settings lookup failed", err);
        }
        if (!logo && lg?.group_id) {
          try {
            const grp = await base44.entities.LeagueGroup.get(lg.group_id);
            if (grp?.logo_url) logo = grp.logo_url;
          } catch (err) {
            console.warn("SCOREBOARD_CONSOLE_V1 group logo lookup failed", err);
          }
        }
        if (!cancelled) setLeagueLogo(logo);
      } catch (err) {
        console.warn("SCOREBOARD_CONSOLE_V1 game load failed", err);
        if (!cancelled) setLoadState("not_found");
      }
    };
    load();

    const unsub = base44.entities.Game.subscribe((event) => {
      if (event?.id === gameId && event.type === "update" && event.data) {
        failRef.current = 0;
        setFeedLost(false);
        acceptGame(event.data, "live");
      }
    });

    return () => {
      cancelled = true;
      if (typeof unsub === "function") unsub();
    };
  }, [gameId, acceptGame]);

  useEffect(() => {
    if (!gameId) return undefined;
    const refresh = async () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) { setFeedLost(true); return; }
      try {
        const g = await base44.entities.Game.get(gameId);
        failRef.current = 0;
        setFeedLost(false);
        if (g) acceptGame(g, "poll");
      } catch (err) {
        failRef.current += 1;
        if (failRef.current >= 2) setFeedLost(true);
      }
    };
    const id = setInterval(refresh, HEARTBEAT_MS);
    const goOffline = () => setFeedLost(true);
    const goOnline = () => { failRef.current = 0; refresh(); };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      clearInterval(id);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [gameId, acceptGame]);

  useEffect(() => {
    if (!game) return;
    if (game.clock_running && game.clock_started_at) {
      if (anchorRef.current.startedAt !== game.clock_started_at) {
        let elapsedMs = Date.now() - new Date(game.clock_started_at).getTime();
        if (!Number.isFinite(elapsedMs)) elapsedMs = 0;
        if (sourceRef.current === "live" && (elapsedMs < -500 || elapsedMs > 5000)) elapsedMs = 250;
        anchorRef.current = { startedAt: game.clock_started_at, localStart: performance.now() - Math.max(0, elapsedMs) };
      }
    } else {
      anchorRef.current = { startedAt: null, localStart: 0 };
    }

    const prev = prevGameRef.current;
    prevGameRef.current = game;
    if (game.status === "completed") { setTimeoutInfo(null); return; }
    if (!prev) return;
    if (game.clock_running && !prev.clock_running) setTimeoutInfo(null);
    if (getPeriod(game) !== getPeriod(prev)) { setTimeoutInfo(null); return; }
    const segment = getSegment(game, getPeriod(game));
    ["home", "away"].forEach((side) => {
      const now = Number((game[`${side}_timeouts`] || {})[segment]) || 0;
      const before = Number((prev[`${side}_timeouts`] || {})[segment]) || 0;
      if (now > before) {
        setTimeoutInfo({ side, endsAt: performance.now() + TIMEOUT_SECONDS * 1000 });
      } else if (now < before) {
        setTimeoutInfo((t) => (t && t.side === side ? null : t));
      }
    });
  }, [game]);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((n) => (n + 1) % 1000000);
      setTimeoutInfo((t) => (t && performance.now() >= t.endsAt ? null : t));
    }, 100);
    return () => clearInterval(id);
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) wakeRef.current = await navigator.wakeLock.request("screen");
    } catch (err) {
      console.warn("SCOREBOARD_CONSOLE_V1 keep-awake not available", err);
    }
  }, []);

  useEffect(() => {
    if (!started) return undefined;
    const onVisible = () => { if (document.visibilityState === "visible") requestWakeLock(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [started, requestWakeLock]);

  useEffect(() => () => {
    try { if (wakeRef.current) wakeRef.current.release(); } catch (err) { wakeRef.current = null; }
  }, []);

  useEffect(() => {
    if (homeTeam || awayTeam) {
      document.title = `Scoreboard – ${homeTeam?.name || "Home"} vs ${awayTeam?.name || "Away"}`;
    }
  }, [homeTeam, awayTeam]);

  const goFullscreen = useCallback(() => {
    try {
      const el = document.documentElement;
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } catch (err) {
      console.warn("SCOREBOARD_CONSOLE_V1 full screen not available", err);
    }
  }, []);

  const handleStart = () => {
    setStarted(true);
    goFullscreen();
    requestWakeLock();
  };

  let timeLeft = 0;
  if (game) {
    const stored = getStoredSeconds(game);
    timeLeft = game.clock_running && anchorRef.current.startedAt
      ? Math.max(0, stored - (performance.now() - anchorRef.current.localStart) / 1000)
      : stored;
  }

  let message = null;
  if (feedLost) {
    message = { type: "delayed" };
  } else if (timeoutInfo) {
    const team = timeoutInfo.side === "home" ? homeTeam : awayTeam;
    message = {
      type: "timeout",
      team: team?.name || (timeoutInfo.side === "home" ? "Home" : "Away"),
      time: formatCountdown((timeoutInfo.endsAt - performance.now()) / 1000),
    };
  }

  const view = game ? buildView(game, timeLeft, { message }) : null;
  const showStart = !started || loadState !== "ready";

  let title = "TV scoreboard";
  let match = "";
  let warn = "";
  let fine = "Goes full screen and keeps the screen on. Score, clock, fouls and timeouts come from the stat tracker.";
  if (loadState === "no_game") {
    title = "No game selected";
    fine = "Open the scoreboard from a game on the Schedule page.";
  } else if (loadState === "not_found") {
    title = "Game not found";
    fine = "Check the link, or open the scoreboard again from the Schedule page.";
  } else if (loadState === "loading") {
    match = "Loading game…";
    fine = "";
  } else if (game) {
    match = `${homeTeam?.name || "Home"} vs ${awayTeam?.name || "Away"} · ${statusLine(game)}`;
    if (game.game_mode === "untimed") {
      warn = "This game is untimed, so no clock is shown. Change it to Timed in the game settings to show the clock.";
    }
  }

  return (
    <div className="sbx-page" data-marker={SCOREBOARD_MARKER} onDoubleClick={goFullscreen}>
      <style>{START_CSS}</style>
      <div className="sbx-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {view && <ScoreboardDisplay view={view} homeTeam={homeTeam} awayTeam={awayTeam} leagueLogo={leagueLogo} />}
        {showStart && (
          <div className="sbx-start">
            <div className="sbx-brand">POWERED BY <b>COURTSIDE BY AI</b></div>
            <h1>{title}</h1>
            {match && <div className="sbx-match">{match}</div>}
            {warn && <div className="sbx-warn">{warn}</div>}
            {loadState === "ready" && (
              <button type="button" className="sbx-go" onClick={handleStart} autoFocus>Start scoreboard</button>
            )}
            {fine && <div className="sbx-fine">{fine}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
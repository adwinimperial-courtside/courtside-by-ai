import React, { useEffect, useRef, useState } from "react";
import { appParams } from "@/lib/app-params";
import { usePlayerCardQueue } from "@/components/overlay/OverlayPlayerCards";
import { LiveOverlayLayout, fmtClock, periodLabel, teamAbbr } from "@/components/overlay/LiveOverlayPanels";

// LIVE_OVERLAY_V1 — no-login scoreboard for streaming apps. Opened at /live/<token>.
// Rendered by App.jsx BEFORE any login check. Never reads data tables: it only calls the
// getLiveOverlay backend function with the token.
// LIVE_OVERLAY_V4 — one overlay for OBS and PRISM: league logo top-left, the scoreboard bar,
// "Powered by Courtside by AI" + fixed sponsor logos (nothing rotates), and the pop-ups:
// starting five before tip-off (split wings), timeout team stats and end-of-period leaders
// (strips above the scoreboard), and player cards during play (glass card). Same trigger
// rules as the OBS overlay (GameOverlay.jsx). Each pop-up follows the league's switches.
const POLL_MS = 2000;
const TIMEOUT_MAX_MS = 75000;
const LEADER_PAGE_MS = 8000;
const NAVY = "#0B1F3A";
const INK = "#07142A";
const ORANGE = "#F26B1F";
const MUTED = "#9AAAC2";
const FONT = "'Barlow Condensed','Arial Narrow','Roboto Condensed',Arial,sans-serif";

const num = (v) => Number(v) || 0;
const ptsOf = (s) => num(s.points_2) * 2 + num(s.points_3) * 3 + num(s.free_throws);
const rebOf = (s) => num(s.offensive_rebounds) + num(s.defensive_rebounds);
const LEADER_PAGES = [
  { title: "SCORING LEADERS", label: "PTS", key: ptsOf, sub: [["REB", rebOf], ["AST", (s) => num(s.assists)]] },
  { title: "REBOUND LEADERS", label: "REB", key: rebOf, sub: [["PTS", ptsOf], ["BLK", (s) => num(s.blocks)]] },
  { title: "ASSIST LEADERS", label: "AST", key: (s) => num(s.assists), sub: [["PTS", ptsOf], ["STL", (s) => num(s.steals)]] },
];

function nameSize(name, big, mid, small) {
  const n = (name || "").length;
  return n <= 10 ? big : n <= 15 ? mid : small;
}

function Logo({ url, color, size }) {
  return url ? (
    <img src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flex: "none" }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color || ORANGE, flex: "none" }} />
  );
}

function Dots({ left, size }) {
  const n = Math.min(Math.max(left, 0), 5);
  return (
    <span style={{ display: "inline-flex", gap: `calc(${size} * 0.45)`, alignItems: "center" }}>
      {Array.from({ length: n }).map((_, i) => (
        <i key={i} style={{ width: size, height: size, borderRadius: "50%", background: ORANGE, display: "inline-block" }} />
      ))}
      {n === 0 && <span>0</span>}
    </span>
  );
}

export default function PhoneOverlay() {
  const token = decodeURIComponent((window.location.pathname.split("/")[2] || "").trim());
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);
  const [, setTick] = useState(0);
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth);
  const [timeoutSide, setTimeoutSide] = useState(null);
  const [leaderPage, setLeaderPage] = useState(0);
  const baseRef = useRef({ secs: 0, at: 0 });
  const prevUsedRef = useRef(null);
  const timeoutHideRef = useRef(null);
  const tippedRef = useRef(false);
  const wasBreakRef = useRef(false);

  useEffect(() => {
    const els = [document.documentElement, document.body, document.getElementById("root")];
    els.forEach((el) => { if (el) el.style.setProperty("background", "transparent", "important"); });
    if (!document.getElementById("cs-live-font")) {
      const link = document.createElement("link");
      link.id = "cs-live-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&display=swap";
      document.head.appendChild(link);
    }
    const onResize = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", onResize);
    const rot = setInterval(() => setLeaderPage((p) => (p + 1) % LEADER_PAGES.length), LEADER_PAGE_MS);
    return () => { window.removeEventListener("resize", onResize); clearInterval(rot); clearTimeout(timeoutHideRef.current); };
  }, []);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/apps/${appParams.appId}/functions/getLiveOverlay`, {
          method: "POST",
          credentials: "omit",
          headers: { "Content-Type": "application/json", "X-App-Id": appParams.appId },
          body: JSON.stringify({ token }),
        });
        if (stop) return;
        if (res.status === 404) { setMissing(true); return; }
        if (!res.ok) return;
        const d = await res.json();
        baseRef.current = { secs: Number(d.clock_seconds_left) || 0, at: Date.now() };
        setMissing(false);
        setData(d);
      } catch (e) { /* keep the last good numbers on a network blip */ }
    };
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setTick((t) => t + 1), 100);
    return () => { stop = true; clearInterval(poll); clearInterval(tick); };
  }, [token]);

  // Timeout pop-up: a team's used-timeouts count went up (same rule as the OBS overlay).
  // It closes when the clock restarts, or after 75 seconds at most.
  useEffect(() => {
    if (!data) return;
    const used = { home: num(data.home_timeouts_used), away: num(data.away_timeouts_used) };
    const prev = prevUsedRef.current;
    prevUsedRef.current = used;
    if (data.clock_running) {
      tippedRef.current = true;
      if (timeoutSide) { clearTimeout(timeoutHideRef.current); setTimeoutSide(null); }
      return;
    }
    if (!prev) return;
    let side = null;
    if (used.home > prev.home) side = "home";
    else if (used.away > prev.away) side = "away";
    if (!side) return;
    setTimeoutSide(side);
    clearTimeout(timeoutHideRef.current);
    timeoutHideRef.current = setTimeout(() => setTimeoutSide(null), TIMEOUT_MAX_MS);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const onBreak = !!data && data.status === "in_progress" && data.period_status === "completed";
  useEffect(() => {
    if (onBreak && !wasBreakRef.current) setLeaderPage(0);
    wasBreakRef.current = onBreak;
  }, [onBreak]);

  const stats = Array.isArray(data?.stats) ? data.stats : [];
  const players = Array.isArray(data?.players) ? data.players : [];
  const panels = data?.panels || { starters: true, timeout: true, leaders: true, cards: true };
  const card = usePlayerCardQueue({
    stats,
    players,
    game: { game_rules: data?.game_rules || {}, period_status: data?.period_status },
    homeTeam: { id: "home", name: data?.home?.name || "" },
    awayTeam: { id: "away", name: data?.away?.name || "" },
    timeoutPanel: timeoutSide,
    photosEnabled: false,
  });

  if (missing) {
    return (
      <div style={{ position: "fixed", left: 16, bottom: 16, background: "rgba(11,31,58,.9)", color: "#fff", padding: "8px 14px", borderRadius: 8, font: "600 14px system-ui" }}>
        Courtside overlay link not found. Copy a new link from the game.
      </div>
    );
  }
  if (!data) return null;

  const live = data.status === "in_progress" && data.clock_running;
  const secs = live ? baseRef.current.secs - (Date.now() - baseRef.current.at) / 1000 : baseRef.current.secs;
  const showClock = data.status === "in_progress" && data.clock_enabled !== false;
  const clockText = showClock ? fmtClock(secs) : data.status === "in_progress" ? "" : "--:--";
  const footer = Array.isArray(data.footer_sponsors) ? data.footer_sponsors : [];
  const tickerMode = data.ticker_mode || "off";
  const tickerText = tickerMode === "always" || (tickerMode === "stopped" && !live) ? data.ticker_text || "" : "";
  const bonus = (on, fs) => on ? <span style={{ background: "#EF4444", color: "#fff", padding: "0 0.4em", borderRadius: 3, fontSize: fs }}>BONUS</span> : null;

  // Compact two-line card only when the link ends with ?layout=card and the phone is upright.
  if (portrait && new URLSearchParams(window.location.search).get("layout") === "card") {
    const Row = ({ t }) => (
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: "2.4vw", padding: "1.6vw 2.6vw", background: NAVY, borderBottom: "1px solid rgba(255,255,255,.07)" }}>
        <Logo url={t.logo_url} color={t.color} size="8vw" />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: nameSize(t.name, "5.4vw", "4.6vw", "3.9vw"), textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.1 }}>{t.name}</div>
          <div style={{ color: MUTED, fontSize: "2.9vw", fontWeight: 600, letterSpacing: "0.05em", display: "flex", gap: "2vw", alignItems: "center" }}>
            <span>FOULS <b style={{ color: "#fff" }}>{t.fouls}</b></span>
            <span style={{ display: "inline-flex", gap: "1vw", alignItems: "center" }}>TO <Dots left={t.timeouts_left} size="1.7vw" /></span>
            {bonus(t.bonus, "2.6vw")}
          </div>
        </div>
        <div style={{ background: "#fff", color: INK, fontWeight: 800, fontSize: "8vw", minWidth: "14vw", textAlign: "center", borderRadius: "1vw", padding: "0.3vw 1vw", fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>{t.score}</div>
      </div>
    );
    return (
      <div data-marker="LIVE_OVERLAY_V4" style={{ position: "fixed", left: "3vw", right: "3vw", bottom: "3vw", fontFamily: FONT, borderRadius: "2.4vw", overflow: "hidden", boxShadow: "0 1vw 4vw rgba(0,0,0,.45)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto" }}>
          <div>{Row({ t: data.home })}{Row({ t: data.away })}</div>
          <div style={{ background: INK, color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 3.4vw", minWidth: "21vw" }}>
            {data.league_logo ? <img src={data.league_logo} alt="" style={{ width: "8vw", height: "8vw", objectFit: "contain", marginBottom: "1.4vw" }} /> : null}
            {clockText ? <div style={{ fontWeight: 800, fontSize: "7vw", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{clockText}</div> : null}
            <div style={{ color: ORANGE, fontWeight: 700, fontSize: "3.4vw", letterSpacing: "0.1em" }}>{periodLabel(data)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "3vw", background: "rgba(7,20,42,.95)", color: MUTED, fontSize: "2.8vw", padding: "1.4vw 2.6vw", letterSpacing: "0.05em" }}>
          <span>Powered by <b style={{ color: "#fff" }}>COURTSIDE BY AI</b></span>
          <div style={{ display: "flex", gap: "1.6vw" }}>
            {footer.map((s, i) => <img key={s.url + i} src={s.url} alt={s.name || ""} style={{ height: "6vw", width: "14vw", objectFit: "contain" }} />)}
          </div>
        </div>
      </div>
    );
  }

  // Landscape (OBS 1920x1080 and PRISM held sideways): pick at most one pop-up.
  const playerById = {};
  players.forEach((p) => { if (p?.id) playerById[p.id] = p; });
  const gameOver = data.status === "completed";
  let pop = null;

  if (timeoutSide && !gameOver && panels.timeout) {
    const ts = data.team_stats || { home: {}, away: {} };
    const row = (label, key) => ({ label, home: num(ts.home?.[key]), away: num(ts.away?.[key]) });
    pop = {
      kind: "timeout",
      calledBy: (timeoutSide === "home" ? data.home.name : data.away.name) || "",
      rows: [
        { label: "POINTS", home: num(data.home.score), away: num(data.away.score) },
        row("3-POINTERS", "three"), row("REBOUNDS", "reb"), row("ASSISTS", "ast"), row("STEALS", "stl"), row("BLOCKS", "blk"),
      ],
      run: data.run || null,
      sponsorUrl: data.timeout_sponsor || "",
    };
  } else if (onBreak && panels.leaders && stats.length > 0) {
    const pg = LEADER_PAGES[leaderPage % LEADER_PAGES.length];
    const leaders = stats
      .filter((s) => pg.key(s) > 0)
      .sort((a, b) => pg.key(b) - pg.key(a))
      .slice(0, 3)
      .map((s) => {
        const p = playerById[s.player_id] || {};
        const team = s.team_id === "home" ? data.home : data.away;
        const bits = [`#${p.jersey_number ?? ""} ${teamAbbr(team?.name)}`.trim()].concat(pg.sub.map(([l, f]) => `${f(s)} ${l}`));
        return { name: p.name || "PLAYER", value: pg.key(s), label: pg.label, sub: bits.join(" · ") };
      });
    if (leaders.length > 0) {
      pop = { kind: "leaders", title: `End of ${periodLabel(data)} · ${pg.title}`, page: leaderPage % LEADER_PAGES.length, pages: LEADER_PAGES.length, leaders, sponsorUrl: data.break_sponsor || "" };
    }
  } else if (!gameOver && panels.starters && !tippedRef.current && !data.clock_running && num(data.period) <= 1 && num(data.home.score) === 0 && num(data.away.score) === 0) {
    const five = (side) => stats
      .filter((s) => s.team_id === side && s.is_starter)
      .map((s) => ({ jersey: playerById[s.player_id]?.jersey_number ?? "", name: playerById[s.player_id]?.name || "" }))
      .filter((p) => p.name)
      .sort((a, b) => num(a.jersey) - num(b.jersey));
    const homeFive = five("home");
    const awayFive = five("away");
    if (homeFive.length > 0 || awayFive.length > 0) pop = { kind: "starters", homeFive, awayFive };
  }

  return (
    <div data-marker="LIVE_OVERLAY_V4" style={{ position: "fixed", inset: 0, containerType: "inline-size", pointerEvents: "none" }}>
      <LiveOverlayLayout d={data} clockText={clockText} pop={pop} card={panels.cards && !pop ? card : null} tickerText={tickerText} />
    </div>
  );
}
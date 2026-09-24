import React, { useEffect, useRef, useState } from "react";
import { appParams } from "@/lib/app-params";

// LIVE_OVERLAY_V1 — no-login scoreboard for phone streaming apps (PRISM Web widget).
// Opened at /live/<token>. Rendered by App.jsx BEFORE any login check. Never reads
// data tables: it only calls the getLiveOverlay backend function with the token.
// LIVE_OVERLAY_V2 — full design: landscape bottom bar, compact portrait card, team fouls,
// bonus flag, timeouts left, rotating sponsor logos, league logo and ticker.
const POLL_MS = 2000;
const SPONSOR_MS = 8000;
const NAVY = "#0B1F3A";
const INK = "#07142A";
const ORANGE = "#F26B1F";
const MUTED = "#9AAAC2";
const FONT = "'Barlow Condensed','Arial Narrow','Roboto Condensed',Arial,sans-serif";

function fmt(secs) {
  const s = Math.max(0, secs);
  if (s < 60) return s.toFixed(1);
  const whole = Math.ceil(s);
  const m = Math.floor(whole / 60);
  return `${m}:${String(whole % 60).padStart(2, "0")}`;
}

function periodLabel(d) {
  if (!d) return "";
  if (d.status === "completed") return "FINAL";
  if (d.status !== "in_progress") return "PRE-GAME";
  const max = d.period_count || (d.period_type === "halves" ? 2 : 4);
  if (d.period > max) return d.period - max === 1 ? "OT" : `OT${d.period - max}`;
  if (d.period_type === "halves") return d.period === 1 ? "1ST HALF" : "2ND HALF";
  return `Q${d.period}`;
}

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

function Sponsor({ list, index, height }) {
  if (!list || list.length === 0) return null;
  return (
    <div style={{ position: "relative", height, width: `calc(${height} * 3.2)`, flex: "none" }}>
      {list.map((u, i) => (
        <img key={u} src={u} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: i === index % list.length ? 1 : 0, transition: "opacity .6s" }} />
      ))}
    </div>
  );
}

export default function PhoneOverlay() {
  const token = decodeURIComponent((window.location.pathname.split("/")[2] || "").trim());
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);
  const [, setTick] = useState(0);
  const [sponsorIdx, setSponsorIdx] = useState(0);
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth);
  const baseRef = useRef({ secs: 0, at: 0 });

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
    const rot = setInterval(() => setSponsorIdx((i) => i + 1), SPONSOR_MS);
    return () => { window.removeEventListener("resize", onResize); clearInterval(rot); };
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
  const clockText = showClock ? fmt(secs) : data.status === "in_progress" ? "" : "--:--";
  const sponsors = Array.isArray(data.sponsors) ? data.sponsors : [];
  const bonus = (on, fs) => on ? <span style={{ background: "#EF4444", color: "#fff", padding: "0 0.4em", borderRadius: 3, fontSize: fs }}>BONUS</span> : null;

  if (portrait) {
    // Compact card for a phone held upright: two team rows, clock on the right.
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
      <div data-marker="LIVE_OVERLAY_V2" style={{ position: "fixed", left: "3vw", right: "3vw", bottom: "3vw", fontFamily: FONT, borderRadius: "2.4vw", overflow: "hidden", boxShadow: "0 1vw 4vw rgba(0,0,0,.45)" }}>
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
          <Sponsor list={sponsors} index={sponsorIdx} height="6vw" />
        </div>
        {data.ticker ? <Ticker text={data.ticker} size="3vw" /> : null}
      </div>
    );
  }

  // Landscape: full-width bar at the bottom.
  const Team = ({ t, right }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "1.2vw", flexDirection: right ? "row-reverse" : "row", padding: "0.7vw 1.4vw", background: NAVY, minWidth: 0 }}>
      <Logo url={t.logo_url} color={t.color} size="4.2vw" />
      <div style={{ minWidth: 0, textAlign: right ? "right" : "left" }}>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: nameSize(t.name, "2.9vw", "2.4vw", "2vw"), textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.05 }}>{t.name}</div>
        <div style={{ color: MUTED, fontSize: "1.3vw", fontWeight: 600, letterSpacing: "0.06em", display: "flex", gap: "1vw", alignItems: "center", justifyContent: right ? "flex-end" : "flex-start", marginTop: "0.3vw" }}>
          <span>FOULS <b style={{ color: "#fff" }}>{t.fouls}</b></span>
          <span style={{ display: "inline-flex", gap: "0.5vw", alignItems: "center" }}>TO <Dots left={t.timeouts_left} size="0.8vw" /></span>
          {bonus(t.bonus, "1.2vw")}
        </div>
      </div>
    </div>
  );
  const Score = ({ v }) => (
    <div style={{ background: "#fff", color: INK, fontWeight: 800, fontSize: "4.4vw", display: "grid", placeItems: "center", minWidth: "8vw", fontVariantNumeric: "tabular-nums" }}>{v}</div>
  );

  return (
    <div data-marker="LIVE_OVERLAY_V2" style={{ position: "fixed", left: 0, right: 0, bottom: 0, fontFamily: FONT }}>
      {data.ticker ? <div style={{ margin: "0 3vw" }}><Ticker text={data.ticker} size="1.4vw" /></div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto 1fr", margin: "0 3vw 1vw", borderRadius: "1.1vw", overflow: "hidden", boxShadow: "0 0.6vw 2vw rgba(0,0,0,.45)" }}>
        {Team({ t: data.home })}
        {Score({ v: data.home.score })}
        <div style={{ background: INK, color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0.4vw 2vw", minWidth: "12vw" }}>
          {clockText ? <div style={{ fontWeight: 800, fontSize: "3.3vw", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{clockText}</div> : null}
          <div style={{ color: ORANGE, fontWeight: 700, fontSize: "1.45vw", letterSpacing: "0.1em" }}>{periodLabel(data)}</div>
        </div>
        {Score({ v: data.away.score })}
        {Team({ t: data.away, right: true })}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2vw", background: "rgba(7,20,42,.95)", color: MUTED, fontSize: "1.35vw", padding: "0.5vw 3vw", letterSpacing: "0.05em" }}>
        <span>Powered by <b style={{ color: "#fff" }}>COURTSIDE BY AI</b></span>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5vw" }}>
          {sponsors.length > 0 ? <span style={{ textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "1.1vw" }}>Sponsored by</span> : null}
          <Sponsor list={sponsors} index={sponsorIdx} height="2.8vw" />
          {data.league_logo ? <img src={data.league_logo} alt="" style={{ height: "2.8vw", width: "2.8vw", objectFit: "contain" }} /> : null}
        </div>
      </div>
    </div>
  );
}

function Ticker({ text, size }) {
  return (
    <div style={{ overflow: "hidden", whiteSpace: "nowrap", background: ORANGE, color: "#fff", fontWeight: 700, fontSize: size, padding: "0.25em 0", letterSpacing: "0.04em" }}>
      <style>{"@keyframes cs-live-ticker{from{transform:translateX(100%)}to{transform:translateX(-100%)}}"}</style>
      <div style={{ display: "inline-block", animation: "cs-live-ticker 22s linear infinite" }}>{text}</div>
    </div>
  );
}
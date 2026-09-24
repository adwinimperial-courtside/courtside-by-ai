import React, { useEffect, useRef, useState } from "react";
import { appParams } from "@/lib/app-params";

// LIVE_OVERLAY_V1 — no-login scoreboard for phone streaming apps (PRISM Web widget).
// Opened at /live/<token>. Rendered by App.jsx BEFORE any login check. Never reads
// data tables: it only calls the getLiveOverlay backend function with the token.
const POLL_MS = 2000;

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
  const max = d.period_type === "halves" ? 2 : 4;
  if (d.period > max) return d.period - max === 1 ? "OT" : `OT${d.period - max}`;
  return d.period_type === "halves" ? `H${d.period}` : `Q${d.period}`;
}

export default function PhoneOverlay() {
  const token = decodeURIComponent((window.location.pathname.split("/")[2] || "").trim());
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);
  const [, setTick] = useState(0);
  const baseRef = useRef({ secs: 0, at: 0 });

  useEffect(() => {
    const els = [document.documentElement, document.body, document.getElementById("root")];
    els.forEach((el) => { if (el) el.style.setProperty("background", "transparent", "important"); });
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
  const Team = ({ t, right }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "1.2vw", flexDirection: right ? "row-reverse" : "row", padding: "0.8vw 1.6vw", background: "#0B1F3A", minWidth: 0 }}>
      {t.logo_url ? (
        <img src={t.logo_url} alt="" style={{ width: "4.4vw", height: "4.4vw", borderRadius: "50%", objectFit: "cover", flex: "none" }} />
      ) : (
        <div style={{ width: "4.4vw", height: "4.4vw", borderRadius: "50%", background: t.color, flex: "none" }} />
      )}
      <div style={{ color: "#fff", fontWeight: 800, fontSize: "3vw", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
    </div>
  );
  const Score = ({ v }) => (
    <div style={{ background: "#fff", color: "#07142A", fontWeight: 800, fontSize: "4.6vw", display: "grid", placeItems: "center", minWidth: "8vw", fontVariantNumeric: "tabular-nums" }}>{v}</div>
  );

  return (
    <div data-marker="LIVE_OVERLAY_V1" style={{ position: "fixed", left: 0, right: 0, bottom: 0, fontFamily: "'Barlow Condensed','Arial Narrow',Arial,sans-serif" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto 1fr", margin: "0 3vw 1.2vw", borderRadius: "1.2vw", overflow: "hidden", boxShadow: "0 0.6vw 2vw rgba(0,0,0,.45)" }}>
        <Team t={data.home} />
        <Score v={data.home.score} />
        <div style={{ background: "#07142A", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0.4vw 2vw", minWidth: "12vw" }}>
          <div style={{ fontWeight: 800, fontSize: "3.4vw", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{data.status === "in_progress" ? fmt(secs) : "--:--"}</div>
          <div style={{ color: "#F26B1F", fontWeight: 700, fontSize: "1.5vw", letterSpacing: "0.1em" }}>{periodLabel(data)}</div>
        </div>
        <Score v={data.away.score} />
        <Team t={data.away} right />
      </div>
      <div style={{ background: "rgba(7,20,42,.92)", color: "#9AAAC2", fontSize: "1.45vw", padding: "0.6vw 3vw", letterSpacing: "0.05em" }}>
        Powered by <b style={{ color: "#fff" }}>COURTSIDE BY AI</b>
      </div>
    </div>
  );
}
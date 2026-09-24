import React from "react";

// LIVE_OVERLAY_PANELS_V1 - display pieces for the one stream overlay (OBS + PRISM phone).
// Everything is sized in container units (cqw): the overlay page makes the whole screen the
// container, so 1cqw = 1% of the screen width. The overlay settings preview reuses the same
// pieces inside a small 16:9 box. These components only draw; they never load data.
export const LIVE_OVERLAY_PANELS_V1 = true;

const NAVY = "#0B1F3A";
const INK = "#07142A";
const ORANGE = "#F26B1F";
const MUTED = "#9AAAC2";
const SOFT = "#C9D4E5";
const LINE = "rgba(255,255,255,.12)";
const GLASS = "rgba(9,24,48,.62)";
const SHADOW = "0 0.12cqw 0.35cqw rgba(0,0,0,.7)";
export const OVERLAY_FONT = "'Barlow Condensed','Arial Narrow','Roboto Condensed',Arial,sans-serif";
const TONE = { orange: ORANGE, gold: "#E5B94A", amber: "#EF9F27", red: "#E24B4A" };

export function fmtClock(secs) {
  const s = Math.max(0, Number(secs) || 0);
  if (s < 60) return s.toFixed(1);
  const whole = Math.ceil(s);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function periodLabel(d) {
  if (!d) return "";
  if (d.status === "completed") return "FINAL";
  if (d.status !== "in_progress") return "PRE-GAME";
  const max = d.period_count || (d.period_type === "halves" ? 2 : 4);
  if (d.period > max) return d.period - max === 1 ? "OT" : `OT${d.period - max}`;
  if (d.period_type === "halves") return d.period === 1 ? "1ST HALF" : "2ND HALF";
  return `Q${d.period}`;
}

// "Juan Dela Cruz" -> "J. Dela Cruz"; one-word names stay as they are.
export function shortName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || "PLAYER";
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

export function teamAbbr(name) {
  return String(name || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "TM";
}

const nameSize = (name, big, mid, small) => {
  const n = (name || "").length;
  return n <= 10 ? big : n <= 15 ? mid : small;
};

export function TeamLogo({ team, size }) {
  return team?.logo_url ? (
    <img src={team.logo_url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flex: "none" }} />
  ) : (
    <span style={{ width: size, height: size, borderRadius: "50%", background: team?.color || ORANGE, flex: "none", display: "inline-block" }} />
  );
}

function Dots({ left }) {
  const n = Math.min(Math.max(Number(left) || 0, 0), 5);
  return (
    <span style={{ display: "inline-flex", gap: "0.36cqw", alignItems: "center" }}>
      {Array.from({ length: n }).map((_, i) => (
        <i key={i} style={{ width: "0.8cqw", height: "0.8cqw", borderRadius: "50%", background: ORANGE, display: "inline-block" }} />
      ))}
      {n === 0 && <span>0</span>}
    </span>
  );
}

function BarTeam({ t, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.2cqw", flexDirection: right ? "row-reverse" : "row", padding: "0.7cqw 1.4cqw", background: NAVY, minWidth: 0 }}>
      <TeamLogo team={t} size="4.2cqw" />
      <div style={{ minWidth: 0, textAlign: right ? "right" : "left" }}>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: nameSize(t.name, "2.9cqw", "2.4cqw", "2cqw"), textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.05 }}>{t.name}</div>
        <div style={{ color: MUTED, fontSize: "1.3cqw", fontWeight: 600, letterSpacing: "0.06em", display: "flex", gap: "1cqw", alignItems: "center", justifyContent: right ? "flex-end" : "flex-start", marginTop: "0.3cqw" }}>
          <span>FOULS <b style={{ color: "#fff" }}>{t.fouls}</b></span>
          <span style={{ display: "inline-flex", gap: "0.5cqw", alignItems: "center" }}>TO <Dots left={t.timeouts_left} /></span>
          {t.bonus ? <span style={{ background: "#EF4444", color: "#fff", padding: "0 0.4em", borderRadius: 3, fontSize: "1.2cqw" }}>BONUS</span> : null}
        </div>
      </div>
    </div>
  );
}

// The scoreboard bar (same look as the phone overlay shipped in LIVE_OVERLAY_V2).
export function ScoreBar({ d, clockText }) {
  const score = (v) => (
    <div style={{ background: "#fff", color: INK, fontWeight: 800, fontSize: "4.4cqw", display: "grid", placeItems: "center", minWidth: "8cqw", fontVariantNumeric: "tabular-nums" }}>{v}</div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto 1fr", margin: "0 3cqw 1cqw", borderRadius: "1.1cqw", overflow: "hidden", boxShadow: "0 0.6cqw 2cqw rgba(0,0,0,.45)", flex: "none" }}>
      <BarTeam t={d.home} />
      {score(d.home.score)}
      <div style={{ background: INK, color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0.4cqw 2cqw", minWidth: "12cqw" }}>
        {clockText ? <div style={{ fontWeight: 800, fontSize: "3.3cqw", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{clockText}</div> : null}
        <div style={{ color: ORANGE, fontWeight: 700, fontSize: "1.45cqw", letterSpacing: "0.1em" }}>{periodLabel(d)}</div>
      </div>
      {score(d.away.score)}
      <BarTeam t={d.away} right />
    </div>
  );
}

// Footer: "Powered by Courtside by AI" always, plus up to 4 fixed sponsor logos (never rotate).
export function OverlayFooter({ sponsors }) {
  const list = (Array.isArray(sponsors) ? sponsors : []).slice(0, 4);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2cqw", background: "rgba(7,20,42,.95)", color: MUTED, fontSize: "1.35cqw", padding: "0.5cqw 3cqw", letterSpacing: "0.05em", flex: "none" }}>
      <span>Powered by <b style={{ color: "#fff" }}>COURTSIDE BY AI</b></span>
      {list.length > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.8cqw" }}>
          <span style={{ textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "1.1cqw", marginRight: "0.7cqw" }}>Sponsored by</span>
          {list.map((s, i) => (
            <img key={s.url + i} src={s.url} alt={s.name || ""} style={{ height: "2.6cqw", width: "8.4cqw", objectFit: "contain" }} />
          ))}
        </div>
      ) : <span />}
    </div>
  );
}

export function OverlayTicker({ text }) {
  if (!text) return null;
  return (
    <div style={{ overflow: "hidden", whiteSpace: "nowrap", background: ORANGE, color: "#fff", fontWeight: 700, fontSize: "1.4cqw", padding: "0.25em 0", letterSpacing: "0.04em", margin: "0 3cqw", borderRadius: "0.5cqw 0.5cqw 0 0", flex: "none" }}>
      <style>{"@keyframes cs-live-ticker{from{transform:translateX(100%)}to{transform:translateX(-100%)}}"}</style>
      <div style={{ display: "inline-block", animation: "cs-live-ticker 22s linear infinite" }}>{text}</div>
    </div>
  );
}

export function LeagueCorner({ url }) {
  if (!url) return null;
  return (
    <img src={url} alt="" style={{ position: "absolute", top: "2cqw", left: "3cqw", width: "6.2cqw", height: "6.2cqw", objectFit: "contain", zIndex: 3, filter: "drop-shadow(0 0.4cqw 1cqw rgba(0,0,0,.5))" }} />
  );
}

function Presented({ url }) {
  if (!url) return null;
  return (
    <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "0.8cqw", color: SOFT, fontSize: "1.15cqw", letterSpacing: "0.14em" }}>
      PRESENTED BY <img src={url} alt="" style={{ height: "2.1cqw", width: "6.8cqw", objectFit: "contain" }} />
    </span>
  );
}

function StripHeader({ title, url }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "2cqw", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "1.5cqw", marginBottom: "0.6cqw" }}>
      <span>{title}</span>
      <Presented url={url} />
    </div>
  );
}

const stripBox = {
  position: "absolute", left: "3cqw", right: "3cqw", bottom: 0, padding: "1cqw 1.8cqw",
  background: "linear-gradient(0deg, rgba(9,24,48,.82), rgba(9,24,48,.5))",
  borderRadius: "1cqw 1cqw 0 0", border: `1px solid ${LINE}`, borderBottom: 0,
  color: "#fff", textShadow: SHADOW,
};

// Design D - starting five on the left and right edges, fading toward the middle.
export function StartersWings({ home, away, homeFive, awayFive }) {
  const wing = (team, five, right) => (
    <div style={{
      // LIVE_OVERLAY_V5 - start below the league logo so wide phone screens never overlap it
      position: "absolute", top: "9.5cqw", width: "25cqw", padding: "1.4cqw 2cqw",
      [right ? "right" : "left"]: 0, [right ? "paddingRight" : "paddingLeft"]: "3cqw", textAlign: right ? "right" : "left",
      background: `linear-gradient(${right ? 270 : 90}deg, rgba(9,24,48,.8) 0%, rgba(9,24,48,.6) 65%, rgba(9,24,48,0) 100%)`,
      color: "#fff", textShadow: SHADOW,
    }}>
      <div style={{ color: ORANGE, fontWeight: 800, fontSize: "1.3cqw", letterSpacing: "0.16em" }}>STARTING FIVE</div>
      <div style={{ margin: "0.2cqw 0 0.6cqw", display: "flex", alignItems: "center", gap: "0.7cqw", fontSize: "2cqw", fontWeight: 800, textTransform: "uppercase", flexDirection: right ? "row-reverse" : "row" }}>
        <TeamLogo team={team} size="2.6cqw" />
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{team.name}</span>
      </div>
      {five.slice(0, 5).map((p, i) => (
        <div key={i} style={{ display: "flex", gap: "1cqw", alignItems: "baseline", flexDirection: right ? "row-reverse" : "row", fontWeight: 700, fontSize: "1.8cqw", borderTop: `1px solid ${LINE}`, paddingTop: "0.2cqw" }}>
          <b style={{ color: ORANGE, fontVariantNumeric: "tabular-nums", minWidth: "2.6cqw", textAlign: right ? "left" : "right" }}>{p.jersey}</b>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortName(p.name)}</span>
        </div>
      ))}
    </div>
  );
  return (
    <>
      {homeFive.length > 0 ? wing(home, homeFive, false) : null}
      {awayFive.length > 0 ? wing(away, awayFive, true) : null}
    </>
  );
}

// Design C - timeout team stats strip sitting on top of the scoreboard.
export function TimeoutStrip({ home, away, calledBy, rows, run, sponsorUrl }) {
  const cols = rows.length;
  const hi = { color: ORANGE };
  const runTeam = run ? (run.side === "home" ? home : away) : null;
  return (
    <div style={stripBox}>
      <StripHeader title={`Timeout${calledBy ? " · " + calledBy : ""}`} url={sponsorUrl} />
      <div style={{ display: "grid", gridTemplateColumns: `13cqw repeat(${cols}, 1fr)${run ? " 16cqw" : ""}`, gap: "0.25cqw 1cqw", alignItems: "center", fontVariantNumeric: "tabular-nums" }}>
        <div />
        {rows.map((r) => <div key={r.label} style={{ color: SOFT, fontWeight: 700, fontSize: "1.2cqw", letterSpacing: "0.1em", textAlign: "center" }}>{r.label}</div>)}
        {run ? <div /> : null}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6cqw", fontWeight: 800, fontSize: "1.6cqw" }}><TeamLogo team={home} size="2.4cqw" />{teamAbbr(home.name)}</div>
        {rows.map((r) => <div key={r.label} style={{ fontWeight: 800, fontSize: "2.1cqw", textAlign: "center", ...(r.home > r.away ? hi : {}) }}>{r.home}</div>)}
        {run ? (
          <div style={{ gridRow: "2 / span 2", gridColumn: cols + 2, alignSelf: "stretch", display: "grid", placeItems: "center", textAlign: "center", borderLeft: `1px solid ${LINE}`, color: ORANGE, fontWeight: 800, fontSize: "1.6cqw", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {runTeam.name} on a {run.pf}–{run.pa} run
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6cqw", fontWeight: 800, fontSize: "1.6cqw" }}><TeamLogo team={away} size="2.4cqw" />{teamAbbr(away.name)}</div>
        {rows.map((r) => <div key={r.label} style={{ fontWeight: 800, fontSize: "2.1cqw", textAlign: "center", ...(r.away > r.home ? hi : {}) }}>{r.away}</div>)}
      </div>
    </div>
  );
}

// Design C - end-of-period leaders strip (top 3), one page at a time.
export function LeadersStrip({ title, page, pages, leaders, sponsorUrl }) {
  return (
    <div style={stripBox}>
      <StripHeader title={title} url={sponsorUrl} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.4cqw", fontVariantNumeric: "tabular-nums" }}>
        {leaders.slice(0, 3).map((p, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "0.2cqw 1cqw", alignItems: "center", borderLeft: `0.25cqw solid ${ORANGE}`, paddingLeft: "1cqw" }}>
            <span style={{ color: ORANGE, fontWeight: 800, fontSize: "2.2cqw", gridRow: "span 2" }}>{i + 1}</span>
            <span style={{ fontWeight: 800, fontSize: "1.9cqw", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortName(p.name)}</span>
            <span style={{ fontWeight: 800, fontSize: "3cqw", gridRow: "span 2" }}>{p.value}<small style={{ fontSize: "1.2cqw", color: ORANGE, marginLeft: "0.3cqw", letterSpacing: "0.1em" }}>{p.label}</small></span>
            <span style={{ color: SOFT, fontWeight: 700, fontSize: "1.25cqw", letterSpacing: "0.06em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.sub}</span>
          </div>
        ))}
      </div>
      {pages > 1 ? (
        <div style={{ display: "flex", justifyContent: "center", gap: "0.6cqw", marginTop: "0.7cqw" }}>
          {Array.from({ length: pages }).map((_, i) => (
            <i key={i} style={{ width: "0.7cqw", height: "0.7cqw", borderRadius: "50%", background: i === page ? ORANGE : "rgba(255,255,255,.3)", display: "inline-block" }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Design A - see-through player card, bottom-left above the scoreboard.
// `card` is what usePlayerCardQueue (OverlayPlayerCards.jsx) returns.
export function GlassPlayerCard({ card }) {
  if (!card) return null;
  const tone = TONE[card.tone] || ORANGE;
  const isDD = card.type === "double_double";
  const big = isDD ? `${card.ddPts}/${card.ddReb}` : card.value == null ? "3PT" : card.value;
  const label = isDD ? "DOUBLE-DOUBLE" : [card.label, card.sub].filter(Boolean).join(" · ");
  return (
    <div data-marker="LIVE_OVERLAY_PANELS_V1" style={{ position: "absolute", left: "3cqw", bottom: "1.8cqw", display: "flex", alignItems: "stretch", borderRadius: "0.8cqw", overflow: "hidden", background: GLASS, border: "1px solid rgba(255,255,255,.16)", color: "#fff", textShadow: SHADOW, maxWidth: "46cqw" }}>
      <div style={{ background: tone, color: "#1A1206", textShadow: "none", fontWeight: 800, fontSize: "3cqw", display: "grid", placeItems: "center", padding: "0 1.4cqw", fontVariantNumeric: "tabular-nums" }}>{big}</div>
      <div style={{ padding: "0.5cqw 1.6cqw 0.6cqw", minWidth: 0 }}>
        <b style={{ display: "block", fontSize: "2.2cqw", fontWeight: 800, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {card.jersey != null && card.jersey !== "" ? `#${card.jersey} ` : ""}{card.name}
        </b>
        <span style={{ color: tone, fontSize: "1.4cqw", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label || card.team}</span>
      </div>
    </div>
  );
}

// The whole landscape overlay. `pop` = { kind: 'starters' | 'timeout' | 'leaders', ...props } or null.
export function LiveOverlayLayout({ d, clockText, pop, card, tickerText }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", fontFamily: OVERLAY_FONT, lineHeight: 1.15 }}>
      <LeagueCorner url={d.league_logo} />
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {pop?.kind === "starters" ? <StartersWings {...pop} home={d.home} away={d.away} /> : null}
        {pop?.kind === "timeout" ? <TimeoutStrip {...pop} home={d.home} away={d.away} /> : null}
        {pop?.kind === "leaders" ? <LeadersStrip {...pop} /> : null}
        {!pop ? <GlassPlayerCard card={card} /> : null}
      </div>
      <OverlayTicker text={tickerText} />
      <ScoreBar d={d} clockText={clockText} />
      <OverlayFooter sponsors={d.footer_sponsors} />
    </div>
  );
}
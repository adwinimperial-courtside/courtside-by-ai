import React, { useState, useEffect, useRef } from "react";

export const PLAYER_CARDS_VERSION = "OVERLAY_PLAYER_CARDS_V1";

const NAVY = "#0B1F3A";
const ORANGE = "#F26B1F";
const GOLD = "#E9B949";
const AMBER = "#EF9F27";
const RED = "#E24B4A";
const MUTED = "#7f8ba4";

const CARD_MS_NORMAL = 6000;
const CARD_MS_GOLD = 8000;
const COOLDOWN_MS = 30000;
const MAX_QUEUE_AGE_MS = 45000;
const PHOTO_COVERAGE_MIN = 0.8;

const POINTS_STEP = 10;
const REB_STEP = 5;
const AST_STEP = 5;

const PRIORITY = {
  fouled_out: 1,
  double_double: 2,
  points: 3,
  rebounds: 4,
  assists: 5,
  three: 6,
  foul_trouble: 7,
};

const num = (v) => Number(v) || 0;
const totalPoints = (s) => num(s.points_2) * 2 + num(s.points_3) * 3 + num(s.free_throws);
const totalReb = (s) => num(s.offensive_rebounds) + num(s.defensive_rebounds);
const stepLevel = (value, step) => (value >= step ? Math.floor(value / step) * step : 0);

const ddCount = (s) => {
  let n = 0;
  if (totalPoints(s) >= 10) n += 1;
  if (totalReb(s) >= 10) n += 1;
  if (num(s.assists) >= 10) n += 1;
  if (num(s.steals) >= 10) n += 1;
  if (num(s.blocks) >= 10) n += 1;
  return n;
};

const toneFor = (type, level) => {
  if (type === "fouled_out") return "red";
  if (type === "foul_trouble") return "amber";
  if (type === "double_double") return "gold";
  if (type === "points") return level >= 30 ? "gold" : "orange";
  if (type === "rebounds" || type === "assists") return level >= 10 ? "gold" : "orange";
  return "orange";
};

const TONES = {
  orange: { accent: ORANGE, ring: ORANGE, ringBg: "#152b4d", sub: MUTED, subLabel: MUTED },
  gold: { accent: GOLD, ring: GOLD, ringBg: "#3a2f10", sub: GOLD, subLabel: "#8a7a48" },
  amber: { accent: AMBER, ring: AMBER, ringBg: "#3a2a10", sub: AMBER, subLabel: "#8a7248" },
  red: { accent: RED, ring: RED, ringBg: "#3a1414", sub: RED, subLabel: "#8a5048" },
};

export function usePlayerCardQueue({ stats, players, game, homeTeam, awayTeam, timeoutPanel, photosEnabled }) {
  const [card, setCard] = useState(null);
  const queueRef = useRef([]);
  const firedRef = useRef(new Set());
  const prevRef = useRef(null);
  const seededRef = useRef(false);
  const lastEndRef = useRef(0);
  const preloadedRef = useRef(new Set());
  const hideRef = useRef(null);

  const suppressed = !!timeoutPanel || game?.period_status === "completed";
  const foulLimit = game?.game_rules?.personalFoulLimit ?? 5;

  const playerById = {};
  (players || []).forEach((p) => { if (p?.id) playerById[p.id] = p; });

  let photoMode = false;
  if (photosEnabled) {
    const rows = (stats || []).filter((s) => s.did_play !== false);
    const withPhoto = rows.filter((s) => !!playerById[s.player_id]?.photo_url).length;
    photoMode = rows.length > 0 && withPhoto / rows.length >= PHOTO_COVERAGE_MIN;
  }

  useEffect(() => {
    (players || []).forEach((p) => {
      const url = p?.photo_url;
      if (url && !preloadedRef.current.has(url)) {
        preloadedRef.current.add(url);
        const img = new Image();
        img.src = url;
      }
    });
  }, [players]);

  useEffect(() => {
    if (!stats || stats.length === 0) return;

    const snapshot = {};
    stats.forEach((s) => {
      if (!s.player_id) return;
      snapshot[s.player_id] = {
        pts: totalPoints(s),
        reb: totalReb(s),
        ast: num(s.assists),
        threes: num(s.points_3),
        fouls: num(s.fouls),
        dd: ddCount(s),
        teamId: s.team_id,
      };
    });

    const mark = (key) => firedRef.current.add(key);

    if (!seededRef.current) {
      Object.entries(snapshot).forEach(([pid, v]) => {
        const p = stepLevel(v.pts, POINTS_STEP);
        if (p > 0) mark(pid + ":points:" + p);
        const r = stepLevel(v.reb, REB_STEP);
        if (r > 0) mark(pid + ":rebounds:" + r);
        const a = stepLevel(v.ast, AST_STEP);
        if (a > 0) mark(pid + ":assists:" + a);
        for (let i = 1; i <= v.threes; i++) mark(pid + ":three:" + i);
        if (v.fouls >= foulLimit - 1) mark(pid + ":foul_trouble:1");
        if (v.fouls >= foulLimit) mark(pid + ":fouled_out:1");
        if (v.dd >= 2) mark(pid + ":double_double:1");
      });
      prevRef.current = snapshot;
      seededRef.current = true;
      return;
    }

    const prev = prevRef.current || {};
    const now = Date.now();
    const fresh = [];

    Object.entries(snapshot).forEach(([pid, v]) => {
      const before = prev[pid] || { pts: 0, reb: 0, ast: 0, threes: 0, fouls: 0, dd: 0 };
      const mine = [];

      const push = (type, level, value, label, sub, extra) => {
        const key = pid + ":" + type + ":" + level;
        if (firedRef.current.has(key)) return;
        firedRef.current.add(key);
        mine.push({
          id: key,
          playerId: pid,
          teamId: v.teamId,
          type,
          level,
          value,
          label,
          sub,
          tone: toneFor(type, level),
          at: now,
          ...(extra || {}),
        });
      };

      if (v.fouls >= foulLimit && before.fouls < foulLimit) {
        push("fouled_out", 1, v.fouls, "FOULS",
          "FOULED OUT \u00B7 " + v.pts + " PTS " + v.reb + " REB");
      } else if (v.fouls >= foulLimit - 1 && before.fouls < foulLimit - 1) {
        push("foul_trouble", 1, v.fouls, "FOULS", "ONE AWAY FROM FOULING OUT");
      }

      if (v.dd >= 2 && before.dd < 2) {
        push("double_double", 1, null, null, "DOUBLE-DOUBLE", { ddPts: v.pts, ddReb: v.reb });
      }

      const pLevel = stepLevel(v.pts, POINTS_STEP);
      if (pLevel > 0 && pLevel > stepLevel(before.pts, POINTS_STEP)) {
        push("points", pLevel, pLevel, "POINTS", pLevel >= 30 ? "CAREER NIGHT" : null);
      }

      const rLevel = stepLevel(v.reb, REB_STEP);
      if (rLevel > 0 && rLevel > stepLevel(before.reb, REB_STEP)) {
        push("rebounds", rLevel, rLevel, "REBOUNDS", null);
      }

      const aLevel = stepLevel(v.ast, AST_STEP);
      if (aLevel > 0 && aLevel > stepLevel(before.ast, AST_STEP)) {
        push("assists", aLevel, aLevel, "ASSISTS", null);
      }

      if (v.threes > before.threes) {
        push("three", v.threes, null, "MADE",
          v.threes + (v.threes === 1 ? " THREE" : " TONIGHT") + " \u00B7 " + v.pts + " PTS");
      }

      const hasDD = mine.some((c) => c.type === "double_double");
      const keep = hasDD
        ? mine.filter((c) => !["points", "rebounds", "assists"].includes(c.type))
        : mine;
      keep.forEach((c) => fresh.push(c));
    });

    prevRef.current = snapshot;
    if (fresh.length > 0) queueRef.current = queueRef.current.concat(fresh);
  }, [stats, foulLimit]);

  const latestRef = useRef({});
  latestRef.current = { card, suppressed, playerById, homeTeam, awayTeam, photoMode };

  useEffect(() => {
    const tick = setInterval(() => {
      const L = latestRef.current;
      if (L.card || L.suppressed) return;
      const now = Date.now();
      if (now - lastEndRef.current < COOLDOWN_MS) return;

      queueRef.current = queueRef.current.filter((c) => now - c.at < MAX_QUEUE_AGE_MS);
      if (queueRef.current.length === 0) return;

      queueRef.current.sort((a, b) => (PRIORITY[a.type] || 9) - (PRIORITY[b.type] || 9) || a.at - b.at);
      const next = queueRef.current.shift();

      const player = L.playerById[next.playerId];
      const team =
        next.teamId === L.homeTeam?.id ? L.homeTeam : next.teamId === L.awayTeam?.id ? L.awayTeam : null;

      setCard({
        ...next,
        name: (player?.name || "PLAYER").toUpperCase(),
        jersey: player?.jersey_number,
        photo: L.photoMode ? player?.photo_url || null : null,
        team: (team?.name || "").toUpperCase(),
      });

      const hold = next.tone === "gold" ? CARD_MS_GOLD : CARD_MS_NORMAL;
      clearTimeout(hideRef.current);
      hideRef.current = setTimeout(() => {
        lastEndRef.current = Date.now();
        setCard(null);
      }, hold);
    }, 500);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (suppressed && card) {
      clearTimeout(hideRef.current);
      lastEndRef.current = Date.now();
      setCard(null);
    }
  }, [suppressed, card]);

  useEffect(() => () => clearTimeout(hideRef.current), []);

  return card;
}

export function lastBasketFrom(logs, players) {
  const hit = (logs || []).find((l) => Number(l.stat_points) > 0);
  if (!hit) return null;
  const p = (players || []).find((x) => x.id === hit.player_id);
  const surname = (p?.name || "").trim().split(/\s+/).pop();
  if (!surname) return null;
  return surname.toUpperCase() + " " + Number(hit.stat_points);
}

export function PlayerCardStrip({ card, lifted }) {
  if (!card) return null;
  const tone = TONES[card.tone] || TONES.orange;
  const isDD = card.type === "double_double";

  return (
    <div
      data-marker="OVERLAY_PLAYER_CARDS_V1"
      style={{
        position: "absolute",
        bottom: lifted ? 46 : 20,
        left: 20,
        width: 520,
        background: NAVY,
        borderRadius: 10,
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
        boxShadow: "0 6px 28px rgba(0,0,0,0.55)",
      }}
    >
      <div style={{ width: 6, background: tone.accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", flex: 1, minWidth: 0 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: tone.ringBg,
            border: "2px solid " + tone.ring,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {card.photo ? (
            <img src={card.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 19, fontWeight: 900, color: "#fff" }}>
              {card.jersey != null ? card.jersey : "\u2013"}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 19,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: 0.5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {card.name}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: tone.sub, letterSpacing: 1.2 }}>
            {card.sub || card.team}
          </div>
        </div>

        {isDD ? (
          <div style={{ display: "flex", gap: 20, textAlign: "right", flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, color: tone.accent, lineHeight: 1 }}>{card.ddPts}</div>
              <div style={{ fontSize: 9, fontWeight: 800, color: tone.subLabel, letterSpacing: 1.4 }}>PTS</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, color: tone.accent, lineHeight: 1 }}>{card.ddReb}</div>
              <div style={{ fontSize: 9, fontWeight: 800, color: tone.subLabel, letterSpacing: 1.4 }}>REB</div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: card.value == null ? 26 : 30, fontWeight: 900, color: tone.accent, lineHeight: 1 }}>
              {card.value == null ? "3PT" : card.value}
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, color: tone.subLabel, letterSpacing: 1.6 }}>{card.label}</div>
          </div>
        )}
      </div>
    </div>
  );
}
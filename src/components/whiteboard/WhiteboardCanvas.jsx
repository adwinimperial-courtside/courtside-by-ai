import React, { useRef, useState, useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, X } from "lucide-react";

// ─── Court ratios ─────────────────────────────────────────────────────────────
const HALF_COURT = "half";
const FULL_COURT = "full";
const HALF_COURT_RATIO = 564 / 470; // height / width  (portrait)
const FULL_COURT_RATIO = 500 / 940; // height / width  (landscape)

// ─── Default positions ────────────────────────────────────────────────────────
// Half court: basket at TOP, offense attacks upward from bottom
const DEFAULT_OFFENSIVE_HALF = [
  { id: "o1", label: "1", x: 0.50, y: 0.72 }, // point guard, top of key
  { id: "o2", label: "2", x: 0.18, y: 0.60 }, // shooting guard, left wing
  { id: "o3", label: "3", x: 0.82, y: 0.60 }, // small forward, right wing
  { id: "o4", label: "4", x: 0.28, y: 0.45 }, // power forward, left elbow
  { id: "o5", label: "5", x: 0.72, y: 0.45 }, // center, right elbow
];
const DEFAULT_DEFENSIVE_HALF = [
  { id: "d1", label: "1", x: 0.10, y: 0.92 },
  { id: "d2", label: "2", x: 0.28, y: 0.92 },
  { id: "d3", label: "3", x: 0.50, y: 0.92 },
  { id: "d4", label: "4", x: 0.72, y: 0.92 },
  { id: "d5", label: "5", x: 0.90, y: 0.92 },
];

// Full court landscape: x=horizontal(long axis), y=vertical(short axis)
// Offense: left half, vertical stack near left sideline, order top→bottom: 2,4,1,5,3
const DEFAULT_OFFENSIVE_FULL = [
  { id: "o2", label: "2", x: 0.10, y: 0.10 },
  { id: "o4", label: "4", x: 0.10, y: 0.30 },
  { id: "o1", label: "1", x: 0.10, y: 0.50 },
  { id: "o5", label: "5", x: 0.10, y: 0.70 },
  { id: "o3", label: "3", x: 0.10, y: 0.90 },
];
// Defense: right half, vertical stack near right sideline, order top→bottom: 4,2,1,3,5
const DEFAULT_DEFENSIVE_FULL = [
  { id: "d4", label: "4", x: 0.90, y: 0.10 },
  { id: "d2", label: "2", x: 0.90, y: 0.30 },
  { id: "d1", label: "1", x: 0.90, y: 0.50 },
  { id: "d3", label: "3", x: 0.90, y: 0.70 },
  { id: "d5", label: "5", x: 0.90, y: 0.90 },
];

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
function markerR(courtW, isFullCourt = false) {
  if (isFullCourt) return Math.max(10, Math.round(courtW * 0.028));
  return Math.max(16, Math.round(courtW * 0.046));
}

// ─── Brand palette ─────────────────────────────────────────────────────────────
const C = {
  courtBg:   "#f1f5f9",
  paintFill: "#e2e8f0",
  line:      "#94a3b8",
  lineW:     1.5,
  basket:    "#64748b",
  offense:   "#7c3aed",
  defense:   "#ef4444",
};

// ─── Court SVGs ───────────────────────────────────────────────────────────────
function HalfCourtSVG({ width, height }) {
  const w = width, h = height, cx = w / 2;
  const lw = C.lineW;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <rect width={w} height={h} fill={C.courtBg} rx={6} />
      <rect x={lw} y={lw} width={w-lw*2} height={h-lw*2} fill="none" stroke={C.line} strokeWidth={lw} rx={4} />
      <line x1={0} y1={h*0.02} x2={w} y2={h*0.02} stroke={C.line} strokeWidth={lw} />
      {/* Paint */}
      <rect x={cx-w*0.19} y={h*0.02} width={w*0.38} height={h*0.52} fill={C.paintFill} stroke={C.line} strokeWidth={lw} />
      {/* Free throw circle */}
      <ellipse cx={cx} cy={h*0.54} rx={w*0.19} ry={w*0.19} fill="none" stroke={C.line} strokeWidth={lw} />
      {/* Restricted arc */}
      <path d={`M ${cx-w*0.08} ${h*0.12} A ${w*0.08} ${w*0.08} 0 0 1 ${cx+w*0.08} ${h*0.12}`} fill="none" stroke={C.line} strokeWidth={lw} />
      {/* Backboard */}
      <line x1={cx-w*0.09} y1={h*0.025} x2={cx+w*0.09} y2={h*0.025} stroke={C.basket} strokeWidth={lw*2} />
      {/* Basket */}
      <circle cx={cx} cy={h*0.06} r={w*0.033} fill="none" stroke={C.basket} strokeWidth={lw*1.5} />
      {/* 3-point arc */}
      <path d={`M ${cx-w*0.43} ${h*0.02} L ${cx-w*0.43} ${h*0.28} A ${w*0.46} ${w*0.46} 0 0 0 ${cx+w*0.43} ${h*0.28} L ${cx+w*0.43} ${h*0.02}`} fill="none" stroke={C.line} strokeWidth={lw} />
      {/* Center circle dashed */}
      <circle cx={cx} cy={h*0.02} r={w*0.1} fill="none" stroke={C.line} strokeWidth={lw} strokeDasharray="3 3" />
    </svg>
  );
}

// Landscape full court: baskets on left & right ends
function FullCourtSVG({ width, height }) {
  const w = width, h = height, cx = w / 2, cy = h / 2;
  const lw = C.lineW;
  // paint depth along x-axis proportional to court length
  const paintDepth = w * 0.19;
  const paintHalfW = h * 0.38 / 2; // half the key width along y
  const threeR = h * 0.46;          // 3-point arc radius (scales with height)
  const ftR    = h * 0.19;          // free-throw circle radius
  const basketR = h * 0.033;
  const bboardOff = w * 0.025;      // backboard offset from edge

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <rect width={w} height={h} fill={C.courtBg} rx={6} />
      <rect x={lw} y={lw} width={w-lw*2} height={h-lw*2} fill="none" stroke={C.line} strokeWidth={lw} rx={4} />

      {/* Midcourt line (vertical) */}
      <line x1={cx} y1={lw} x2={cx} y2={h-lw} stroke={C.line} strokeWidth={lw} />
      {/* Center circle */}
      <circle cx={cx} cy={cy} r={h*0.12} fill="none" stroke={C.line} strokeWidth={lw} />

      {/* LEFT paint */}
      <rect x={lw} y={cy-paintHalfW} width={paintDepth} height={paintHalfW*2} fill={C.paintFill} stroke={C.line} strokeWidth={lw} />
      {/* Left free-throw circle */}
      <ellipse cx={lw+paintDepth} cy={cy} rx={ftR} ry={ftR} fill="none" stroke={C.line} strokeWidth={lw} />
      {/* Left backboard */}
      <line x1={lw+bboardOff} y1={cy-h*0.09} x2={lw+bboardOff} y2={cy+h*0.09} stroke={C.basket} strokeWidth={lw*2} />
      {/* Left basket */}
      <circle cx={lw+bboardOff+h*0.055} cy={cy} r={basketR} fill="none" stroke={C.basket} strokeWidth={lw*1.5} />
      {/* Left 3-point arc */}
      <path
        d={`M ${lw} ${cy-h*0.43} L ${lw+w*0.14} ${cy-h*0.43} A ${threeR} ${threeR} 0 0 1 ${lw+w*0.14} ${cy+h*0.43} L ${lw} ${cy+h*0.43}`}
        fill="none" stroke={C.line} strokeWidth={lw}
      />

      {/* RIGHT paint */}
      <rect x={w-lw-paintDepth} y={cy-paintHalfW} width={paintDepth} height={paintHalfW*2} fill={C.paintFill} stroke={C.line} strokeWidth={lw} />
      {/* Right free-throw circle */}
      <ellipse cx={w-lw-paintDepth} cy={cy} rx={ftR} ry={ftR} fill="none" stroke={C.line} strokeWidth={lw} />
      {/* Right backboard */}
      <line x1={w-lw-bboardOff} y1={cy-h*0.09} x2={w-lw-bboardOff} y2={cy+h*0.09} stroke={C.basket} strokeWidth={lw*2} />
      {/* Right basket */}
      <circle cx={w-lw-bboardOff-h*0.055} cy={cy} r={basketR} fill="none" stroke={C.basket} strokeWidth={lw*1.5} />
      {/* Right 3-point arc */}
      <path
        d={`M ${w-lw} ${cy-h*0.43} L ${w-lw-w*0.14} ${cy-h*0.43} A ${threeR} ${threeR} 0 0 0 ${w-lw-w*0.14} ${cy+h*0.43} L ${w-lw} ${cy+h*0.43}`}
        fill="none" stroke={C.line} strokeWidth={lw}
      />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function WhiteboardCanvas() {
  const navigate = useNavigate();
  const containerRef = useRef(null);

  const [courtMode, setCourtMode] = useState(HALF_COURT);
  const [courtSize, setCourtSize] = useState({ width: 300, height: 400 });
  const [offensive, setOffensive] = useState(DEFAULT_OFFENSIVE_HALF.map(m => ({ ...m })));
  const [defensive, setDefensive] = useState(DEFAULT_DEFENSIVE_HALF.map(m => ({ ...m })));
  const [lastMove, setLastMove] = useState(null); // for undo
  const [draggingMarker, setDraggingMarker] = useState(null);

  // ── Hide layout shell ────────────────────────────────────────────────────────
  useEffect(() => {
    const sidebar  = document.querySelector('[data-sidebar="sidebar"]');
    const sidebarW = document.querySelector('.peer');
    const header   = document.querySelector("header");
    const main     = document.querySelector("main");
    const prev = {
      sd: sidebar?.style.display, sw: sidebarW?.style.display,
      hd: header?.style.display,  mp: main?.style.padding, mo: main?.style.overflow,
    };
    if (sidebar)  sidebar.style.display  = "none";
    if (sidebarW) sidebarW.style.display = "none";
    if (header)   header.style.display   = "none";
    if (main)     { main.style.padding = "0"; main.style.overflow = "hidden"; }
    document.body.style.overflow = "hidden";
    return () => {
      if (sidebar)  sidebar.style.display  = prev.sd ?? "";
      if (sidebarW) sidebarW.style.display = prev.sw ?? "";
      if (header)   header.style.display   = prev.hd ?? "";
      if (main)     { main.style.padding = prev.mp ?? ""; main.style.overflow = prev.mo ?? ""; }
      document.body.style.overflow = "";
    };
  }, []);

  // ── Responsive sizing ────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const TOP_H = 64;
    const PAD   = 24;
    const resize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const availH = vh - TOP_H - PAD;
      const availW = vw - PAD;
      const ratio = courtMode === HALF_COURT ? HALF_COURT_RATIO : FULL_COURT_RATIO;

      if (courtMode === FULL_COURT) {
        // landscape: maximise width, constrain height
        let w = availW, h = w * ratio;
        if (h > availH) { h = availH; w = h / ratio; }
        const maxW = 860;
        if (w > maxW) { w = maxW; h = w * ratio; }
        setCourtSize({ width: Math.floor(w), height: Math.floor(h) });
      } else {
        // portrait half court
        let w = availW, h = w * ratio;
        if (h > availH) { h = availH; w = h / ratio; }
        const maxW = 540;
        if (w > maxW) { w = maxW; h = w * ratio; }
        setCourtSize({ width: Math.floor(w), height: Math.floor(h) });
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [courtMode]);

  // ── Marker dragging ──────────────────────────────────────────────────────────
  function onMarkerPointerDown(e, id, type) {
    e.stopPropagation(); e.preventDefault();
    const canvas = containerRef.current?.querySelector('.court-area');
    if (!canvas) return;
    const rect  = canvas.getBoundingClientRect();
    const touch = e.touches?.[0];
    const cx    = touch ? touch.clientX : e.clientX;
    const cy    = touch ? touch.clientY : e.clientY;
    const list  = type === "offense" ? offensive : defensive;
    const m     = list.find(mk => mk.id === id);
    if (!m) return;
    // save for undo
    setLastMove({ type, id, x: m.x, y: m.y });
    setDraggingMarker({
      id, type,
      offsetX: cx - rect.left - m.x * courtSize.width,
      offsetY: cy - rect.top  - m.y * courtSize.height,
    });
  }

  useEffect(() => {
    if (!draggingMarker) return;
    const mr = markerR(courtSize.width);
    const onMove = (e) => {
      const canvas = containerRef.current?.querySelector('.court-area');
      if (!canvas) return;
      const rect  = canvas.getBoundingClientRect();
      const touch = e.touches?.[0];
      const cx    = touch ? touch.clientX : e.clientX;
      const cy    = touch ? touch.clientY : e.clientY;
      let nx = (cx - rect.left - draggingMarker.offsetX) / courtSize.width;
      let ny = (cy - rect.top  - draggingMarker.offsetY) / courtSize.height;
      nx = clamp(nx, mr / courtSize.width,  1 - mr / courtSize.width);
      ny = clamp(ny, mr / courtSize.height, 1 - mr / courtSize.height);
      const upd = (list) => list.map(mk => mk.id === draggingMarker.id ? { ...mk, x: nx, y: ny } : mk);
      if (draggingMarker.type === "offense") setOffensive(upd);
      else setDefensive(upd);
    };
    const onUp = () => setDraggingMarker(null);
    window.addEventListener("mousemove",  onMove);
    window.addEventListener("mouseup",    onUp);
    window.addEventListener("touchmove",  onMove, { passive: false });
    window.addEventListener("touchend",   onUp);
    return () => {
      window.removeEventListener("mousemove",  onMove);
      window.removeEventListener("mouseup",    onUp);
      window.removeEventListener("touchmove",  onMove);
      window.removeEventListener("touchend",   onUp);
    };
  }, [draggingMarker, courtSize]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  function handleReset() {
    const defO = courtMode === HALF_COURT ? DEFAULT_OFFENSIVE_HALF : DEFAULT_OFFENSIVE_FULL;
    const defD = courtMode === HALF_COURT ? DEFAULT_DEFENSIVE_HALF : DEFAULT_DEFENSIVE_FULL;
    setOffensive(defO.map(m => ({ ...m })));
    setDefensive(defD.map(m => ({ ...m })));
    setLastMove(null);
  }

  function handleUndo() {
    if (!lastMove) return;
    const upd = (list) => list.map(mk => mk.id === lastMove.id ? { ...mk, x: lastMove.x, y: lastMove.y } : mk);
    if (lastMove.type === "offense") setOffensive(upd);
    else setDefensive(upd);
    setLastMove(null);
  }

  function switchCourt(mode) {
    setCourtMode(mode);
    const defO = mode === HALF_COURT ? DEFAULT_OFFENSIVE_HALF : DEFAULT_OFFENSIVE_FULL;
    const defD = mode === HALF_COURT ? DEFAULT_DEFENSIVE_HALF : DEFAULT_DEFENSIVE_FULL;
    setOffensive(defO.map(m => ({ ...m })));
    setDefensive(defD.map(m => ({ ...m })));
    setLastMove(null);
  }

  const mr = markerR(courtSize.width);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#f8fafc", display: "flex", flexDirection: "column",
      overflow: "hidden", touchAction: "none",
    }}>
      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", flexShrink: 0,
      }}>
        {/* Left: Reset + Undo */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleReset}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", background: "white", color: "#334155",
              border: "1px solid #e2e8f0", borderRadius: 10,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            }}
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={handleUndo}
            disabled={!lastMove}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", background: lastMove ? "white" : "#f1f5f9",
              color: lastMove ? "#334155" : "#94a3b8",
              border: "1px solid #e2e8f0", borderRadius: 10,
              fontSize: 13, fontWeight: 600,
              cursor: lastMove ? "pointer" : "default",
              boxShadow: lastMove ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
            }}
          >
            ↩ Undo
          </button>
        </div>

        {/* Center: court toggle */}
        <div style={{ display: "flex", background: "#e2e8f0", borderRadius: 10, padding: 3 }}>
          {[HALF_COURT, FULL_COURT].map(mode => (
            <button
              key={mode}
              onClick={() => switchCourt(mode)}
              style={{
                padding: "6px 16px", border: "none", borderRadius: 8,
                fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                background: courtMode === mode ? "#7c3aed" : "transparent",
                color: courtMode === mode ? "white" : "#64748b",
              }}
            >
              {mode === HALF_COURT ? "Half" : "Full"}
            </button>
          ))}
        </div>

        {/* Right: Exit */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 38, height: 38, background: "white", color: "#334155",
            border: "1px solid #e2e8f0", borderRadius: "50%",
            cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Court ── */}
      <div
        ref={containerRef}
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
      >
        <div
          className="court-area select-none"
          style={{
            position: "relative", width: courtSize.width, height: courtSize.height,
            touchAction: "none", borderRadius: 8,
            boxShadow: "0 4px 24px rgba(100,116,139,0.18)",
            border: "1px solid #e2e8f0",
          }}
        >
          {/* Court SVG */}
          <div style={{ position: "absolute", inset: 0, borderRadius: 8, overflow: "hidden" }}>
            {courtMode === HALF_COURT
              ? <HalfCourtSVG width={courtSize.width} height={courtSize.height} />
              : <FullCourtSVG width={courtSize.width} height={courtSize.height} />
            }
          </div>

          {/* Defensive markers */}
          {defensive.map(m => (
            <div
              key={m.id}
              onMouseDown={(e) => onMarkerPointerDown(e, m.id, "defense")}
              onTouchStart={(e) => onMarkerPointerDown(e, m.id, "defense")}
              style={{
                position: "absolute",
                left: m.x * courtSize.width - mr,
                top:  m.y * courtSize.height - mr,
                width: mr * 2, height: mr * 2,
                zIndex: 10, cursor: "grab", touchAction: "none",
                userSelect: "none",
              }}
            >
              <svg width={mr*2} height={mr*2}>
                <circle cx={mr} cy={mr} r={mr-2} fill={C.defense} stroke="white" strokeWidth={2.5} />
                {m.label && (
                  <text
                    x={mr} y={mr + mr * 0.38}
                    textAnchor="middle" fill="white"
                    fontSize={Math.round(mr * 0.9)} fontWeight="bold"
                    style={{ userSelect: "none", pointerEvents: "none" }}
                  >
                    {m.label}
                  </text>
                )}
              </svg>
            </div>
          ))}

          {/* Offensive markers */}
          {offensive.map(m => (
            <div
              key={m.id}
              onMouseDown={(e) => onMarkerPointerDown(e, m.id, "offense")}
              onTouchStart={(e) => onMarkerPointerDown(e, m.id, "offense")}
              style={{
                position: "absolute",
                left: m.x * courtSize.width - mr,
                top:  m.y * courtSize.height - mr,
                width: mr * 2, height: mr * 2,
                zIndex: 11, cursor: "grab", touchAction: "none",
                userSelect: "none",
              }}
            >
              <svg width={mr*2} height={mr*2}>
                <circle cx={mr} cy={mr} r={mr-2} fill={C.offense} stroke="white" strokeWidth={2.5} />
                <text
                  x={mr} y={mr + mr * 0.38}
                  textAnchor="middle" fill="white"
                  fontSize={Math.round(mr * 0.9)} fontWeight="bold"
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  {m.label}
                </text>
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{
        flexShrink: 0, padding: "8px 16px 14px",
        display: "flex", justifyContent: "center", gap: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.offense, border: "2px solid white", boxShadow: "0 0 0 1px #e2e8f0" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Offense</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.defense, border: "2px solid white", boxShadow: "0 0 0 1px #e2e8f0" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Defense</span>
        </div>
      </div>
    </div>
  );
}
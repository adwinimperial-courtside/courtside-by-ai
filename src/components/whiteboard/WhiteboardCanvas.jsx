import React, { useRef, useState, useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { X, RotateCcw } from "lucide-react";

// --- Constants ---
const HALF_COURT = "half";
const FULL_COURT = "full";
const HALF_COURT_RATIO = 564 / 470; // height/width
const FULL_COURT_RATIO = 940 / 500;

const DEFAULT_OFFENSIVE = [
  { id: "o1", label: "1", x: 0.5,  y: 0.85 },
  { id: "o2", label: "2", x: 0.2,  y: 0.65 },
  { id: "o3", label: "3", x: 0.8,  y: 0.65 },
  { id: "o4", label: "4", x: 0.25, y: 0.45 },
  { id: "o5", label: "5", x: 0.75, y: 0.45 },
];
const DEFAULT_DEFENSIVE = [
  { id: "d1", x: 0.5,  y: 0.35 },
  { id: "d2", x: 0.25, y: 0.28 },
  { id: "d3", x: 0.75, y: 0.28 },
  { id: "d4", x: 0.35, y: 0.18 },
  { id: "d5", x: 0.65, y: 0.18 },
];

const TOOLS = [
  { id: "select", icon: "✥",  label: "Select"  },
  { id: "line",   icon: "╱",  label: "Line"    },
  { id: "arrow",  icon: "→",  label: "Arrow"   },
  { id: "curve",  icon: "⌒",  label: "Curve"   },
  { id: "screen", icon: "▬",  label: "Screen"  },
  { id: "eraser", icon: "⌫",  label: "Eraser"  },
  { id: "undo",   icon: "↩",  label: "Undo"    },
  { id: "clear",  icon: "✕",  label: "Clear"   },
];

const ERASER_RADIUS = 22;
function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

// Marker radius scales with court width
function markerR(courtW) { return Math.max(14, Math.round(courtW * 0.042)); }

// ─── Brand palette ────────────────────────────────────────────────────────────
const C = {
  courtBg:   "#f1f5f9",   // slate-100 – matches app card bg
  paintFill: "#e2e8f0",   // slate-200 – slightly darker key area
  line:      "#94a3b8",   // slate-400 – matches app UI dividers
  lineW:     1.5,
  basket:    "#64748b",   // slate-500
  drawStroke: "#7c3aed",  // violet-700 – brand purple
};

// ─── Court SVGs ───────────────────────────────────────────────────────────────
function HalfCourtSVG({ width, height }) {
  const w = width, h = height, cx = w / 2;
  const lw = C.lineW;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {/* Background */}
      <rect width={w} height={h} fill={C.courtBg} rx={6} />
      {/* Outer boundary */}
      <rect x={lw} y={lw} width={w-lw*2} height={h-lw*2} fill="none" stroke={C.line} strokeWidth={lw} rx={4} />
      {/* Half-court line (top edge) */}
      <line x1={0} y1={h*0.02} x2={w} y2={h*0.02} stroke={C.line} strokeWidth={lw} />
      {/* Paint / key */}
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
      {/* Center circle (dashed) */}
      <circle cx={cx} cy={h*0.02} r={w*0.1} fill="none" stroke={C.line} strokeWidth={lw} strokeDasharray="3 3" />
    </svg>
  );
}

function FullCourtSVG({ width, height }) {
  const w = width, h = height, cx = w / 2, cy = h / 2;
  const lw = C.lineW;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <rect width={w} height={h} fill={C.courtBg} rx={6} />
      <rect x={lw} y={lw} width={w-lw*2} height={h-lw*2} fill="none" stroke={C.line} strokeWidth={lw} rx={4} />
      {/* Half-court line */}
      <line x1={lw} y1={cy} x2={w-lw} y2={cy} stroke={C.line} strokeWidth={lw} />
      {/* Center circle */}
      <circle cx={cx} cy={cy} r={w*0.12} fill="none" stroke={C.line} strokeWidth={lw} />
      {/* Top paint */}
      <rect x={cx-w*0.19} y={lw} width={w*0.38} height={h*0.26} fill={C.paintFill} stroke={C.line} strokeWidth={lw} />
      <ellipse cx={cx} cy={h*0.26} rx={w*0.19} ry={w*0.19} fill="none" stroke={C.line} strokeWidth={lw} />
      <line x1={cx-w*0.09} y1={h*0.025} x2={cx+w*0.09} y2={h*0.025} stroke={C.basket} strokeWidth={lw*2} />
      <circle cx={cx} cy={h*0.055} r={w*0.033} fill="none" stroke={C.basket} strokeWidth={lw*1.5} />
      <path d={`M ${cx-w*0.43} ${lw} L ${cx-w*0.43} ${h*0.14} A ${w*0.46} ${w*0.46} 0 0 0 ${cx+w*0.43} ${h*0.14} L ${cx+w*0.43} ${lw}`} fill="none" stroke={C.line} strokeWidth={lw} />
      {/* Bottom paint */}
      <rect x={cx-w*0.19} y={h*0.74} width={w*0.38} height={h*0.26} fill={C.paintFill} stroke={C.line} strokeWidth={lw} />
      <ellipse cx={cx} cy={h*0.74} rx={w*0.19} ry={w*0.19} fill="none" stroke={C.line} strokeWidth={lw} />
      <line x1={cx-w*0.09} y1={h*0.975} x2={cx+w*0.09} y2={h*0.975} stroke={C.basket} strokeWidth={lw*2} />
      <circle cx={cx} cy={h*0.945} r={w*0.033} fill="none" stroke={C.basket} strokeWidth={lw*1.5} />
      <path d={`M ${cx-w*0.43} ${h-lw} L ${cx-w*0.43} ${h*0.86} A ${w*0.46} ${w*0.46} 0 0 1 ${cx+w*0.43} ${h*0.86} L ${cx+w*0.43} ${h-lw}`} fill="none" stroke={C.line} strokeWidth={lw} />
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function WhiteboardCanvas() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const dpr          = useRef(window.devicePixelRatio || 1);

  const [courtMode,      setCourtMode]      = useState(HALF_COURT);
  const [courtSize,      setCourtSize]      = useState({ width: 300, height: 400 });
  const [activeTool,     setActiveTool]     = useState("select");
  const [drawings,       setDrawings]       = useState([]);
  const [currentDraw,    setCurrentDraw]    = useState(null);
  const [offensive,      setOffensive]      = useState(DEFAULT_OFFENSIVE.map(m => ({ ...m })));
  const [defensive,      setDefensive]      = useState(DEFAULT_DEFENSIVE.map(m => ({ ...m })));
  const [draggingMarker, setDraggingMarker] = useState(null);
  const isDrawing   = useRef(false);
  const curvePoints = useRef([]);

  // ── Hide layout sidebar / header via portal-style DOM override ───────────────
  useEffect(() => {
    const sidebar  = document.querySelector('[data-sidebar="sidebar"]');
    const sidebarW = document.querySelector('.peer');          // sidebar wrapper
    const header   = document.querySelector("header");
    const main     = document.querySelector("main");

    const prev = {
      sidebarDisplay: sidebar?.style.display,
      sidebarWDisplay: sidebarW?.style.display,
      headerDisplay: header?.style.display,
      mainPadding: main?.style.padding,
      mainOverflow: main?.style.overflow,
    };

    if (sidebar)  sidebar.style.display  = "none";
    if (sidebarW) sidebarW.style.display = "none";
    if (header)   header.style.display   = "none";
    if (main)     { main.style.padding = "0"; main.style.overflow = "hidden"; }

    document.body.style.overflow = "hidden";

    return () => {
      if (sidebar)  sidebar.style.display  = prev.sidebarDisplay  ?? "";
      if (sidebarW) sidebarW.style.display = prev.sidebarWDisplay ?? "";
      if (header)   header.style.display   = prev.headerDisplay   ?? "";
      if (main)     { main.style.padding = prev.mainPadding ?? ""; main.style.overflow = prev.mainOverflow ?? ""; }
      document.body.style.overflow = "";
    };
  }, []);

  // ── Responsive court sizing ──────────────────────────────────────────────────
  useLayoutEffect(() => {
    const TOOLBAR_H = 80;   // approx floating toolbar height
    const TOP_H     = 56;   // approx top controls height

    const resize = () => {
      if (!containerRef.current) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const availH = vh - TOOLBAR_H - TOP_H - 16;
      const availW = vw - 16;
      const ratio = courtMode === HALF_COURT ? HALF_COURT_RATIO : FULL_COURT_RATIO;

      let w = availW;
      let h = w * ratio;
      if (h > availH) { h = availH; w = h / ratio; }

      // max width caps
      const maxW = Math.min(w, courtMode === FULL_COURT ? 480 : 560);
      if (w > maxW) { w = maxW; h = w * ratio; }

      setCourtSize({ width: Math.floor(w), height: Math.floor(h) });
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [courtMode]);

  // ── Retina canvas setup + redraw ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = dpr.current;
    canvas.width  = courtSize.width  * ratio;
    canvas.height = courtSize.height * ratio;
    canvas.style.width  = courtSize.width  + "px";
    canvas.style.height = courtSize.height + "px";

    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, courtSize.width, courtSize.height);
    [...drawings, currentDraw].filter(Boolean).forEach(d => drawShape(ctx, d));
  }, [drawings, currentDraw, courtSize]);

  // ── Drawing helpers ──────────────────────────────────────────────────────────
  function strokeW() { return Math.max(2.5, courtSize.width * 0.006); }

  function drawShape(ctx, d) {
    if (!d?.points || d.points.length < 2) return;
    ctx.strokeStyle = C.drawStroke;
    ctx.lineWidth   = strokeW();
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";

    if (d.type === "line") {
      ctx.beginPath();
      ctx.moveTo(d.points[0].x, d.points[0].y);
      ctx.lineTo(d.points[1].x, d.points[1].y);
      ctx.stroke();
    } else if (d.type === "arrow") {
      const [p1, p2] = d.points;
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const al = 16, aw = 0.45;
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - al * Math.cos(angle - aw), p2.y - al * Math.sin(angle - aw));
      ctx.lineTo(p2.x - al * Math.cos(angle + aw), p2.y - al * Math.sin(angle + aw));
      ctx.closePath(); ctx.fillStyle = C.drawStroke; ctx.fill();
    } else if (d.type === "curve") {
      ctx.beginPath(); ctx.moveTo(d.points[0].x, d.points[0].y);
      for (let i = 1; i < d.points.length; i++) ctx.lineTo(d.points[i].x, d.points[i].y);
      ctx.stroke();
    } else if (d.type === "screen") {
      const [p1, p2] = d.points;
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const thick = strokeW() * 4;
      const nx = -dy / len * thick, ny = dx / len * thick;
      ctx.beginPath();
      ctx.moveTo(p1.x + nx, p1.y + ny); ctx.lineTo(p1.x - nx, p1.y - ny);
      ctx.lineTo(p2.x - nx, p2.y - ny); ctx.lineTo(p2.x + nx, p2.y + ny);
      ctx.closePath(); ctx.stroke();
    }
  }

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const touch  = e.touches?.[0] || e.changedTouches?.[0];
    return {
      x: (touch ? touch.clientX : e.clientX) - rect.left,
      y: (touch ? touch.clientY : e.clientY) - rect.top,
    };
  }

  // ── Marker drag ──────────────────────────────────────────────────────────────
  function onMarkerPointerDown(e, id) {
    if (activeTool !== "select") return;
    e.stopPropagation(); e.preventDefault();
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const touch  = e.touches?.[0];
    const cx     = touch ? touch.clientX : e.clientX;
    const cy     = touch ? touch.clientY : e.clientY;
    const all    = [...offensive, ...defensive];
    const m      = all.find(mk => mk.id === id);
    setDraggingMarker({ id, offsetX: cx - rect.left - m.x * courtSize.width, offsetY: cy - rect.top - m.y * courtSize.height });
  }

  useEffect(() => {
    if (!draggingMarker) return;
    const mr = markerR(courtSize.width);
    const onMove = (e) => {
      const canvas = canvasRef.current;
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
      setOffensive(upd); setDefensive(upd);
    };
    const onUp = () => setDraggingMarker(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend",  onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend",  onUp);
    };
  }, [draggingMarker, courtSize]);

  // ── Canvas drawing events ────────────────────────────────────────────────────
  function onCanvasDown(e) {
    if (activeTool === "select") return;
    e.preventDefault();
    const pos = getPos(e);
    if (activeTool === "eraser") { eraseNear(pos); isDrawing.current = true; return; }
    isDrawing.current = true;
    if (activeTool === "curve") {
      curvePoints.current = [pos];
      setCurrentDraw({ type: "curve", points: [pos] });
    } else {
      setCurrentDraw({ type: activeTool, points: [pos, pos] });
    }
  }

  function onCanvasMove(e) {
    if (!isDrawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    if (activeTool === "eraser") { eraseNear(pos); return; }
    if (activeTool === "curve") {
      curvePoints.current.push(pos);
      setCurrentDraw({ type: "curve", points: [...curvePoints.current] });
    } else {
      setCurrentDraw(prev => prev ? { ...prev, points: [prev.points[0], pos] } : null);
    }
  }

  function onCanvasUp() {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (activeTool === "eraser") return;
    if (currentDraw) {
      const pts = currentDraw.points;
      if (activeTool === "curve" && pts.length >= 2) {
        setDrawings(prev => [...prev, currentDraw]);
      } else if (activeTool !== "curve") {
        const [p1, p2] = pts;
        if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 5) setDrawings(prev => [...prev, currentDraw]);
      }
    }
    setCurrentDraw(null);
    curvePoints.current = [];
  }

  function eraseNear(pos) {
    setDrawings(prev => prev.filter(d => {
      if (!d.points || d.points.length < 2) return true;
      return !d.points.some(pt => Math.hypot(pt.x - pos.x, pt.y - pos.y) < ERASER_RADIUS);
    }));
  }

  // ── Toolbar & controls ───────────────────────────────────────────────────────
  function handleToolClick(id) {
    if (id === "undo")  { setDrawings(prev => prev.slice(0, -1)); return; }
    if (id === "clear") { setDrawings([]); return; }
    setActiveTool(id);
  }

  function handleReset() {
    setOffensive(DEFAULT_OFFENSIVE.map(m => ({ ...m })));
    setDefensive(DEFAULT_DEFENSIVE.map(m => ({ ...m })));
    setDrawings([]); setCurrentDraw(null);
  }

  function switchCourt(mode) {
    setCourtMode(mode);
    setDrawings([]); setCurrentDraw(null);
    setOffensive(DEFAULT_OFFENSIVE.map(m => ({ ...m })));
    setDefensive(DEFAULT_DEFENSIVE.map(m => ({ ...m })));
  }

  const mr = markerR(courtSize.width);
  const cursorStyle = activeTool === "select" ? "default" : activeTool === "eraser" ? "cell" : "crosshair";

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#f8fafc", display: "flex", flexDirection: "column", overflow: "hidden", touchAction: "none" }}
    >
      {/* ── Top floating controls ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", flexShrink: 0 }}>
        {/* Reset */}
        <button
          onClick={handleReset}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "white", color: "#334155", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
        >
          <RotateCcw size={14} /> Reset
        </button>

        {/* Court toggle */}
        <div style={{ display: "flex", background: "#e2e8f0", borderRadius: 10, padding: 3 }}>
          {[HALF_COURT, FULL_COURT].map(mode => (
            <button
              key={mode}
              onClick={() => switchCourt(mode)}
              style={{
                padding: "6px 16px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                background: courtMode === mode ? "#7c3aed" : "transparent",
                color: courtMode === mode ? "white" : "#64748b",
              }}
            >
              {mode === HALF_COURT ? "Half" : "Full"}
            </button>
          ))}
        </div>

        {/* Exit */}
        <button
          onClick={() => navigate(-1)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, background: "white", color: "#334155", border: "1px solid #e2e8f0", borderRadius: "50%", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Court area ── */}
      <div
        ref={containerRef}
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
      >
        <div
          className="select-none"
          style={{ position: "relative", width: courtSize.width, height: courtSize.height, touchAction: "none", borderRadius: 8, boxShadow: "0 4px 24px rgba(100,116,139,0.18)", border: "1px solid #e2e8f0" }}
        >
          {/* Court SVG */}
          <div style={{ position: "absolute", inset: 0, borderRadius: 8, overflow: "hidden" }}>
            {courtMode === HALF_COURT
              ? <HalfCourtSVG width={courtSize.width} height={courtSize.height} />
              : <FullCourtSVG width={courtSize.width} height={courtSize.height} />
            }
          </div>

          {/* Drawing canvas (retina) */}
          <canvas
            ref={canvasRef}
            style={{ position: "absolute", inset: 0, cursor: cursorStyle, touchAction: "none" }}
            onMouseDown={onCanvasDown}
            onMouseMove={onCanvasMove}
            onMouseUp={onCanvasUp}
            onTouchStart={onCanvasDown}
            onTouchMove={onCanvasMove}
            onTouchEnd={onCanvasUp}
          />

          {/* Defensive markers */}
          {defensive.map(m => (
            <div
              key={m.id}
              onMouseDown={(e) => onMarkerPointerDown(e, m.id)}
              onTouchStart={(e) => onMarkerPointerDown(e, m.id)}
              style={{ position: "absolute", left: m.x * courtSize.width - mr, top: m.y * courtSize.height - mr, width: mr*2, height: mr*2, zIndex: 10, cursor: activeTool === "select" ? "grab" : "default", touchAction: "none" }}
            >
              <svg width={mr*2} height={mr*2}>
                <circle cx={mr} cy={mr} r={mr-2} fill="#ef4444" stroke="white" strokeWidth={2} />
              </svg>
            </div>
          ))}

          {/* Offensive markers */}
          {offensive.map(m => (
            <div
              key={m.id}
              onMouseDown={(e) => onMarkerPointerDown(e, m.id)}
              onTouchStart={(e) => onMarkerPointerDown(e, m.id)}
              style={{ position: "absolute", left: m.x * courtSize.width - mr, top: m.y * courtSize.height - mr, width: mr*2, height: mr*2, zIndex: 11, cursor: activeTool === "select" ? "grab" : "default", touchAction: "none" }}
            >
              <svg width={mr*2} height={mr*2}>
                <circle cx={mr} cy={mr} r={mr-2} fill="rgba(109,40,217,0.92)" stroke="white" strokeWidth={2} />
                <text x={mr} y={mr + mr*0.36} textAnchor="middle" fill="white" fontSize={Math.round(mr*0.9)} fontWeight="bold">{m.label}</text>
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* ── Floating bottom toolbar ── */}
      <div style={{ flexShrink: 0, padding: "10px 12px 16px", display: "flex", justifyContent: "center" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 4, padding: "8px 10px",
          background: "white", borderRadius: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          overflowX: "auto", maxWidth: "100%",
        }}>
          {TOOLS.map(tool => {
            const isActive = activeTool === tool.id && !["undo", "clear"].includes(tool.id);
            const isAction = ["undo", "clear"].includes(tool.id);
            return (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool.id)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  padding: "8px 10px", minWidth: 44, border: "none", borderRadius: 12,
                  cursor: "pointer", transition: "all 0.15s", flexShrink: 0,
                  background: isActive ? "#7c3aed" : isAction ? "#f1f5f9" : "#f8fafc",
                  color: isActive ? "white" : isAction ? "#475569" : "#334155",
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{tool.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 600, lineHeight: 1, marginTop: 2 }}>{tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
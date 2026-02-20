import React, { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

// --- Constants ---
const HALF_COURT = "half";
const FULL_COURT = "full";

const HALF_COURT_RATIO = 564 / 470; // height/width ratio (NBA half court proportions)
const FULL_COURT_RATIO = 940 / 500;

const DEFAULT_OFFENSIVE = [
  { id: "o1", label: "1", x: 0.5, y: 0.85 },
  { id: "o2", label: "2", x: 0.2, y: 0.65 },
  { id: "o3", label: "3", x: 0.8, y: 0.65 },
  { id: "o4", label: "4", x: 0.25, y: 0.45 },
  { id: "o5", label: "5", x: 0.75, y: 0.45 },
];

const DEFAULT_DEFENSIVE = [
  { id: "d1", x: 0.5, y: 0.35 },
  { id: "d2", x: 0.25, y: 0.28 },
  { id: "d3", x: 0.75, y: 0.28 },
  { id: "d4", x: 0.35, y: 0.18 },
  { id: "d5", x: 0.65, y: 0.18 },
];

const TOOLS = [
  { id: "select", icon: "✥", label: "Select" },
  { id: "line", icon: "╱", label: "Line" },
  { id: "arrow", icon: "→", label: "Arrow" },
  { id: "curve", icon: "⌒", label: "Curve" },
  { id: "screen", icon: "▬", label: "Screen" },
  { id: "eraser", icon: "⌫", label: "Eraser" },
  { id: "undo", icon: "↩", label: "Undo" },
  { id: "clear", icon: "✕", label: "Clear" },
];

const MARKER_RADIUS = 18;
const ERASER_RADIUS = 20;

function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

// --- Court SVG ---
function HalfCourtSVG({ width, height }) {
  const w = width, h = height;
  const cx = w / 2;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {/* Court fill */}
      <rect width={w} height={h} fill="#c8912a" rx="4" />
      {/* Outer boundary */}
      <rect x={2} y={2} width={w-4} height={h-4} fill="none" stroke="white" strokeWidth={2.5} />
      {/* Half court line */}
      <line x1={0} y1={h*0.02} x2={w} y2={h*0.02} stroke="white" strokeWidth={2} />
      {/* Lane / paint area */}
      <rect x={cx - w*0.19} y={h*0.02} width={w*0.38} height={h*0.52} fill="rgba(180,120,30,0.5)" stroke="white" strokeWidth={2} />
      {/* Free throw circle */}
      <ellipse cx={cx} cy={h*0.54} rx={w*0.19} ry={w*0.19} fill="none" stroke="white" strokeWidth={2} />
      {/* Restricted arc */}
      <path d={`M ${cx - w*0.08} ${h*0.12} A ${w*0.08} ${w*0.08} 0 0 1 ${cx + w*0.08} ${h*0.12}`} fill="none" stroke="white" strokeWidth={2} />
      {/* Backboard */}
      <line x1={cx - w*0.09} y1={h*0.025} x2={cx + w*0.09} y2={h*0.025} stroke="white" strokeWidth={3} />
      {/* Basket */}
      <circle cx={cx} cy={h*0.06} r={w*0.033} fill="none" stroke="white" strokeWidth={2} />
      {/* 3-point arc */}
      <path
        d={`M ${cx - w*0.43} ${h*0.02} L ${cx - w*0.43} ${h*0.28} A ${w*0.46} ${w*0.46} 0 0 0 ${cx + w*0.43} ${h*0.28} L ${cx + w*0.43} ${h*0.02}`}
        fill="none" stroke="white" strokeWidth={2}
      />
      {/* Center circle indicator */}
      <circle cx={cx} cy={h*0.02} r={w*0.1} fill="none" stroke="white" strokeWidth={2} strokeDasharray="4 4" />
    </svg>
  );
}

function FullCourtSVG({ width, height }) {
  const w = width, h = height;
  const cx = w / 2;
  const cy = h / 2;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <rect width={w} height={h} fill="#c8912a" rx="4" />
      <rect x={2} y={2} width={w-4} height={h-4} fill="none" stroke="white" strokeWidth={2.5} />
      {/* Half court line */}
      <line x1={2} y1={cy} x2={w-2} y2={cy} stroke="white" strokeWidth={2} />
      {/* Center circle */}
      <circle cx={cx} cy={cy} r={w*0.12} fill="none" stroke="white" strokeWidth={2} />
      {/* Top paint */}
      <rect x={cx - w*0.19} y={2} width={w*0.38} height={h*0.26} fill="rgba(180,120,30,0.5)" stroke="white" strokeWidth={2} />
      {/* Top FT circle */}
      <ellipse cx={cx} cy={h*0.26} rx={w*0.19} ry={w*0.19} fill="none" stroke="white" strokeWidth={2} />
      {/* Top basket */}
      <line x1={cx - w*0.09} y1={h*0.025} x2={cx + w*0.09} y2={h*0.025} stroke="white" strokeWidth={3} />
      <circle cx={cx} cy={h*0.055} r={w*0.033} fill="none" stroke="white" strokeWidth={2} />
      {/* Top 3pt */}
      <path d={`M ${cx - w*0.43} ${2} L ${cx - w*0.43} ${h*0.14} A ${w*0.46} ${w*0.46} 0 0 0 ${cx + w*0.43} ${h*0.14} L ${cx + w*0.43} ${2}`}
        fill="none" stroke="white" strokeWidth={2} />
      {/* Bottom paint */}
      <rect x={cx - w*0.19} y={h*0.74} width={w*0.38} height={h*0.26} fill="rgba(180,120,30,0.5)" stroke="white" strokeWidth={2} />
      {/* Bottom FT circle */}
      <ellipse cx={cx} cy={h*0.74} rx={w*0.19} ry={w*0.19} fill="none" stroke="white" strokeWidth={2} />
      {/* Bottom basket */}
      <line x1={cx - w*0.09} y1={h*0.975} x2={cx + w*0.09} y2={h*0.975} stroke="white" strokeWidth={3} />
      <circle cx={cx} cy={h*0.945} r={w*0.033} fill="none" stroke="white" strokeWidth={2} />
      {/* Bottom 3pt */}
      <path d={`M ${cx - w*0.43} ${h-2} L ${cx - w*0.43} ${h*0.86} A ${w*0.46} ${w*0.46} 0 0 1 ${cx + w*0.43} ${h*0.86} L ${cx + w*0.43} ${h-2}`}
        fill="none" stroke="white" strokeWidth={2} />
    </svg>
  );
}

// --- Main Component ---
export default function WhiteboardCanvas() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [courtMode, setCourtMode] = useState(HALF_COURT);
  const [courtSize, setCourtSize] = useState({ width: 300, height: 400 });
  const [activeTool, setActiveTool] = useState("select");
  const [drawings, setDrawings] = useState([]); // [{type, points, ...}]
  const [currentDraw, setCurrentDraw] = useState(null);
  const [offensive, setOffensive] = useState(DEFAULT_OFFENSIVE.map(m => ({ ...m })));
  const [defensive, setDefensive] = useState(DEFAULT_DEFENSIVE.map(m => ({ ...m })));
  const [draggingMarker, setDraggingMarker] = useState(null); // {id, offsetX, offsetY}
  const isDrawing = useRef(false);
  const curvePoints = useRef([]);

  // Resize court to fit container
  useEffect(() => {
    const resize = () => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const maxW = container.clientWidth - 0;
      const maxH = container.clientHeight - 0;
      const ratio = courtMode === HALF_COURT ? HALF_COURT_RATIO : FULL_COURT_RATIO;
      let w = maxW;
      let h = w * ratio;
      if (h > maxH) { h = maxH; w = h / ratio; }
      setCourtSize({ width: Math.floor(w), height: Math.floor(h) });
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [courtMode]);

  // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    [...drawings, currentDraw].filter(Boolean).forEach(d => drawShape(ctx, d));
  }, [drawings, currentDraw, courtSize]);

  function drawShape(ctx, d) {
    if (!d || !d.points || d.points.length < 2) return;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (d.type === "line") {
      ctx.beginPath();
      ctx.moveTo(d.points[0].x, d.points[0].y);
      ctx.lineTo(d.points[1].x, d.points[1].y);
      ctx.stroke();
    } else if (d.type === "arrow") {
      const [p1, p2] = d.points;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const al = 14, aw = 0.45;
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - al * Math.cos(angle - aw), p2.y - al * Math.sin(angle - aw));
      ctx.lineTo(p2.x - al * Math.cos(angle + aw), p2.y - al * Math.sin(angle + aw));
      ctx.closePath();
      ctx.fillStyle = "white";
      ctx.fill();
    } else if (d.type === "curve") {
      if (d.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(d.points[0].x, d.points[0].y);
      for (let i = 1; i < d.points.length; i++) {
        ctx.lineTo(d.points[i].x, d.points[i].y);
      }
      ctx.stroke();
    } else if (d.type === "screen") {
      // Draw a pick/screen symbol: flat rectangle
      const [p1, p2] = d.points;
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const nx = -dy / len * 12, ny = dx / len * 12;
      ctx.beginPath();
      ctx.moveTo(p1.x + nx, p1.y + ny);
      ctx.lineTo(p1.x - nx, p1.y - ny);
      ctx.lineTo(p2.x - nx, p2.y - ny);
      ctx.lineTo(p2.x + nx, p2.y + ny);
      ctx.closePath();
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function isOnCourt(x, y) {
    return x >= 0 && x <= courtSize.width && y >= 0 && y <= courtSize.height;
  }

  // --- Marker drag ---
  function onMarkerPointerDown(e, id) {
    if (activeTool !== "select") return;
    e.stopPropagation();
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    const allMarkers = [...offensive, ...defensive];
    const marker = allMarkers.find(m => m.id === id);
    const mx = marker.x * courtSize.width;
    const my = marker.y * courtSize.height;
    setDraggingMarker({ id, offsetX: clientX - rect.left - mx, offsetY: clientY - rect.top - my });
  }

  useEffect(() => {
    if (!draggingMarker) return;
    const onMove = (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches?.[0];
      const clientX = touch ? touch.clientX : e.clientX;
      const clientY = touch ? touch.clientY : e.clientY;
      let nx = (clientX - rect.left - draggingMarker.offsetX) / courtSize.width;
      let ny = (clientY - rect.top - draggingMarker.offsetY) / courtSize.height;
      const mr = MARKER_RADIUS / courtSize.width;
      const mrY = MARKER_RADIUS / courtSize.height;
      nx = clamp(nx, mr, 1 - mr);
      ny = clamp(ny, mrY, 1 - mrY);
      const update = (list) => list.map(m => m.id === draggingMarker.id ? { ...m, x: nx, y: ny } : m);
      setOffensive(prev => update(prev));
      setDefensive(prev => update(prev));
    };
    const onUp = () => setDraggingMarker(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [draggingMarker, courtSize]);

  // --- Canvas drawing ---
  function onCanvasPointerDown(e) {
    if (activeTool === "select") return;
    if (activeTool === "eraser") return; // handled separately
    e.preventDefault();
    const canvas = canvasRef.current;
    const pos = getPos(e, canvas);
    isDrawing.current = true;
    if (activeTool === "curve") {
      curvePoints.current = [pos];
      setCurrentDraw({ type: "curve", points: [pos] });
    } else {
      setCurrentDraw({ type: activeTool, points: [pos, pos] });
    }
  }

  function onCanvasPointerMove(e) {
    if (!isDrawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const pos = getPos(e, canvas);
    if (activeTool === "curve") {
      curvePoints.current.push(pos);
      setCurrentDraw({ type: "curve", points: [...curvePoints.current] });
    } else {
      setCurrentDraw(prev => prev ? { ...prev, points: [prev.points[0], pos] } : null);
    }
  }

  function onCanvasPointerUp(e) {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (currentDraw) {
      const pts = currentDraw.points;
      if (activeTool === "curve" && pts.length >= 2) {
        setDrawings(prev => [...prev, currentDraw]);
      } else if (activeTool !== "curve") {
        const [p1, p2] = pts;
        const dist = Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2);
        if (dist > 5) setDrawings(prev => [...prev, currentDraw]);
      }
    }
    setCurrentDraw(null);
    curvePoints.current = [];
  }

  // Eraser: erase drawings near pointer
  function onCanvasEraserDown(e) {
    if (activeTool !== "eraser") return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const pos = getPos(e, canvas);
    eraseNear(pos);
  }

  function onCanvasEraserMove(e) {
    if (activeTool !== "eraser") return;
    if (!e.buttons && !e.touches) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const pos = getPos(e, canvas);
    eraseNear(pos);
  }

  function eraseNear(pos) {
    setDrawings(prev => prev.filter(d => {
      if (!d.points || d.points.length < 2) return true;
      // Check if any point in the drawing is near eraser
      for (const pt of d.points) {
        const dx = pt.x - pos.x, dy = pt.y - pos.y;
        if (Math.sqrt(dx*dx + dy*dy) < ERASER_RADIUS) return false;
      }
      return true;
    }));
  }

  function handleToolClick(toolId) {
    if (toolId === "undo") {
      setDrawings(prev => prev.slice(0, -1));
      return;
    }
    if (toolId === "clear") {
      setDrawings([]);
      return;
    }
    setActiveTool(toolId);
  }

  function handleReset() {
    setOffensive(DEFAULT_OFFENSIVE.map(m => ({ ...m })));
    setDefensive(DEFAULT_DEFENSIVE.map(m => ({ ...m })));
    setDrawings([]);
    setCurrentDraw(null);
  }

  function switchCourt(mode) {
    setCourtMode(mode);
    setDrawings([]);
    setCurrentDraw(null);
    setOffensive(DEFAULT_OFFENSIVE.map(m => ({ ...m })));
    setDefensive(DEFAULT_DEFENSIVE.map(m => ({ ...m })));
  }

  const canvasEvents = activeTool === "eraser"
    ? {
        onMouseDown: onCanvasEraserDown,
        onMouseMove: onCanvasEraserMove,
        onTouchStart: onCanvasEraserDown,
        onTouchMove: onCanvasEraserMove,
      }
    : {
        onMouseDown: onCanvasPointerDown,
        onMouseMove: onCanvasPointerMove,
        onMouseUp: onCanvasPointerUp,
        onTouchStart: onCanvasPointerDown,
        onTouchMove: onCanvasPointerMove,
        onTouchEnd: onCanvasPointerUp,
      };

  const cursorStyle = activeTool === "select" ? "default"
    : activeTool === "eraser" ? "cell"
    : "crosshair";

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 z-20 flex-shrink-0">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          ↺ Reset
        </button>

        {/* Court Toggle */}
        <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => switchCourt(HALF_COURT)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${courtMode === HALF_COURT ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Half
          </button>
          <button
            onClick={() => switchCourt(FULL_COURT)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${courtMode === FULL_COURT ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Full
          </button>
        </div>

        <button
          onClick={() => navigate(createPageUrl("CoachInsights"))}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          ✕ Exit
        </button>
      </div>

      {/* Court Area */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden px-2 py-2">
        <div className="relative select-none" style={{ width: courtSize.width, height: courtSize.height, touchAction: 'none' }}>
          {/* Court background */}
          <div className="absolute inset-0 rounded-md overflow-hidden shadow-2xl">
            {courtMode === HALF_COURT
              ? <HalfCourtSVG width={courtSize.width} height={courtSize.height} />
              : <FullCourtSVG width={courtSize.width} height={courtSize.height} />
            }
          </div>

          {/* Drawing canvas */}
          <canvas
            ref={canvasRef}
            width={courtSize.width}
            height={courtSize.height}
            className="absolute inset-0"
            style={{ cursor: cursorStyle, touchAction: 'none' }}
            {...canvasEvents}
          />

          {/* Defensive markers */}
          {defensive.map(m => (
            <div
              key={m.id}
              onMouseDown={(e) => onMarkerPointerDown(e, m.id)}
              onTouchStart={(e) => onMarkerPointerDown(e, m.id)}
              style={{
                position: 'absolute',
                left: m.x * courtSize.width - MARKER_RADIUS,
                top: m.y * courtSize.height - MARKER_RADIUS,
                width: MARKER_RADIUS * 2,
                height: MARKER_RADIUS * 2,
                zIndex: 10,
                cursor: activeTool === 'select' ? 'grab' : 'default',
                touchAction: 'none',
              }}
            >
              <svg width={MARKER_RADIUS*2} height={MARKER_RADIUS*2}>
                <circle cx={MARKER_RADIUS} cy={MARKER_RADIUS} r={MARKER_RADIUS-2} fill="rgba(220,38,38,0.9)" stroke="white" strokeWidth={2} />
                <line x1={MARKER_RADIUS-7} y1={MARKER_RADIUS-7} x2={MARKER_RADIUS+7} y2={MARKER_RADIUS+7} stroke="white" strokeWidth={2.5} strokeLinecap="round"/>
                <line x1={MARKER_RADIUS+7} y1={MARKER_RADIUS-7} x2={MARKER_RADIUS-7} y2={MARKER_RADIUS+7} stroke="white" strokeWidth={2.5} strokeLinecap="round"/>
              </svg>
            </div>
          ))}

          {/* Offensive markers */}
          {offensive.map(m => (
            <div
              key={m.id}
              onMouseDown={(e) => onMarkerPointerDown(e, m.id)}
              onTouchStart={(e) => onMarkerPointerDown(e, m.id)}
              style={{
                position: 'absolute',
                left: m.x * courtSize.width - MARKER_RADIUS,
                top: m.y * courtSize.height - MARKER_RADIUS,
                width: MARKER_RADIUS * 2,
                height: MARKER_RADIUS * 2,
                zIndex: 11,
                cursor: activeTool === 'select' ? 'grab' : 'default',
                touchAction: 'none',
              }}
            >
              <svg width={MARKER_RADIUS*2} height={MARKER_RADIUS*2}>
                <circle cx={MARKER_RADIUS} cy={MARKER_RADIUS} r={MARKER_RADIUS-2} fill="rgba(126,34,206,0.9)" stroke="white" strokeWidth={2} />
                <text x={MARKER_RADIUS} y={MARKER_RADIUS+5} textAnchor="middle" fill="white" fontSize={14} fontWeight="bold">{m.label}</text>
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Toolbar */}
      <div className="flex-shrink-0 bg-gray-900 border-t border-gray-800 px-2 py-2 z-20">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {TOOLS.map(tool => {
            const isActive = activeTool === tool.id && !["undo", "clear"].includes(tool.id);
            const isAction = ["undo", "clear"].includes(tool.id);
            return (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool.id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl min-w-[44px] min-h-[52px] transition-all ${
                  isActive
                    ? 'bg-orange-500 text-white'
                    : isAction
                    ? 'bg-gray-700 text-gray-200 active:bg-gray-600'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="text-lg leading-none">{tool.icon}</span>
                <span className="text-[9px] font-medium leading-none mt-0.5">{tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
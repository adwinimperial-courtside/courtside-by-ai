// PHOTO_CROP_V1 — shared crop dialog for player photos.
// Shows the picked image behind a fixed circle; user drags to position and zooms
// with a slider. On save, the square inside the circle is drawn to a 512x512
// JPEG (quality 0.85) and returned as a File via onSave. No external libraries.
import React, { useEffect, useRef, useState, useCallback } from "react";
import { ZoomIn, ImageIcon, Loader2 } from "lucide-react";

// PHOTO_CROP_V1 — download an existing photo URL back into a File so it can be re-cropped.
// Fetching to a blob first keeps the canvas untainted. Throws if the image can't be loaded.
export async function fetchPhotoAsFile(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load photo (${res.status})`);
  const blob = await res.blob();
  return new File([blob], "player_photo.jpg", { type: blob.type || "image/jpeg" });
}

const OUTPUT_SIZE = 512;
const JPEG_QUALITY = 0.85;
const MAX_ZOOM = 3;

export default function PhotoCropDialog({ file, onSave, onCancel, showPermissionNote = false }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [imgDims, setImgDims] = useState(null); // { w, h }
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const imgElRef = useRef(null);
  const viewportRef = useRef(null);
  const dragRef = useRef(null); // { startX, startY, baseX, baseY }
  const [viewportSize, setViewportSize] = useState(300);

  // Load the picked file into an image element
  useEffect(() => {
    if (!file) return;
    setLoadError(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setImgDims(null);
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const img = new Image();
    img.onload = () => {
      imgElRef.current = img;
      setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => setLoadError(true);
    img.src = url;
    return () => {
      URL.revokeObjectURL(url);
      imgElRef.current = null;
      setImgUrl(null);
    };
  }, [file]);

  // Measure the crop viewport (responsive: smaller on phones)
  useEffect(() => {
    if (!file) return;
    const measure = () => {
      const el = viewportRef.current;
      if (el) setViewportSize(el.clientWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [file, imgDims]);

  // Scale so the image covers the square viewport at zoom 1
  const baseScale = imgDims ? viewportSize / Math.min(imgDims.w, imgDims.h) : 1;
  const scale = baseScale * zoom;

  const clampOffset = useCallback(
    (x, y, z) => {
      if (!imgDims) return { x: 0, y: 0 };
      const s = baseScale * z;
      const maxX = Math.max(0, (imgDims.w * s - viewportSize) / 2);
      const maxY = Math.max(0, (imgDims.h * s - viewportSize) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [imgDims, baseScale, viewportSize]
  );

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clampOffset(dragRef.current.baseX + dx, dragRef.current.baseY + dy, zoom));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleZoomChange = (e) => {
    const z = parseFloat(e.target.value);
    setZoom(z);
    setOffset((prev) => clampOffset(prev.x, prev.y, z));
  };

  const handleSave = async () => {
    const img = imgElRef.current;
    if (!img || !imgDims) return;
    setSaving(true);
    try {
      // Map the viewport square back to source-image coordinates
      const sw = viewportSize / scale;
      const sx = imgDims.w / 2 - offset.x / scale - sw / 2;
      const sy = imgDims.h / 2 - offset.y / scale - sw / 2;
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sw, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Image processing failed"))),
          "image/jpeg",
          JPEG_QUALITY
        );
      });
      const cropped = new File([blob], "player_photo.jpg", { type: "image/jpeg" });
      await onSave(cropped);
    } catch (err) {
      console.error("Crop failed:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!file) return null;

  const circleDiameter = viewportSize * 0.78;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-4">
        <h3 className="text-base font-semibold text-slate-900">Crop photo</h3>
        <p className="text-xs text-slate-500 mt-0.5 mb-3">Drag to position, zoom to frame the face.</p>

        <div
          ref={viewportRef}
          className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-900 select-none"
          style={{ touchAction: "none", cursor: dragRef.current ? "grabbing" : "grab" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {loadError ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-red-300 px-4 text-center">
              Could not read this image. Try a different photo.
            </div>
          ) : !imgDims ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              <img
                src={imgUrl}
                alt="Crop preview"
                draggable={false}
                className="absolute pointer-events-none max-w-none"
                style={{
                  width: imgDims.w * scale,
                  height: imgDims.h * scale,
                  left: viewportSize / 2 + offset.x - (imgDims.w * scale) / 2,
                  top: viewportSize / 2 + offset.y - (imgDims.h * scale) / 2,
                }}
              />
              {/* Dark mask outside the circle */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: circleDiameter,
                  height: circleDiameter,
                  left: (viewportSize - circleDiameter) / 2,
                  top: (viewportSize - circleDiameter) / 2,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                  border: "2px solid #F26B1F",
                }}
              />
            </>
          )}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <ImageIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="range"
            min="1"
            max={MAX_ZOOM}
            step="0.05"
            value={zoom}
            onChange={handleZoomChange}
            disabled={!imgDims || loadError}
            className="flex-1 accent-[#F26B1F]"
          />
          <ZoomIn className="w-5 h-5 text-slate-400 flex-shrink-0" />
        </div>

        {/* PHOTO_PERMISSION_NOTE_V1 — admin-only consent reminder */}
        {showPermissionNote && (
          <div className="mt-4 px-3 py-2.5 rounded-lg border border-orange-200 bg-orange-50">
            <p className="text-xs text-orange-800 leading-relaxed">
              Make sure you have this player's permission to upload their photo. For players under 18, a parent or guardian's permission is required.
            </p>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!imgDims || loadError || saving}
            className="px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 flex items-center gap-2"
            style={{ background: "#F26B1F" }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save photo
          </button>
        </div>
      </div>
    </div>
  );
}
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, RefreshCw, Smartphone } from "lucide-react";

// LIVE_OVERLAY_V2 - "Phone stream" dialog on the game card. Gets (or creates) this game's
// secret overlay link from getLiveOverlay, shows it with Copy, a QR code, Reset link and the
// PRISM setup steps. The link opens /live/<token>, which needs no login.
export default function PhoneStreamDialog({ open, onOpenChange, game, homeName, awayName }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const fetchLink = async (reset) => {
    setLoading(true);
    setError("");
    try {
      const r = await base44.functions.invoke("getLiveOverlay", { action: "link", gameId: game.id, reset: !!reset });
      const d = (r && r.data) || r;
      if (!d || !d.token) throw new Error((d && d.error) || "No link returned");
      setToken(d.token);
      if (reset) setResetDone(true);
    } catch (e) {
      setError("Could not get the phone stream link. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && game?.id) {
      setCopied(false);
      setConfirmReset(false);
      setResetDone(false);
      fetchLink(false);
    }
  }, [open, game?.id]);

  const url = token ? `${window.location.origin}/live/${token}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError("Could not copy automatically. Select the link text and copy it.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-marker="LIVE_OVERLAY_V2">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-orange-500" />Stream overlay</DialogTitle>
          <DialogDescription>
            {homeName} vs {awayName}. One link for OBS and PRISM Live Studio: it shows the live scoreboard and pop-ups on your stream. It works without logging in.
          </DialogDescription>
        </DialogHeader>

        {loading && !token ? <p className="text-sm text-slate-500">Getting your link...</p> : null}
        {error ? <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p> : null}

        {token ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input readOnly value={url} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 text-xs font-mono border border-slate-200 rounded-lg px-3 py-2 bg-slate-50" />
              <Button onClick={copy} className="bg-orange-500 hover:bg-orange-600 text-white shrink-0">
                {copied ? <><Check className="w-4 h-4 mr-1" />Copied</> : <><Copy className="w-4 h-4 mr-1" />Copy link</>}
              </Button>
            </div>

            <div className="flex gap-4 items-center">
              <div className="bg-white p-2 rounded-lg border border-slate-200 shrink-0"><QRCodeSVG value={url} size={112} /></div>
              <p className="text-sm text-slate-600">Scan this with the streaming phone to open the link there, or send the link to it.</p>
            </div>

            {resetDone ? <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">New link made. The old link has stopped working. Paste the new one into OBS or PRISM.</p> : null}

            {/* STREAM_OVERLAY_V1 - the same link works as an OBS Browser Source */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-800 mb-2">Set up OBS (laptop)</p>
              <ol className="list-decimal pl-5 text-sm text-slate-600 space-y-1">
                <li>Add a Browser Source and paste the link.</li>
                <li>Set width 1920 and height 1080.</li>
                <li>Put the Browser Source above your camera in the source list.</li>
              </ol>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-800 mb-2">Set up PRISM (phone)</p>
              <ol className="list-decimal pl-5 text-sm text-slate-600 space-y-1">
                <li>Open PRISM, tap LIVE, then Camera, and pick your Facebook Page.</li>
                <li>Swipe right to open My Studio, then Widget, then Web.</li>
                <li>Paste the link and tap Save.</li>
                <li>Stretch the widget to fill the whole screen (the league logo and pop-ups need it) and turn on layer lock.</li>
                <li>Hold the phone sideways. Test with privacy set to Only me, then go live.</li>
              </ol>
            </div>

            {!confirmReset ? (
              <button type="button" onClick={() => setConfirmReset(true)} className="text-sm text-slate-500 hover:text-red-600 inline-flex items-center gap-1">
                <RefreshCw className="w-4 h-4" />Reset link
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-700">The old link will stop working. Reset?</span>
                <Button size="sm" variant="destructive" disabled={loading} onClick={() => { setConfirmReset(false); fetchLink(true); }}>Yes, reset</Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
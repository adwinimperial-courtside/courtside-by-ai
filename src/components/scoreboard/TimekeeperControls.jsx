import React, { useState, useEffect } from "react";
import { SHOT_FULL, SHOT_SHORT, BREAKS, wholeUp, formatClockEdit } from "@/components/scoreboard/timekeeperLogic";

const CONTROLS_CSS = `
.tkc-boardhold{position:absolute;left:153px;top:0;width:1920px;height:1080px;transform:scale(.84);transform-origin:0 0}
.tkc-ctl{position:absolute;display:flex;gap:14px;padding:14px;box-sizing:border-box}
.tkc-left{left:0;top:0;width:153px;height:907px;flex-direction:column}
.tkc-right{right:0;top:0;width:153px;height:907px;flex-direction:column}
.tkc-bottom{left:0;right:0;top:907px;height:173px}
.tkc-b{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;
  background:#0F1A2D;border:3px solid #25344E;border-radius:18px;color:#8594AE;cursor:pointer;padding:6px;text-align:center;
  font-family:"Big Shoulders Display","Big Shoulders","Roboto Condensed","Arial Narrow","Helvetica Neue",sans-serif;font-stretch:condensed;font-weight:900;
  touch-action:manipulation;-webkit-touch-callout:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.tkc-b:active:not([disabled]){background:#1B2B47}
.tkc-b:focus-visible{outline:5px solid #F26B1F;outline-offset:3px}
.tkc-b b{font-size:44px;line-height:1;letter-spacing:1px}
.tkc-b span{font-size:24px;font-weight:800;color:#5E6D86;line-height:1.05;letter-spacing:.5px}
.tkc-b.tkc-num b{font-family:"Archivo Black","Arial Black",sans-serif;font-weight:400;font-size:58px}
.tkc-b[disabled]{opacity:.35;cursor:not-allowed}
.tkc-b.tkc-run{flex:3}
.tkc-b.tkc-run b{font-size:48px}
.tkc-b.tkc-go b{color:#4ADE80}
.tkc-b.tkc-stop b{color:#F87171}
.tkc-b.tkc-hot{border-color:#2F6BFF;color:#C9D4E6}
.tkc-b.tkc-hot span{color:#8FB0FF}
.tkc-b.tkc-to{flex:1.35}
.tkc-b.tkc-to b{font-size:34px}
.tkc-b.tkc-yes{border-color:#2F6BFF;color:#fff;background:#163067}
.tkc-b.tkc-warn span{color:#FDBA74}
.tkc-panel{position:absolute;left:0;right:0;top:907px;height:173px;background:#0B1424;border-top:3px solid #25344E;display:flex;padding:12px 14px;gap:12px;box-sizing:border-box}
.tkc-panel .tkc-b b{font-size:30px}
.tkc-panel .tkc-b span{font-size:21px}
.tkc-grid{display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:1fr 1fr;gap:10px;width:100%}
.tkc-grid .tkc-b{flex-direction:row;gap:12px;border-radius:14px}
.tkc-grid .tkc-b b{font-size:28px}
.tkc-grid .tkc-b span{font-size:22px}
.tkc-ask{align-items:center}
.tkc-q{flex:2.2;font-family:"Big Shoulders Display","Arial Narrow",sans-serif;font-weight:900;font-size:46px;color:#E2E8F0;padding-left:14px;line-height:1.05}
.tkc-ask .tkc-b{height:100%}
.tkc-lbl{flex:1.4;font-family:"Big Shoulders Display","Arial Narrow",sans-serif;font-weight:900;font-size:36px;color:#AFC0DC;padding-left:14px;line-height:1.05}
.tkc-val{flex:1.3;font-family:"Archivo Black","Arial Black",sans-serif;font-size:84px;color:#fff;text-align:center}
.tkc-edit .tkc-b{height:100%}
.tkc-b b{max-width:100%}
.tkc-b.tkc-run b.tkc-long{font-size:40px}
.tkc-fallback .tkc-b b,.tkc-fallback .tkc-panel .tkc-b b,.tkc-fallback .tkc-grid .tkc-b b{font-size:28px;letter-spacing:0}
.tkc-fallback .tkc-b span,.tkc-fallback .tkc-grid .tkc-b span{font-size:19px}
.tkc-fallback .tkc-q,.tkc-fallback .tkc-lbl{font-size:32px}
.tkc-fallback .tkc-b.tkc-num b{font-size:48px}
.tkc-lock{position:absolute;left:0;right:0;top:907px;height:173px;display:flex;align-items:center;justify-content:center;
  font-family:"Big Shoulders Display","Arial Narrow",sans-serif;font-weight:900;font-size:40px;color:#5E6D86;background:#070D19}
`;

function useFallbackFont() {
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = () => {
      if (!alive) return;
      try {
        const ctx = document.createElement("canvas").getContext("2d");
        const sample = "START HORN 24";
        ctx.font = "900 40px monospace";
        const base = ctx.measureText(sample).width;
        ctx.font = '900 40px "Big Shoulders Display", monospace';
        setFallback(Math.abs(ctx.measureText(sample).width - base) <= 1);
      } catch (err) {
        setFallback(false);
      }
    };
    check();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(check);
    const late = setTimeout(check, 4000);
    return () => { alive = false; clearTimeout(late); };
  }, []);
  return fallback;
}

function Btn({ className, disabled, onClick, children, ...rest }) {
  return (
    <button type="button" className={`tkc-b ${className || ""}`} disabled={disabled} onClick={disabled ? undefined : onClick} {...rest}>
      {children}
    </button>
  );
}

export default function TimekeeperControls({
  snapshot: s, actions, status, homeName, awayName, homeLeft, awayLeft,
  periodLabel, nextLabel, feedLost, onAnyPress,
}) {
  const [panel, setPanel] = useState(null);
  const [askSide, setAskSide] = useState(null);
  const [edit, setEdit] = useState(null);
  const fallback = useFallbackFont();

  useEffect(() => { if (s.final) setPanel(null); }, [s.final]);

  const live = s.live;
  const scheduled = status !== "in_progress" && !s.final;
  const canNext = live && s.ended && (!s.lastPeriodDone || s.tied);
  const nudgeOff = !live || s.running || s.ended;

  let runLabel = s.running ? "STOP" : "START";
  let runSub = "Game clock";
  let runClass = s.running ? "tkc-run tkc-stop" : "tkc-run tkc-go";
  let runDisabled = false;
  if (s.final) {
    runLabel = "FINAL"; runSub = ""; runClass = "tkc-run"; runDisabled = true;
  } else if (scheduled) {
    runSub = "Waiting for the scorer to start the game"; runClass = "tkc-run"; runDisabled = true;
  } else if (s.ended) {
    runLabel = `END ${periodLabel}`;
    runSub = s.lastPeriodDone && !s.tied ? "Waiting for the scorer to end the game" : "Press Next period";
    runClass = "tkc-run"; runDisabled = true;
  }

  let nextSub = "After the buzzer";
  if (s.ended) {
    if (s.lastPeriodDone) nextSub = s.tied ? "Set up overtime" : "Scorer ends the game";
    else nextSub = `Set up ${nextLabel}`;
  }

  let feedText = "Live";
  let feedColor = "#4ADE80";
  if (s.save.error) { feedText = "Not saved"; feedColor = "#F87171"; }
  else if (feedLost || s.save.retrying) { feedText = "Reconnecting"; feedColor = "#FDBA74"; }
  else if (s.save.pending > 0) { feedText = "Saving…"; feedColor = "#FDBA74"; }
  const menuWarn = !!s.save.error || s.save.retrying;

  const openEdit = (kind) => {
    const v = kind === "clock" ? wholeUp(s.left) : Math.max(0, Math.ceil(s.shotLeft - 1e-9));
    setEdit({ kind, v });
    setPanel("edit");
  };
  const editMax = edit?.kind === "clock" ? Math.round(s.periodSeconds) : SHOT_FULL;
  const step = (delta) => setEdit((e) => ({ ...e, v: Math.max(0, Math.min(editMax, e.v + delta)) }));
  const saveEdit = () => {
    if (edit.kind === "clock") actions.setGameClock(edit.v);
    else actions.setShotClock(edit.v);
    setPanel(null);
  };

  const askTimeout = (side) => { setAskSide(side); setPanel("ask"); };
  const confirmTimeout = () => { actions.callTimeout(askSide); setPanel(null); };
  const close = () => setPanel(null);

  return (
    <div className={fallback ? "tkc-fallback" : ""} onPointerDown={onAnyPress} data-marker="TIMEKEEPER_CONTROLS_V1">
      <style>{CONTROLS_CSS}</style>

      <div className="tkc-ctl tkc-left" style={{ visibility: s.shotOn ? "visible" : "hidden" }}>
        <Btn className="tkc-num" disabled={!live || s.ended} onClick={() => actions.resetShot(SHOT_FULL)}><span>Reset</span><b>24</b></Btn>
        <Btn className="tkc-num" disabled={!live || s.ended} onClick={() => actions.resetShot(SHOT_SHORT)}><span>Reset</span><b>14</b></Btn>
      </div>

      <div className="tkc-ctl tkc-right">
        <Btn className={runClass} disabled={runDisabled} onClick={actions.toggleRun}><b className={runLabel.length > 5 ? "tkc-long" : ""}>{runLabel}</b>{runSub && <span>{runSub}</span>}</Btn>
        <Btn
          onPointerDown={(e) => { e.preventDefault(); actions.hornDown(); }}
          onPointerUp={actions.hornUp}
          onPointerLeave={actions.hornUp}
          onPointerCancel={actions.hornUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          <b>HORN</b><span>Hold</span>
        </Btn>
      </div>

      {!s.final && !panel && (
        <div className="tkc-ctl tkc-bottom">
          <Btn className="tkc-to" disabled={!live || s.ended || homeLeft <= 0} onClick={() => askTimeout("home")}><b>TIMEOUT</b><span>{homeName}</span></Btn>
          <Btn disabled={nudgeOff || s.left <= 1} onClick={actions.minusSec}><b>−1 SEC</b></Btn>
          <Btn disabled={nudgeOff || s.left >= s.periodSeconds} onClick={actions.plusSec}><b>+1 SEC</b></Btn>
          <Btn className={canNext ? "tkc-hot" : ""} disabled={!canNext} onClick={actions.nextPeriod}><b>NEXT PERIOD</b><span>{nextSub}</span></Btn>
          <Btn className={menuWarn ? "tkc-warn" : ""} onClick={() => setPanel("menu")}><b>MENU</b>{menuWarn && <span>{feedText}</span>}</Btn>
          <Btn className="tkc-to" disabled={!live || s.ended || awayLeft <= 0} onClick={() => askTimeout("away")}><b>TIMEOUT</b><span>{awayName}</span></Btn>
        </div>
      )}

      {!s.final && panel === "menu" && (
        <div className="tkc-panel">
          <div className="tkc-grid">
            <Btn disabled={!live || s.running} onClick={() => openEdit("clock")}><b>Set game clock</b>{s.running && <span>Stop first</span>}</Btn>
            <Btn disabled={!s.shotOn} onClick={() => openEdit("shot")}><b>Set shot clock</b></Btn>
            <Btn onClick={actions.toggleShot}><b>Shot clock</b><span>{s.shotOn ? "On" : "Off"}</span></Btn>
            <Btn disabled={!s.canUndoTimeout} onClick={() => { actions.undoTimeout(); close(); }}><b>Undo last timeout</b></Btn>
            <Btn disabled={!s.timeout} onClick={() => { actions.endTimeoutEarly(); close(); }}><b>End timeout early</b></Btn>
            <Btn onClick={() => setPanel("break")}><b>Break timer</b></Btn>
            <Btn disabled={!s.canGoBack} onClick={() => { actions.previousPeriod(); close(); }}><b>Previous period</b></Btn>
            <Btn onClick={actions.toggleAutoHorn}><b>Auto horn</b><span>{s.autoHorn ? "On" : "Off"}</span></Btn>
            <Btn tabIndex={-1} style={{ cursor: "default" }}><b>Score feed</b><span style={{ color: feedColor }}>{feedText}</span></Btn>
            <Btn className="tkc-yes" onClick={close}><b>Close menu</b></Btn>
          </div>
        </div>
      )}

      {!s.final && panel === "ask" && (
        <div className="tkc-panel tkc-ask">
          <div className="tkc-q">Timeout for {askSide === "home" ? homeName : awayName}?</div>
          <Btn className="tkc-yes" onClick={confirmTimeout}><b>Yes, timeout</b></Btn>
          <Btn onClick={close}><b>Cancel</b></Btn>
        </div>
      )}

      {!s.final && panel === "edit" && edit && (
        <div className="tkc-panel tkc-edit">
          <div className="tkc-lbl">{edit.kind === "clock" ? "Set game clock" : "Set shot clock"}</div>
          {edit.kind === "clock"
            ? <Btn onClick={() => step(-60)}><b>−1 MIN</b></Btn>
            : <Btn onClick={() => setEdit((e) => ({ ...e, v: SHOT_SHORT }))}><b>14</b></Btn>}
          <Btn onClick={() => step(-1)}><b>−1 SEC</b></Btn>
          <div className="tkc-val">{edit.kind === "clock" ? formatClockEdit(edit.v) : String(edit.v)}</div>
          <Btn onClick={() => step(1)}><b>+1 SEC</b></Btn>
          {edit.kind === "clock"
            ? <Btn onClick={() => step(60)}><b>+1 MIN</b></Btn>
            : <Btn onClick={() => setEdit((e) => ({ ...e, v: SHOT_FULL }))}><b>24</b></Btn>}
          <Btn className="tkc-yes" disabled={edit.kind === "clock" && s.running} onClick={saveEdit}><b>Save</b></Btn>
          <Btn onClick={close}><b>Cancel</b></Btn>
        </div>
      )}

      {!s.final && panel === "break" && (
        <div className="tkc-panel tkc-ask">
          <div className="tkc-q">Show a break countdown on the TV</div>
          {BREAKS.map((b) => (
            <Btn key={b.seconds} className="tkc-yes" onClick={() => { actions.startBreak(b.seconds, b.label); close(); }}>
              <b>{b.seconds / 60} min</b><span>{b.hint}</span>
            </Btn>
          ))}
          <Btn onClick={close}><b>Cancel</b></Btn>
        </div>
      )}

      {s.final && <div className="tkc-lock">Game over. The console is locked.</div>}
    </div>
  );
}
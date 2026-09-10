import React, { useLayoutEffect, useRef, useState, useEffect } from "react";
import { teamInitials } from "@/components/scoreboard/scoreboardLogic";

const SCOREBOARD_CSS = `
.sbx-board{position:relative;width:1920px;height:1080px;background:#0A1730;color:#fff;overflow:hidden;
  font-family:"Big Shoulders Display","Big Shoulders","Roboto Condensed","Arial Narrow","Helvetica Neue",sans-serif;font-stretch:condensed;user-select:none;-webkit-user-select:none}
.sbx-grid{position:absolute;left:0;top:0;right:0;bottom:108px;display:grid;grid-template-columns:538px 1fr 538px;column-gap:23px;padding:0 38px}
.sbx-side,.sbx-center{display:flex;flex-direction:column;align-items:center;min-width:0}
.sbx-side{padding-top:36px}.sbx-center{padding-top:23px}
.sbx-team{display:flex;align-items:center;gap:23px;height:123px;width:100%}
.sbx-away .sbx-team{flex-direction:row-reverse}
.sbx-logo{position:relative;width:119px;height:119px;flex:none;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;
  font-family:"Archivo Black","Arial Black",sans-serif;font-size:44px;color:#fff;box-shadow:0 0 0 5px #fff}
.sbx-logo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.sbx-name{flex:1;min-width:0;font-weight:900;letter-spacing:2px;line-height:1;text-transform:uppercase;white-space:nowrap;overflow:hidden}
.sbx-away .sbx-name{text-align:right}
.sbx-bar{width:100%;height:25px;border-radius:12px;margin-top:21px}
.sbx-home .sbx-bar{background:#FFC928}.sbx-away .sbx-bar{background:#E0241B}
.sbx-num{display:flex;align-items:center;justify-content:center;font-family:"Archivo Black","Arial Black",sans-serif;font-weight:900;font-synthesis:none;line-height:1}
.sbx-num span{display:inline-block;text-align:center}
.sbx-num .d{width:.62em}.sbx-num .c{width:.28em;transform:translateY(-.04em)}.sbx-num .p{width:.26em}.sbx-num .x{width:.5em}
.sbx-score{font-size:372px;height:376px;margin-top:12px}
.sbx-score.sbx-three{font-size:273px}
.sbx-stats{display:flex;width:100%;margin-top:auto;border-top:3px solid rgba(255,255,255,.16);padding-top:21px}
.sbx-stat{flex:1;min-width:0;overflow:hidden;display:flex;flex-direction:column;align-items:center;gap:15px}
.sbx-stat+.sbx-stat{border-left:3px solid rgba(255,255,255,.16)}
.sbx-lbl{font-size:38px;font-weight:900;color:#fff;line-height:1;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap}
.sbx-lbl.sbx-dim{color:#AFC0DC}
.sbx-statn{font-family:"Archivo Black","Arial Black",sans-serif;font-weight:900;font-synthesis:none;font-size:150px;line-height:.9}
.sbx-tag{visibility:hidden;background:#E0241B;color:#fff;font-size:38px;font-weight:900;font-style:normal;line-height:1;padding:8px 31px;border-radius:12px;letter-spacing:2.7px;text-transform:uppercase}
.sbx-penalty .sbx-statn{color:#FF4A3F}
.sbx-penalty .sbx-tag{visibility:visible}
.sbx-league{width:154px;height:154px;display:flex;align-items:center;justify-content:center}
.sbx-league img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.sbx-timebox{margin-top:15px;width:100%;background:#10254A;border:5px solid #2F6BFF;border-radius:29px;display:flex;flex-direction:column;align-items:center;padding:15px 21px 0}
.sbx-clock{font-size:242px;height:265px;width:100%}
.sbx-timebox hr{width:100%;border:0;border-top:3px solid rgba(255,255,255,.2);margin:0}
.sbx-period{font-family:"Archivo Black","Arial Black",sans-serif;font-weight:900;font-synthesis:none;font-size:96px;line-height:1;padding:13px 0 17px;white-space:nowrap}
.sbx-timebox.sbx-final{background:#E0241B;border-color:#FF7A72}
.sbx-timebox.sbx-final hr{border-top-color:rgba(255,255,255,.4)}
.sbx-timebox.sbx-ended .sbx-clock{color:rgba(255,255,255,.55)}
.sbx-shotwrap{margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:17px;visibility:hidden}
.sbx-shotbox{width:353px;height:238px;border-radius:27px}
.sbx-shotlbl{font-size:42px;font-weight:900;letter-spacing:10px;color:#AFC0DC;line-height:1}
.sbx-strip{position:absolute;left:0;right:0;bottom:0;height:69px;background:#07101F;border-top:5px solid #F26B1F;display:flex;align-items:center;justify-content:space-between;
  padding:0 46px;font-size:33px;font-weight:800;color:#AFC0DC}
.sbx-strip b{color:#fff;font-weight:900;letter-spacing:1px}
.sbx-msg{position:absolute;left:0;right:0;bottom:0;height:104px;display:flex;align-items:center;justify-content:center;gap:38px;font-size:61px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase}
.sbx-msg.sbx-timeout{background:#2F6BFF}
.sbx-msg.sbx-delayed{background:#B45309;border-top:5px solid #FFC928;font-size:54px}
.sbx-msg .sbx-t{font-family:"Archivo Black","Arial Black",sans-serif;font-weight:900;font-synthesis:none;letter-spacing:0}
.sbx-dot{width:27px;height:27px;border-radius:50%;background:#FFC928;animation:sbxflash 1s steps(1) infinite}
.sbx-board.sbx-fallback .sbx-lbl{font-size:27px;letter-spacing:0}
.sbx-board.sbx-fallback .sbx-strip{font-size:28px}
.sbx-board.sbx-fallback .sbx-msg{font-size:50px}
@keyframes sbxflash{50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){.sbx-dot{animation:none}}
`;

function Num({ text, className }) {
  const chars = [...String(text)];
  return (
    <div className={`sbx-num ${className || ""}`}>
      {chars.map((ch, i) => {
        const cls = ch === ":" ? "c" : ch === "." ? "p" : /[0-9]/.test(ch) ? "d" : "x";
        return <span key={i} className={cls}>{ch}</span>;
      })}
    </div>
  );
}

function isFontAvailable(family) {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    const sample = "TIMEOUTS LEFT 0123456789";
    ctx.font = "900 40px monospace";
    const base = ctx.measureText(sample).width;
    ctx.font = `900 40px "${family}", monospace`;
    return Math.abs(ctx.measureText(sample).width - base) > 1;
  } catch (err) {
    return true;
  }
}

function useFontState() {
  const [state, setState] = useState({ tick: 0, fallback: false });
  useEffect(() => {
    let alive = true;
    const check = () => {
      if (!alive) return;
      const ok = isFontAvailable("Big Shoulders Display") || isFontAvailable("Big Shoulders");
      setState((s) => ({ tick: s.tick + 1, fallback: !ok }));
    };
    check();
    const fonts = document.fonts;
    if (fonts && fonts.ready) fonts.ready.then(check);
    if (fonts && fonts.addEventListener) fonts.addEventListener("loadingdone", check);
    const late = setTimeout(check, 4000);
    return () => {
      alive = false;
      clearTimeout(late);
      if (fonts && fonts.removeEventListener) fonts.removeEventListener("loadingdone", check);
    };
  }, []);
  return state;
}

function FitName({ text, fontTick }) {
  const ref = useRef(null);
  const [fit, setFit] = useState({ size: 86, lines: 1 });
  useLayoutEffect(() => { setFit({ size: 86, lines: 1 }); }, [text, fontTick]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tooWide = el.scrollWidth > el.clientWidth + 1;
    const tooTall = fit.lines === 2 && el.scrollHeight > el.clientHeight + 1;
    if (!tooWide && !tooTall) return;
    if (fit.lines === 1) {
      const next = Math.min(fit.size - 2, Math.floor((fit.size * el.clientWidth) / el.scrollWidth));
      if (next >= 56) setFit({ size: next, lines: 1 });
      else setFit({ size: 60, lines: 2 });
      return;
    }
    if (fit.size > 28) setFit({ size: Math.max(28, fit.size - 4), lines: 2 });
  }, [fit, text, fontTick]);

  const style = fit.lines === 1
    ? { fontSize: `${fit.size}px` }
    : { fontSize: `${fit.size}px`, whiteSpace: "normal", lineHeight: 1.02, height: "123px", display: "flex", alignItems: "center" };
  return (
    <div ref={ref} className="sbx-name" style={style}>
      {fit.lines === 1 ? text : <span style={{ width: "100%" }}>{text}</span>}
    </div>
  );
}

function TeamLogo({ team }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [team?.logo_url]);
  return (
    <div className="sbx-logo" style={{ backgroundColor: team?.color || "#334155" }}>
      <span>{teamInitials(team?.name)}</span>
      {team?.logo_url && !broken && (
        <img src={team.logo_url} alt="" onError={() => setBroken(true)} />
      )}
    </div>
  );
}

function TeamSide({ side, team, score, fouls, penalty, timeoutsLeft, fontTick }) {
  return (
    <div className={`sbx-side sbx-${side}`}>
      <div className="sbx-team">
        <TeamLogo team={team} />
        <FitName text={team?.name || (side === "home" ? "Home" : "Away")} fontTick={fontTick} />
      </div>
      <div className="sbx-bar" />
      <Num text={String(score)} className={`sbx-score ${score >= 100 ? "sbx-three" : ""}`} />
      <div className="sbx-stats">
        <div className={`sbx-stat ${penalty ? "sbx-penalty" : ""}`}>
          <span className="sbx-lbl">Team fouls</span>
          <span className="sbx-statn">{fouls}</span>
          <i className="sbx-tag">Penalty</i>
        </div>
        <div className="sbx-stat">
          <span className="sbx-lbl sbx-dim">Timeouts left</span>
          <span className="sbx-statn">{timeoutsLeft}</span>
          <i className="sbx-tag" aria-hidden="true">&nbsp;</i>
        </div>
      </div>
    </div>
  );
}

export default function ScoreboardDisplay({ view, homeTeam, awayTeam, leagueLogo }) {
  const [leagueBroken, setLeagueBroken] = useState(false);
  useEffect(() => { setLeagueBroken(false); }, [leagueLogo]);
  const msg = view?.message;
  const fontState = useFontState();

  return (
    <div className={`sbx-board ${fontState.fallback ? "sbx-fallback" : ""}`} data-marker="SCOREBOARD_DISPLAY_V1">
      <style>{SCOREBOARD_CSS}</style>
      <div className="sbx-grid">
        <TeamSide side="home" team={homeTeam} score={view.homeScore} fouls={view.homeFouls}
          penalty={view.homePenalty} timeoutsLeft={view.homeTimeoutsLeft} fontTick={fontState.tick} />
        <div className="sbx-center">
          <div className="sbx-league">
            {leagueLogo && !leagueBroken && (
              <img src={leagueLogo} alt="" onError={() => setLeagueBroken(true)} />
            )}
          </div>
          <div className={`sbx-timebox ${view.lastMinute ? "sbx-final" : ""} ${view.ended ? "sbx-ended" : ""}`}>
            <Num text={view.clockText} className="sbx-clock" />
            <hr />
            <div className="sbx-period">{view.periodText}</div>
          </div>
          <div className="sbx-shotwrap" aria-hidden="true">
            <div className="sbx-shotbox" />
            <span className="sbx-shotlbl">SHOT CLOCK</span>
          </div>
        </div>
        <TeamSide side="away" team={awayTeam} score={view.awayScore} fouls={view.awayFouls}
          penalty={view.awayPenalty} timeoutsLeft={view.awayTimeoutsLeft} fontTick={fontState.tick} />
      </div>

      <div className="sbx-strip">
        <span>Powered by <b>COURTSIDE BY AI</b></span>
        <span>courtside-by-ai.info</span>
      </div>

      {msg && msg.type === "delayed" && (
        <div className="sbx-msg sbx-delayed">
          <span className="sbx-dot" />
          <span>Score may be delayed · reconnecting</span>
        </div>
      )}
      {msg && msg.type === "timeout" && (
        <div className="sbx-msg sbx-timeout">
          <span>{msg.team} timeout</span>
          <span className="sbx-t">{msg.time}</span>
        </div>
      )}
    </div>
  );
}
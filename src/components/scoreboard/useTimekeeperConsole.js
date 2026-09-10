import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getSegment, getTimeoutAllowance } from "@/components/scoreboard/scoreboardLogic";
import {
  TIMEKEEPER_CONSOLE_MARKER,
  SHOT_FULL,
  PLUS_MINUS_SAVE_DELAY_MS,
  OWNER_REWRITE_GAP_MS,
  OFFLINE_RETRY_MS,
  makeDeviceId,
  parseOwner,
  formatOwner,
  compareOwners,
  clockFromGame,
  clockPayload,
  periodLength,
  timeoutKey,
  isLastPeriodOrLater,
  isTied,
  isRetryableError,
  withRateLimitRetry,
} from "@/components/scoreboard/timekeeperLogic";

const TICK_MS = 50;
const TIMEOUT_SECONDS = 60;
const OVERRIDE_HOLD_MS = 8000;

function emptyClock() {
  return { period: 1, ended: false, running: false, left: 0, anchorLeft: 0, anchorPerf: 0 };
}

function emptyShot() {
  return { on: true, left: SHOT_FULL, running: false, anchorLeft: SHOT_FULL, anchorPerf: 0, hornDone: false };
}

export default function useTimekeeperConsole({ gameId, game, active, acceptGame, homeTeam, awayTeam, onLostControl, onTakeoverFailed }) {
  const [, setVersion] = useState(0);
  const [saveState, setSaveState] = useState({ pending: 0, error: null, retrying: false });

  const gameRef = useRef(game);
  const activeRef = useRef(false);
  const deviceIdRef = useRef(makeDeviceId());
  const ownerRef = useRef(null);
  const takeoverConfirmedRef = useRef(false);
  const finalRef = useRef(false);
  const clockRef = useRef(emptyClock());
  const shotRef = useRef(emptyShot());
  const autoHornRef = useRef(true);
  const timeoutRef = useRef(null);
  const breakRef = useRef(null);
  const lastTimeoutRef = useRef(null);
  const overrideRef = useRef({});
  const queueRef = useRef([]);
  const inFlightRef = useRef(null);
  const pumpingRef = useRef(false);
  const needOwnerCheckRef = useRef(false);
  const retryTimerRef = useRef(null);
  const debounceRef = useRef(null);
  const lastRewriteRef = useRef(0);
  const audioRef = useRef({ ctx: null, nodes: null, stopTimer: null });
  const teamsRef = useRef({ homeTeam, awayTeam });
  const callbacksRef = useRef({ acceptGame, onLostControl, onTakeoverFailed });

  gameRef.current = game;
  teamsRef.current = { homeTeam, awayTeam };
  callbacksRef.current = { acceptGame, onLostControl, onTakeoverFailed };

  const bump = useCallback(() => setVersion((v) => (v + 1) % 1000000), []);

  const refreshSaveState = useCallback((patch) => {
    setSaveState((prev) => ({
      ...prev,
      pending: queueRef.current.length,
      retrying: needOwnerCheckRef.current,
      ...(patch || {}),
    }));
  }, []);

  const clockLeft = () => {
    const c = clockRef.current;
    if (!c.running) return c.left;
    return Math.max(0, c.anchorLeft - (performance.now() - c.anchorPerf) / 1000);
  };

  const shotLeft = () => {
    const s = shotRef.current;
    if (!s.running) return s.left;
    return Math.max(0, s.anchorLeft - (performance.now() - s.anchorPerf) / 1000);
  };

  const unlockAudio = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const a = audioRef.current;
      if (!a.ctx) a.ctx = new AudioCtx();
      if (a.ctx.state === "suspended") a.ctx.resume();
    } catch (err) {
      console.warn(`${TIMEKEEPER_CONSOLE_MARKER} sound not available`, err);
    }
  }, []);

  const hornStop = useCallback(() => {
    const a = audioRef.current;
    clearTimeout(a.stopTimer);
    a.stopTimer = null;
    if (!a.nodes) return;
    try {
      const t = a.ctx.currentTime;
      a.nodes.gain.gain.setTargetAtTime(0, t, 0.02);
      a.nodes.oscs.forEach((o) => o.stop(t + 0.1));
    } catch (err) {
      console.warn(`${TIMEKEEPER_CONSOLE_MARKER} horn stop failed`, err);
    }
    a.nodes = null;
  }, []);

  const hornStart = useCallback(() => {
    unlockAudio();
    const a = audioRef.current;
    if (!a.ctx || a.nodes) return;
    try {
      const gain = a.ctx.createGain();
      gain.gain.value = 0.22;
      gain.connect(a.ctx.destination);
      const oscs = [
        { type: "sawtooth", freq: 330 },
        { type: "square", freq: 247 },
      ].map(({ type, freq }) => {
        const o = a.ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.connect(gain);
        o.start();
        return o;
      });
      a.nodes = { gain, oscs };
    } catch (err) {
      console.warn(`${TIMEKEEPER_CONSOLE_MARKER} horn failed`, err);
    }
  }, [unlockAudio]);

  const hornFor = useCallback((ms) => {
    hornStart();
    const a = audioRef.current;
    clearTimeout(a.stopTimer);
    a.stopTimer = setTimeout(hornStop, ms);
  }, [hornStart, hornStop]);

  const autoHorn = useCallback((ms) => {
    if (autoHornRef.current) hornFor(ms);
  }, [hornFor]);

  const clearTimers = () => {
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
  };

  const stopLocal = () => {
    const c = clockRef.current;
    const s = shotRef.current;
    c.left = clockLeft();
    c.running = false;
    s.left = shotLeft();
    s.running = false;
  };

  const startLocal = () => {
    const now = performance.now();
    const c = clockRef.current;
    const s = shotRef.current;
    c.anchorLeft = c.left;
    c.anchorPerf = now;
    c.running = true;
    s.anchorLeft = s.left;
    s.anchorPerf = now;
    s.running = s.left > 0;
  };

  const loseControl = useCallback((reason) => {
    activeRef.current = false;
    queueRef.current = [];
    clearTimers();
    hornStop();
    timeoutRef.current = null;
    breakRef.current = null;
    refreshSaveState({ error: null });
    const cb = callbacksRef.current.onLostControl;
    if (cb) cb(reason);
  }, [hornStop, refreshSaveState]);

  const markFinal = useCallback(() => {
    if (finalRef.current) return;
    finalRef.current = true;
    if (clockRef.current.running) stopLocal();
    queueRef.current = [];
    clearTimers();
    hornStop();
    timeoutRef.current = null;
    breakRef.current = null;
    refreshSaveState({ error: null });
    bump();
  }, [hornStop, refreshSaveState, bump]);

  const ownerCheck = async () => {
    try {
      const fresh = await base44.entities.Game.get(gameId);
      if (!fresh) return "ok";
      callbacksRef.current.acceptGame(fresh, "poll");
      if (fresh.status === "completed") return "final";
      const server = parseOwner(fresh.timekeeper_owner);
      if (server && compareOwners(server, ownerRef.current) > 0) return "lost";
      return "ok";
    } catch (err) {
      return isRetryableError(err) ? "offline" : "ok";
    }
  };

  const pumpRef = useRef(null);

  const scheduleRetry = () => {
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => { if (pumpRef.current) pumpRef.current(); }, OFFLINE_RETRY_MS);
  };

  const pump = useCallback(async () => {
    if (pumpingRef.current) return;
    pumpingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        if (!activeRef.current || finalRef.current) {
          queueRef.current = [];
          break;
        }
        if (needOwnerCheckRef.current) {
          const result = await ownerCheck();
          if (result === "offline") { scheduleRetry(); break; }
          if (result === "final") { markFinal(); break; }
          if (result === "lost") { loseControl("moved"); break; }
          needOwnerCheckRef.current = false;
          if (!activeRef.current || finalRef.current) continue;
        }
        const op = queueRef.current[0];
        inFlightRef.current = op;
        try {
          const res = await withRateLimitRetry(op.run);
          queueRef.current = queueRef.current.filter((q) => q !== op);
          if (op.onDone) op.onDone(res);
          refreshSaveState({ error: null });
        } catch (err) {
          if (isRetryableError(err)) {
            needOwnerCheckRef.current = true;
            refreshSaveState();
            scheduleRetry();
            break;
          }
          queueRef.current = queueRef.current.filter((q) => q !== op);
          console.warn(`${TIMEKEEPER_CONSOLE_MARKER} save failed`, err);
          if (op.onFail) op.onFail(err);
          refreshSaveState({ error: op.failText || "Could not save. Check you are logged in as a league admin." });
        } finally {
          inFlightRef.current = null;
        }
      }
    } finally {
      pumpingRef.current = false;
      refreshSaveState();
    }
  }, [gameId, loseControl, markFinal, refreshSaveState]);
  pumpRef.current = pump;

  const enqueue = useCallback((op) => {
    if (!activeRef.current || finalRef.current) return;
    if (op.kind === "clock" && queueRef.current.some((q) => q.kind === "clock" && q !== inFlightRef.current)) {
      refreshSaveState();
      pump();
      return;
    }
    queueRef.current.push(op);
    refreshSaveState();
    pump();
  }, [pump, refreshSaveState]);

  const acceptSaved = (res) => {
    if (res && res.id && res.updated_date) callbacksRef.current.acceptGame(res, "save");
  };

  const currentClockPayload = () => {
    const c = clockRef.current;
    return clockPayload({ period: c.period, ended: c.ended, running: c.running, left: clockLeft() }, ownerRef.current, Date.now());
  };

  const enqueueClock = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
    enqueue({
      kind: "clock",
      run: () => base44.entities.Game.update(gameId, currentClockPayload()),
      onDone: acceptSaved,
    });
  }, [enqueue, gameId]);

  const takeOver = useCallback(async ({ shotOn, hornOn }) => {
    unlockAudio();
    clearTimers();
    queueRef.current = [];
    needOwnerCheckRef.current = false;
    let fresh = gameRef.current;
    try {
      const g = await base44.entities.Game.get(gameId);
      if (g) {
        fresh = g;
        callbacksRef.current.acceptGame(g, "poll");
      }
    } catch (err) {
      console.warn(`${TIMEKEEPER_CONSOLE_MARKER} takeover read failed, using last known game`, err);
    }
    if (!fresh) throw new Error("Game not loaded");

    const previous = parseOwner(fresh.timekeeper_owner);
    ownerRef.current = { gen: (previous?.gen || 0) + 1, id: deviceIdRef.current };
    takeoverConfirmedRef.current = false;
    finalRef.current = fresh.status === "completed";
    lastTimeoutRef.current = null;
    overrideRef.current = {};
    timeoutRef.current = null;
    breakRef.current = null;
    autoHornRef.current = hornOn !== false;

    const start = clockFromGame(fresh, Date.now());
    const wasRunning = !!fresh.clock_running && !start.ended;
    const endedNow = start.ended || start.left <= 0;
    clockRef.current = { ...emptyClock(), period: start.period, ended: endedNow, left: endedNow ? 0 : start.left };
    shotRef.current = { ...emptyShot(), on: shotOn !== false };
    if (start.running && !endedNow) startLocal();
    activeRef.current = !finalRef.current;
    bump();
    if (!activeRef.current) return;

    const ownerText = formatOwner(ownerRef.current);
    enqueue({
      kind: "owner",
      run: () => base44.entities.Game.update(gameId, { timekeeper_owner: ownerText }),
      onDone: (res) => {
        takeoverConfirmedRef.current = true;
        acceptSaved(res);
      },
      onFail: (err) => {
        loseControl("failed");
        const cb = callbacksRef.current.onTakeoverFailed;
        if (cb) cb(err);
      },
      failText: "Could not take over the clock.",
    });
    if (wasRunning && endedNow) enqueueClock();
  }, [gameId, unlockAudio, enqueue, enqueueClock, loseControl, bump]);

  useEffect(() => {
    if (!active) {
      if (activeRef.current) {
        activeRef.current = false;
        queueRef.current = [];
        clearTimers();
        hornStop();
      }
      return;
    }
    activeRef.current = !finalRef.current;
  }, [active, hornStop]);

  useEffect(() => {
    if (!game || !activeRef.current) return;
    if (game.status === "completed") { markFinal(); return; }
    const mine = ownerRef.current;
    const server = parseOwner(game.timekeeper_owner);
    if (mine && server) {
      const cmp = compareOwners(server, mine);
      if (cmp > 0) { loseControl("moved"); return; }
      if (cmp < 0 && takeoverConfirmedRef.current && Date.now() - lastRewriteRef.current >= OWNER_REWRITE_GAP_MS) {
        lastRewriteRef.current = Date.now();
        enqueueClock();
      }
    }
    const lt = lastTimeoutRef.current;
    if (lt && lt.confirmedAt && game.updated_date && String(game.updated_date) > String(lt.confirmedAt)) {
      const count = Number((game[lt.key] || {})[lt.segment]) || 0;
      if (count < lt.countAfter) {
        if (timeoutRef.current && timeoutRef.current.side === lt.side) timeoutRef.current = null;
        lastTimeoutRef.current = null;
        bump();
      }
    }
    ["home_timeouts", "away_timeouts"].forEach((key) => {
      const o = overrideRef.current[key];
      if (o && o.settled && JSON.stringify(game[key] || {}) === JSON.stringify(o.map)) {
        delete overrideRef.current[key];
      }
    });
  }, [game, markFinal, loseControl, enqueueClock, bump]);

  useEffect(() => {
    const goOnline = () => { if (activeRef.current && queueRef.current.length) pump(); };
    window.addEventListener("online", goOnline);
    return () => window.removeEventListener("online", goOnline);
  }, [pump]);

  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => {
      if (!activeRef.current || finalRef.current) return;
      const c = clockRef.current;
      const s = shotRef.current;
      const nowPerf = performance.now();
      if (c.running && clockLeft() <= 0) {
        stopLocal();
        c.left = 0;
        c.ended = true;
        timeoutRef.current = null;
        autoHorn(1500);
        enqueueClock();
        bump();
      } else if (s.running && shotLeft() <= 0) {
        s.left = 0;
        s.running = false;
        if (!s.hornDone && s.on) autoHorn(1200);
        s.hornDone = true;
        bump();
      }
      if (timeoutRef.current && nowPerf >= timeoutRef.current.endsAt) {
        timeoutRef.current = null;
        autoHorn(900);
        bump();
      }
      if (breakRef.current && nowPerf >= breakRef.current.endsAt) {
        breakRef.current = null;
        autoHorn(900);
        bump();
      }
      const now = Date.now();
      ["home_timeouts", "away_timeouts"].forEach((key) => {
        const o = overrideRef.current[key];
        if (o && o.settled && now - o.settled > OVERRIDE_HOLD_MS) delete overrideRef.current[key];
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [active, autoHorn, enqueueClock, bump]);

  useEffect(() => () => {
    clearTimers();
    hornStop();
    try { if (audioRef.current.ctx) audioRef.current.ctx.close(); } catch (err) { audioRef.current.ctx = null; }
  }, [hornStop]);

  const liveNow = () => gameRef.current?.status === "in_progress" && !finalRef.current;

  const timeoutMap = (key) => {
    const o = overrideRef.current[key];
    return o ? o.map : (gameRef.current?.[key] || {});
  };

  const toggleRun = () => {
    const c = clockRef.current;
    if (!activeRef.current || finalRef.current) return;
    if (c.running) {
      stopLocal();
      enqueueClock();
    } else {
      if (!liveNow() || c.ended || c.left <= 0) return;
      startLocal();
      timeoutRef.current = null;
      breakRef.current = null;
      enqueueClock();
    }
    bump();
  };

  const resetShot = (value) => {
    const s = shotRef.current;
    s.left = value;
    s.hornDone = false;
    if (clockRef.current.running) {
      s.anchorLeft = value;
      s.anchorPerf = performance.now();
      s.running = value > 0;
    }
    bump();
  };

  const nudgeClock = (delta) => {
    const c = clockRef.current;
    if (!liveNow() || c.running || c.ended) return;
    const max = periodLength(gameRef.current, c.period);
    const next = Math.min(max, c.left + delta);
    if (next <= 0) return;
    c.left = next;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { debounceRef.current = null; enqueueClock(); }, PLUS_MINUS_SAVE_DELAY_MS);
    bump();
  };

  const setGameClock = (seconds) => {
    const c = clockRef.current;
    if (!liveNow() || c.running) return;
    const max = periodLength(gameRef.current, c.period);
    const v = Math.max(0, Math.min(max, Math.round(seconds)));
    c.left = v;
    c.ended = v <= 0;
    enqueueClock();
    bump();
  };

  const setShotClock = (seconds) => {
    resetShot(Math.max(0, Math.min(SHOT_FULL, Math.round(seconds))));
  };

  const callTimeout = (side) => {
    const g = gameRef.current;
    const c = clockRef.current;
    if (!liveNow() || c.ended) return;
    const key = timeoutKey(side);
    const segment = getSegment(g, c.period);
    const base = { ...timeoutMap(key) };
    if ((Number(base[segment]) || 0) >= getTimeoutAllowance(g, c.period)) return;
    const countAfter = (Number(base[segment]) || 0) + 1;
    const map = { ...base, [segment]: countAfter };
    if (c.running) stopLocal();
    overrideRef.current[key] = { map, settled: 0 };
    timeoutRef.current = { side, endsAt: performance.now() + TIMEOUT_SECONDS * 1000 };
    breakRef.current = null;
    const entry = { side, key, segment, countAfter, logId: null, confirmedAt: null };
    lastTimeoutRef.current = entry;

    const team = side === "home" ? teamsRef.current.homeTeam : teamsRef.current.awayTeam;
    const teamName = team?.name || (side === "home" ? "Home" : "Away");
    const teamId = side === "home" ? g.home_team_id : g.away_team_id;
    const oldHome = g.home_score || 0;
    const oldAway = g.away_score || 0;
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
    enqueue({
      kind: "timeout",
      run: () => base44.entities.Game.update(gameId, { ...currentClockPayload(), [key]: map }),
      onDone: (res) => {
        const o = overrideRef.current[key];
        if (o && o.map === map) o.settled = Date.now();
        entry.confirmedAt = res?.updated_date || null;
        acceptSaved(res);
      },
      onFail: () => {
        const o = overrideRef.current[key];
        if (o && o.map === map) delete overrideRef.current[key];
        if (timeoutRef.current && timeoutRef.current.side === side) timeoutRef.current = null;
        if (lastTimeoutRef.current === entry) lastTimeoutRef.current = null;
        bump();
      },
      failText: "The timeout was not saved.",
    });
    enqueue({
      kind: "timeoutLog",
      run: () => base44.entities.GameLog.create({
        game_id: gameId,
        player_id: "",
        team_id: teamId,
        stat_type: "timeout",
        stat_label: `Timeout – ${teamName}`,
        stat_points: 0,
        stat_color: "bg-amber-500",
        old_home_score: oldHome,
        old_away_score: oldAway,
      }),
      onDone: (res) => {
        entry.logId = res?.id || null;
        bump();
      },
      failText: "The timeout was saved, but not added to the tracker's activity feed.",
    });
    bump();
  };

  const undoTimeout = () => {
    const entry = lastTimeoutRef.current;
    if (!entry || !entry.logId || finalRef.current) return;
    const base = { ...timeoutMap(entry.key) };
    const map = { ...base, [entry.segment]: Math.max(0, (Number(base[entry.segment]) || 0) - 1) };
    overrideRef.current[entry.key] = { map, settled: 0 };
    if (timeoutRef.current && timeoutRef.current.side === entry.side) timeoutRef.current = null;
    lastTimeoutRef.current = null;
    const logId = entry.logId;
    enqueue({
      kind: "undoTimeout",
      run: () => base44.entities.Game.update(gameId, { [entry.key]: map, timekeeper_owner: formatOwner(ownerRef.current) }),
      onDone: (res) => {
        const o = overrideRef.current[entry.key];
        if (o && o.map === map) o.settled = Date.now();
        acceptSaved(res);
      },
      onFail: () => {
        const o = overrideRef.current[entry.key];
        if (o && o.map === map) delete overrideRef.current[entry.key];
        bump();
      },
      failText: "Undo timeout was not saved.",
    });
    enqueue({
      kind: "undoTimeoutLog",
      run: () => base44.entities.GameLog.delete(logId),
      failText: "The timeout is undone, but it could not be removed from the tracker's activity feed.",
    });
    bump();
  };

  const endTimeoutEarly = () => { timeoutRef.current = null; bump(); };

  const startBreak = (seconds, label) => {
    breakRef.current = { label, endsAt: performance.now() + seconds * 1000 };
    bump();
  };

  const nextPeriod = () => {
    const c = clockRef.current;
    const g = gameRef.current;
    if (!liveNow() || !c.ended) return;
    if (isLastPeriodOrLater(g, c.period) && !isTied(g)) return;
    const period = c.period + 1;
    clockRef.current = { ...emptyClock(), period, left: periodLength(g, period) };
    const s = shotRef.current;
    shotRef.current = { ...emptyShot(), on: s.on };
    timeoutRef.current = null;
    enqueueClock();
    bump();
  };

  const canGoBack = () => {
    const c = clockRef.current;
    return liveNow() && c.period > 1 && !c.running && !c.ended && c.left === periodLength(gameRef.current, c.period);
  };

  const previousPeriod = () => {
    if (!canGoBack()) return;
    const c = clockRef.current;
    clockRef.current = { ...emptyClock(), period: c.period - 1, ended: true, left: 0 };
    enqueueClock();
    bump();
  };

  const toggleShot = () => { shotRef.current.on = !shotRef.current.on; bump(); };
  const toggleAutoHorn = () => { autoHornRef.current = !autoHornRef.current; bump(); };

  const c = clockRef.current;
  const g = gameRef.current;
  const left = clockLeft();
  const live = liveNow();
  const snapshot = {
    active: activeRef.current,
    final: finalRef.current,
    live,
    period: c.period,
    left,
    running: c.running,
    ended: c.ended,
    periodSeconds: periodLength(g, c.period),
    shotOn: shotRef.current.on,
    shotLeft: shotLeft(),
    autoHorn: autoHornRef.current,
    timeout: timeoutRef.current,
    brk: breakRef.current,
    canUndoTimeout: !!(lastTimeoutRef.current && lastTimeoutRef.current.logId),
    canGoBack: canGoBack(),
    lastPeriodDone: isLastPeriodOrLater(g, c.period),
    tied: isTied(g),
    homeTimeouts: timeoutMap("home_timeouts"),
    awayTimeouts: timeoutMap("away_timeouts"),
    save: saveState,
  };

  return {
    snapshot,
    takeOver,
    unlockAudio,
    actions: {
      toggleRun,
      resetShot,
      hornDown: hornStart,
      hornUp: hornStop,
      minusSec: () => nudgeClock(-1),
      plusSec: () => nudgeClock(1),
      callTimeout,
      undoTimeout,
      endTimeoutEarly,
      startBreak,
      setGameClock,
      setShotClock,
      toggleShot,
      toggleAutoHorn,
      nextPeriod,
      previousPeriod,
    },
  };
}
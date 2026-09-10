import {
  getPeriod,
  getPeriodLabel,
  getPeriodSeconds,
  getSegment,
  getStoredSeconds,
  getTimeoutAllowance,
  getTotalPeriods,
} from "@/components/scoreboard/scoreboardLogic";

export const TIMEKEEPER_CONSOLE_MARKER = "TIMEKEEPER_CONSOLE_V1";
export const SHOT_FULL = 24;
export const SHOT_SHORT = 14;
export const RETRY_DELAYS_MS = [250, 500, 1000, 2000];
export const PLUS_MINUS_SAVE_DELAY_MS = 1000;
export const OWNER_REWRITE_GAP_MS = 5000;
export const OFFLINE_RETRY_MS = 3000;
export const BREAKS = [
  { seconds: 120, label: "Break", hint: "Quarter break" },
  { seconds: 600, label: "Half-time", hint: "Half-time" },
];

export function isTimekeeperGame(game) {
  return !!game && game.has_timekeeper === true && game.game_mode !== "untimed";
}

export function canRunClock(user) {
  const role = user?.user_type;
  return role === "app_admin" || role === "league_admin";
}

export function makeDeviceId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function parseOwner(value) {
  if (typeof value !== "string") return null;
  const cut = value.indexOf(":");
  if (cut <= 0) return null;
  const gen = Number(value.slice(0, cut));
  const id = value.slice(cut + 1);
  if (!Number.isFinite(gen) || gen < 1 || !id) return null;
  return { gen, id };
}

export function formatOwner(owner) {
  return owner ? `${owner.gen}:${owner.id}` : null;
}

export function compareOwners(a, b) {
  if (!a || !b) return 0;
  if (a.gen !== b.gen) return a.gen > b.gen ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id > b.id ? 1 : -1;
}

export function wholeUp(left) {
  if (!(left > 0)) return 0;
  return Math.max(1, Math.ceil(left - 0.001));
}

export function periodLength(game, period) {
  return getPeriodSeconds(game, period);
}

export function clockFromGame(game, nowMs) {
  const period = getPeriod(game);
  const stored = getStoredSeconds(game);
  const ended = game?.period_status === "completed";
  let left = stored;
  let running = false;
  if (!ended && game?.clock_running && game?.clock_started_at) {
    const startMs = new Date(game.clock_started_at).getTime();
    const elapsed = Number.isFinite(startMs) ? Math.max(0, (nowMs - startMs) / 1000) : 0;
    left = Math.max(0, stored - elapsed);
    running = left > 0;
  }
  return { period, left: ended ? 0 : left, running, ended };
}

export function clockPayload(clock, owner, nowMs) {
  const base = {
    clock_period: clock.period,
    period_status: clock.ended ? "completed" : "active",
    timekeeper_owner: formatOwner(owner),
  };
  if (clock.ended) {
    return { ...base, clock_running: false, clock_time_left: 0, clock_started_at: null };
  }
  if (clock.running) {
    const whole = wholeUp(clock.left);
    const startedMs = nowMs - (whole - clock.left) * 1000;
    return { ...base, clock_running: true, clock_time_left: whole, clock_started_at: new Date(startedMs).toISOString() };
  }
  return { ...base, clock_running: false, clock_time_left: wholeUp(clock.left), clock_started_at: null };
}

export function timeoutKey(side) {
  return side === "home" ? "home_timeouts" : "away_timeouts";
}

export function timeoutsUsed(game, side, period) {
  const segment = getSegment(game, period);
  return Number((game?.[timeoutKey(side)] || {})[segment]) || 0;
}

export function timeoutsLeft(game, side, period) {
  return Math.max(0, getTimeoutAllowance(game, period) - timeoutsUsed(game, side, period));
}

export function isLastPeriodOrLater(game, period) {
  return period >= getTotalPeriods(game);
}

export function isTied(game) {
  return (Number(game?.home_score) || 0) === (Number(game?.away_score) || 0);
}

export function nextPeriodLabel(game, period) {
  return getPeriodLabel(game, period + 1);
}

export function shotView({ shotOn, shotLeft, gameLeft, live, ended, final }) {
  if (!shotOn) return null;
  if (final || ended) return { text: "–", tone: "dash", flash: false };
  if (live && gameLeft < shotLeft) return { text: "–", tone: "dash", flash: false };
  const value = Math.max(0, Math.ceil(shotLeft - 1e-9));
  const tone = value >= 15 ? "g" : value >= 6 ? "y" : "r";
  return { text: String(value), tone, flash: shotLeft <= 0 };
}

export function isRateLimitError(error) {
  if (!error) return false;
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("too many requests") ||
    error?.status === 429 ||
    error?.response?.status === 429
  );
}

export function isRetryableError(error) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (isRateLimitError(error)) return true;
  const status = error?.status ?? error?.response?.status;
  return !status || status >= 500;
}

export async function withRateLimitRetry(fn) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimitError(err) || attempt >= RETRY_DELAYS_MS.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}

export function formatClockEdit(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
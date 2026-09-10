export const SCOREBOARD_MARKER = "SCOREBOARD_CONSOLE_V1";
export const TIMEOUT_SECONDS = 60;

export function getPeriodType(game) {
  return game?.period_type === "halves" ? "halves" : "quarters";
}

export function getTotalPeriods(game) {
  return game?.period_count || (getPeriodType(game) === "halves" ? 2 : 4);
}

export function getPeriod(game) {
  return Number(game?.clock_period) || 1;
}

export function getPeriodLabel(game, period) {
  const total = getTotalPeriods(game);
  if (period > total) {
    const ot = period - total;
    return ot === 1 ? "OT" : `OT${ot}`;
  }
  return getPeriodType(game) === "halves" ? `H${period}` : `Q${period}`;
}

export function getFoulKey(game, period) {
  const total = getTotalPeriods(game);
  if (period > total) return String(period);
  if (getPeriodType(game) === "halves") return period === 1 ? "h1" : "h2";
  return String(period);
}

export function getSegment(game, period) {
  const total = getTotalPeriods(game);
  if (period > total) return "OVERTIME";
  if (getPeriodType(game) === "halves") return period === 1 ? "FIRST_HALF" : "SECOND_HALF";
  return period <= 2 ? "FIRST_HALF" : "SECOND_HALF";
}

export function getTimeoutAllowance(game, period) {
  const configured = game?.game_rules?.timeoutsPerSegment;
  if (Array.isArray(configured)) {
    const idx = period - 1;
    if (idx >= 0 && idx < configured.length) return Number(configured[idx]) || 0;
    return 1;
  }
  if (configured != null) return Number(configured) || 0;
  const segment = getSegment(game, period);
  if (segment === "OVERTIME") return 1;
  if (segment === "FIRST_HALF") return 2;
  if (getPeriodType(game) === "halves") return 2;
  return 3;
}

export function getPenaltyThreshold(game) {
  const configured = Number(game?.game_rules?.teamFoulBonusThreshold);
  if (configured > 0) return configured;
  return getPeriodType(game) === "halves" ? 7 : 5;
}

export function getPeriodSeconds(game, period) {
  const total = getTotalPeriods(game);
  if (period > total) return (Number(game?.overtime_minutes) || 5) * 60;
  const perPeriod = game?.game_rules?.periodMinutes;
  if (Array.isArray(perPeriod) && perPeriod[period - 1] != null) return Number(perPeriod[period - 1]) * 60;
  return (Number(game?.period_minutes) || 10) * 60;
}

export function getStoredSeconds(game) {
  const stored = game?.clock_time_left;
  if (stored != null && Number.isFinite(Number(stored))) return Math.max(0, Number(stored));
  return getPeriodSeconds(game, getPeriod(game));
}

export function formatGameClock(seconds, running) {
  const s = Math.max(0, seconds);
  const tenths = running ? Math.ceil(s * 10) : Math.round(s) * 10;
  if (tenths < 600) return `${Math.floor(tenths / 10)}.${tenths % 10}`;
  const whole = running ? Math.ceil(s) : Math.round(s);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function isLastMinute(seconds, running) {
  const tenths = running ? Math.ceil(Math.max(0, seconds) * 10) : Math.round(Math.max(0, seconds)) * 10;
  return tenths > 0 && tenths < 600;
}

export function formatCountdown(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function teamInitials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function buildView(game, timeLeft, extras) {
  const period = getPeriod(game);
  const ended = game?.status === "completed";
  const untimed = game?.game_mode === "untimed";
  const running = !!game?.clock_running && !ended;
  const onBreak = !ended && game?.period_status === "completed";
  const foulKey = getFoulKey(game, period);
  const segment = getSegment(game, period);
  const allowance = getTimeoutAllowance(game, period);
  const threshold = getPenaltyThreshold(game);
  const homeFouls = Number((game?.home_team_fouls || {})[foulKey]) || 0;
  const awayFouls = Number((game?.away_team_fouls || {})[foulKey]) || 0;
  const homeUsed = Number((game?.home_timeouts || {})[segment]) || 0;
  const awayUsed = Number((game?.away_timeouts || {})[segment]) || 0;

  let clockText;
  let periodText;
  if (untimed) {
    clockText = "–";
    periodText = ended ? "FINAL" : game?.status === "in_progress" ? "LIVE" : "–";
  } else {
    clockText = formatGameClock(timeLeft, running);
    const label = getPeriodLabel(game, period);
    periodText = ended ? "FINAL" : onBreak ? `END ${label}` : label;
  }

  return {
    homeScore: Number(game?.home_score) || 0,
    awayScore: Number(game?.away_score) || 0,
    clockText,
    periodText,
    lastMinute: !untimed && !ended && isLastMinute(timeLeft, running),
    ended,
    homeFouls,
    awayFouls,
    homePenalty: homeFouls >= threshold,
    awayPenalty: awayFouls >= threshold,
    homeTimeoutsLeft: Math.max(0, allowance - homeUsed),
    awayTimeoutsLeft: Math.max(0, allowance - awayUsed),
    message: extras?.message || null,
  };
}
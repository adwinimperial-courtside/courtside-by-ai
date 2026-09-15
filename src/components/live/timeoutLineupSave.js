// TIMEOUT_LINEUP_SAVE_V1 — one batch write for a timeout lineup change.
// Invariants (from the June 11 Substitution Audit):
// - never writes is_starter on an existing row (new rows are created with is_starter: false, same as quick swap)
// - dedupe-aware: exactly one active PlayerStats row per on-court player, none for everyone else on this team
// - every fetch and the write phase are braked at 15s
// - a failed read FAILS the save; it never creates a row as a fallback
// - finalises minutes_played for players going out
// - one substitution feed entry (out_ids / in_ids), so the existing undo reverses it
import { isPlayerDisqualified } from "@/utils/foulRules";

const BRAKE_MS = 15000;

const brake = (promise, code) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(code)), BRAKE_MS)),
  ]);

const userError = (message) => {
  const err = new Error(message);
  err.userMessage = message;
  return err;
};

export async function saveTimeoutLineup({
  base44,
  game,
  teamId,
  teamName,
  nextIds,
  players,
  computeTimeLeft,
  playerMinutesRef,
  playerGameClockStateRef,
  updateStat,
  createStat,
  createLog,
  loggedBy,
  deviceName,
}) {
  const next = [...new Set(nextIds || [])];
  if (next.length !== 5) throw userError("A lineup needs exactly 5 players.");

  const roster = players.filter((p) => p.team_id === teamId);
  const rosterIds = new Set(roster.map((p) => p.id));
  if (next.some((id) => !rosterIds.has(id))) throw userError("That lineup includes a player from another team.");

  // Fresh read. If it fails, the whole save fails — no blind fallback.
  const freshStats = await brake(base44.entities.PlayerStats.filter({ game_id: game.id }), "TIMEOUT_LINEUP_FETCH_TIMEOUT");

  const rowsFor = (pid) => freshStats.filter((s) => s.player_id === pid);
  if (next.some((pid) => rowsFor(pid).some((s) => isPlayerDisqualified(s, game)))) {
    throw userError("A player in that lineup is out of the game on fouls.");
  }

  const nextSet = new Set(next);
  const currentOnIds = [...new Set(
    freshStats.filter((s) => s.team_id === teamId && s.is_active === true).map((s) => s.player_id)
  )];
  const currentSet = new Set(currentOnIds);
  const outIds = currentOnIds.filter((pid) => !nextSet.has(pid));
  const inIds = next.filter((pid) => !currentSet.has(pid));

  // Minutes: a timeout means the clock is stopped, so the stored clock time is exact.
  const isTimed = game.game_mode === "timed";
  const timeLeftNow = computeTimeLeft(game);
  const outMinutes = {};
  outIds.forEach((pid) => {
    if (playerMinutesRef.current[pid] === undefined) {
      const prior = rowsFor(pid)[0];
      playerMinutesRef.current[pid] = prior?.minutes_played ? prior.minutes_played * 60 : 0;
    }
    if (isTimed) {
      const clockState = playerGameClockStateRef.current[pid];
      if (clockState && clockState.period === game.clock_period) {
        const elapsed = clockState.timeLeft - timeLeftNow;
        if (elapsed > 0) playerMinutesRef.current[pid] = (playerMinutesRef.current[pid] || 0) + elapsed;
      }
    }
    playerGameClockStateRef.current[pid] = null;
    outMinutes[pid] = Math.round(((playerMinutesRef.current[pid] || 0) / 60) * 100) / 100;
  });

  // Build the writes. Only rows whose state actually changes are written.
  const writes = [];
  const expected = freshStats.map((s) => ({ ...s }));
  const expectedById = new Map(expected.map((s) => [s.id, s]));
  const setRow = (row, updates) => {
    writes.push(updateStat({ statId: row.id, updates }));
    Object.assign(expectedById.get(row.id), updates);
  };

  // Everyone on this team who is NOT in the new five: every row off.
  // Includes anyone active in the DB who is no longer on the roster.
  const teamPlayerIds = [...new Set([...roster.map((p) => p.id), ...currentOnIds])];
  teamPlayerIds.forEach((pid) => {
    if (nextSet.has(pid)) return;
    const isOut = outIds.includes(pid);
    rowsFor(pid).forEach((row, i) => {
      if (isOut && i === 0) setRow(row, { is_active: false, minutes_played: outMinutes[pid] });
      else if (row.is_active === true) setRow(row, { is_active: false });
    });
  });

  // The new five: exactly one active row each.
  const needsCreate = [];
  next.forEach((pid) => {
    const rows = rowsFor(pid);
    if (rows.length === 0) { needsCreate.push(pid); return; }
    const keep = rows.find((r) => r.is_active === true) || rows[0];
    if (keep.is_active !== true) setRow(keep, { is_active: true });
    rows.forEach((r) => { if (r.id !== keep.id && r.is_active === true) setRow(r, { is_active: false }); });
  });

  // Clock state for players coming in.
  inIds.forEach((pid) => {
    playerGameClockStateRef.current[pid] = { timeLeft: timeLeftNow, period: game.clock_period };
    if (playerMinutesRef.current[pid] === undefined) {
      const prior = rowsFor(pid)[0];
      playerMinutesRef.current[pid] = prior?.minutes_played ? prior.minutes_played * 60 : 0;
    }
  });

  if (writes.length === 0 && needsCreate.length === 0) {
    return { changed: false, expectedStats: freshStats, outIds: [], inIds: [] };
  }

  await brake(
    (async () => {
      const created = await Promise.all(needsCreate.map(async (pid) => {
        // Targeted re-check before creating. If this read fails, the save fails.
        const existing = await base44.entities.PlayerStats.filter({ game_id: game.id, player_id: pid });
        if (existing && existing.length > 0) {
          const keep = existing[0];
          writes.push(updateStat({ statId: keep.id, updates: { is_active: true } }));
          existing.slice(1).forEach((r) => { if (r.is_active === true) writes.push(updateStat({ statId: r.id, updates: { is_active: false } })); });
          return existing.map((r, i) => ({ ...r, is_active: i === 0 }));
        }
        const row = await createStat({ game_id: game.id, player_id: pid, team_id: teamId, is_starter: false, is_active: true, minutes_played: 0 });
        return [row || { player_id: pid, team_id: teamId, is_starter: false, is_active: true, minutes_played: 0 }];
      }));
      await Promise.all(writes);
      created.flat().forEach((r) => {
        if (r.id && expectedById.has(r.id)) Object.assign(expectedById.get(r.id), r);
        else expected.push(r);
      });
    })(),
    "TIMEOUT_LINEUP_WRITE_TIMEOUT"
  );

  // One feed entry. Non-fatal, same as the substitution dialog: the lineup is already saved.
  if (outIds.length > 0 || inIds.length > 0) {
    const tag = (pid) => {
      const p = roster.find((x) => x.id === pid);
      const n = p?.jersey_number;
      return n !== null && n !== undefined && String(n).trim() !== "" ? String(n) : (p?.name || "?");
    };
    const moves = [
      inIds.length ? `IN ${inIds.map(tag).join(", ")}` : "",
      outIds.length ? `OUT ${outIds.map(tag).join(", ")}` : "",
    ].filter(Boolean).join(" · ");
    try {
      await brake(createLog({
        game_id: game.id,
        player_id: outIds[0] || inIds[0],
        team_id: teamId,
        stat_type: "substitution",
        stat_label: JSON.stringify({
          display: `${teamName}: Timeout subs · ${moves}`,
          out_ids: outIds,
          in_ids: inIds,
          team_id: teamId,
          source: "timeout_lineup",
        }),
        stat_points: 0,
        stat_color: teamId === game.home_team_id ? "bg-blue-600" : "bg-red-600",
        old_home_score: game.home_score || 0,
        old_away_score: game.away_score || 0,
        logged_by: loggedBy || "",
        device_name: deviceName || "",
      }), "TIMEOUT_LINEUP_LOG_TIMEOUT");
    } catch (logError) {
      console.warn("[LiveStat:timeoutLineup] feed entry failed, lineup still saved:", logError);
    }
  }

  return { changed: true, expectedStats: expected, outIds, inIds };
}
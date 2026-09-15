// TIMEOUT_LINEUP_PANEL_V1 — timeout lineup picker. LOCAL STATE ONLY.
// This component never writes to the database. It reports the chosen five
// through onSave; the tracker owns the batch write. Never touches is_starter.
import React, { useMemo, useState } from "react";
import { getPlayerFoulTotal, getDisqualificationReason, getFoulLimits } from "@/utils/foulRules";

const SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;
const INITIAL = /^[A-Za-z]\.?$/;

// Court label rule: drop the first word, strip trailing suffixes, strip middle
// initials when more than one word remains. Never truncate — the chip wraps.
export const courtLabel = (fullName) => {
  const words = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0];
  let rest = words.slice(1);
  while (rest.length > 1 && SUFFIX.test(rest[rest.length - 1])) rest.pop();
  if (rest.length > 1) rest = rest.filter((w) => !INITIAL.test(w));
  const out = rest.filter((w) => !SUFFIX.test(w)).join(" ");
  return out || words[words.length - 1];
};

// Disambiguate within the team only: clashing labels get a first initial;
// if they still clash, show the full name.
const buildLabels = (players) => {
  const base = players.map((p) => courtLabel(p.name));
  const count = (arr) => arr.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});
  const c1 = count(base);
  const step = base.map((b, i) => {
    if (c1[b] < 2) return b;
    const first = String(players[i].name || "").trim().split(/\s+/)[0] || "";
    return first ? `${first.charAt(0).toUpperCase()}. ${b}` : b;
  });
  const c2 = count(step);
  return step.map((s, i) => (c2[s] < 2 ? s : String(players[i].name || "").trim()));
};

const hasNumber = (p) =>
  p.jersey_number !== null && p.jersey_number !== undefined && String(p.jersey_number).trim() !== "";

const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

export default function TimeoutLineupPanel({
  roster = [],
  onCourtIds = [],
  stats = [],
  game,
  saving = false,
  onSave,
  onClose,
}) {
  // Jersey order, blank numbers last. Never reorders while tapping.
  const players = useMemo(() => {
    return [...roster].sort((a, b) => {
      const an = hasNumber(a), bn = hasNumber(b);
      if (an !== bn) return an ? -1 : 1;
      if (an && bn) {
        const d = Number(a.jersey_number) - Number(b.jersey_number);
        if (d !== 0) return d;
      }
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [roster]);

  const labels = useMemo(() => buildLabels(players), [players]);
  const labelById = useMemo(() => {
    const m = {};
    players.forEach((p, i) => { m[p.id] = labels[i]; });
    return m;
  }, [players, labels]);

  const committedKey = [...onCourtIds].sort().join("|");
  const committed = useMemo(() => new Set(onCourtIds), [committedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selected, setSelected] = useState(() => new Set(onCourtIds));
  const dirty = !sameSet(selected, committed);

  // If the court changes underneath us and nothing is pending, follow it.
  const [lastCommittedKey, setLastCommittedKey] = useState(committedKey);
  if (lastCommittedKey !== committedKey) {
    const selectedKey = [...selected].sort().join("|");
    setLastCommittedKey(committedKey);
    if (selectedKey === lastCommittedKey) setSelected(new Set(onCourtIds));
  }

  // Mirror the tracker's player card: active row first, else first row.
  // Disqualified if ANY row for the player is disqualified (safe direction).
  const foulInfo = useMemo(() => {
    const info = {};
    players.forEach((p) => {
      const rows = stats.filter((s) => s.player_id === p.id);
      const shown = rows.find((s) => s.is_active) || rows[0];
      const dq = rows.map((s) => getDisqualificationReason(s, game)).find(Boolean) || null;
      info[p.id] = { total: shown ? getPlayerFoulTotal(shown, game) : 0, dq };
    });
    return info;
  }, [players, stats, game]);

  const limit = getFoulLimits(game).personalFoulLimit;

  const toggle = (id) => {
    if (saving || foulInfo[id]?.dq) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const tagFor = (id) => {
    const p = players.find((x) => x.id === id);
    return p && hasNumber(p) ? String(p.jersey_number) : labelById[id] || "?";
  };
  const inIds = [...selected].filter((id) => !committed.has(id));
  const outIds = [...committed].filter((id) => !selected.has(id));
  const moves = [
    inIds.length ? `IN ${inIds.map(tagFor).join(", ")}` : "",
    outIds.length ? `OUT ${outIds.map(tagFor).join(", ")}` : "",
  ].filter(Boolean).join(" · ");

  const n = selected.size;
  let statusText, statusTone, rightText = "";
  if (saving) { statusText = "Saving lineup…"; statusTone = "ok"; }
  else if (n < 5) { statusText = `Pick ${5 - n} more`; statusTone = "need"; rightText = `${n} lit`; }
  else if (n > 5) { statusText = `${n - 5} too many`; statusTone = "need"; rightText = `${n} lit`; }
  else if (dirty) { statusText = "Ready to save"; statusTone = "ok"; rightText = moves; }
  else { statusText = "Tap whoever came in or out."; statusTone = "same"; }

  const toneClass = {
    need: "bg-amber-50 border-amber-300 text-amber-800",
    ok: "bg-green-50 border-green-300 text-green-700",
    same: "bg-slate-50 border-slate-200 text-slate-600",
  }[statusTone];

  const canSave = !saving && dirty && n === 5;

  const handleSave = () => {
    if (!canSave || !onSave) return;
    onSave({ nextIds: [...selected], inIds, outIds });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0" data-marker="TIMEOUT_LINEUP_PANEL_V1">
      <div
        className="grid gap-1.5 p-1 flex-1 min-h-0 overflow-y-auto content-start"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }}
      >
        {players.map((p, i) => {
          const id = p.id;
          const { total, dq } = foulInfo[id] || { total: 0, dq: null };
          const lit = selected.has(id);
          const was = committed.has(id);
          const isIn = !dq && lit && !was;
          const isOut = !dq && !lit && was;
          const warn = !dq && total >= limit - 1;
          const showFouls = !dq && total >= limit - 2;

          let chipClass = "bg-white border-slate-300";
          if (dq) chipClass = "bg-slate-100 border-slate-200 cursor-not-allowed";
          else if (lit) chipClass = "bg-slate-800 border-slate-800";

          return (
            <button
              key={id}
              type="button"
              disabled={!!dq || saving}
              onClick={() => toggle(id)}
              className={`relative rounded-xl border-[1.5px] px-1.5 pt-2.5 pb-2 text-center select-none transition-colors active:scale-[.97] ${chipClass}`}
            >
              {dq && (
                <span className="absolute left-1 top-1 text-[8px] font-extrabold rounded px-1 bg-slate-200 text-slate-500">
                  {dq.label === "FOUL OUT" ? "FOULED OUT" : "EJECTED"}
                </span>
              )}
              {isIn && (
                <span className="absolute left-1 top-1 text-[9px] font-extrabold rounded px-1 bg-green-600 text-white">IN</span>
              )}
              {isOut && (
                <span className="absolute left-1 top-1 text-[9px] font-extrabold rounded px-1 bg-red-600 text-white">OUT</span>
              )}
              {showFouls && (
                <span
                  className={`absolute right-1.5 top-1 text-[9px] font-bold ${
                    warn ? (lit ? "text-amber-300" : "text-amber-600") : (lit ? "text-slate-300" : "text-slate-400")
                  }`}
                >
                  {total}F
                </span>
              )}
              <div
                className={`text-2xl font-bold leading-none tracking-tight mt-1 ${
                  dq ? "text-slate-300 line-through" : lit ? "text-white" : hasNumber(p) ? "text-slate-900" : "text-slate-400"
                }`}
              >
                {hasNumber(p) ? p.jersey_number : "–"}
              </div>
              <div
                className={`text-[11px] font-semibold leading-tight mt-1 break-words ${
                  dq ? "text-slate-300" : lit ? "text-white" : "text-slate-600"
                }`}
              >
                {labels[i]}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex-shrink-0 pt-1">
        <div className={`mx-1 mb-1.5 rounded-lg border px-3 py-2 text-xs font-semibold flex items-center gap-2 ${toneClass}`}>
          <span>{statusText}</span>
          {rightText && <span className="ml-auto font-medium opacity-85 text-right">{rightText}</span>}
        </div>

        {dirty ? (
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="mx-1 mb-1.5 w-[calc(100%-0.5rem)] rounded-lg py-3 text-sm font-extrabold bg-green-600 hover:bg-green-700 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            Save lineup
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => onClose && onClose()}
            className="mx-1 mb-1.5 w-[calc(100%-0.5rem)] rounded-lg py-3 text-sm font-bold bg-white border-[1.5px] border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Back to scoring
          </button>
        )}

        {dirty && !saving && (
          <button
            type="button"
            onClick={() => setSelected(new Set(onCourtIds))}
            className="block mx-auto mb-2 text-xs font-semibold text-slate-500 underline hover:text-slate-900"
          >
            Discard changes
          </button>
        )}
      </div>
    </div>
  );
}
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, RefreshCw, Copy, CheckCircle2 } from "lucide-react";

// IDENTITY_HEALTH_CHECK_V1
// Read-only audit of UserLeagueIdentity records. Finds:
//   - duplicate  : more than one identity row for the same user in the same league
//   - no_role    : identity row with no role saved
//   - no_link    : role === 'player' but no matched_player_id (stats will never attach)
// Reads ONE LEAGUE AT A TIME on purpose: a single unpaginated fetch is silently
// truncated at ~1500 rows, which would under-report. Nothing here writes or deletes.
// App admin only, gated both by the caller and again inside this component.

export default function IdentityHealthCheck() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ["user"],
    queryFn: () => base44.auth.me(),
  });

  const isAppAdmin = currentUser?.user_type === "app_admin";
  if (currentUser && !isAppAdmin) return null;

  const runCheck = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    setCopied(false);
    try {
      const leagues = await base44.entities.League.list();
      const leagueName = {};
      (leagues || []).forEach((l) => { leagueName[l.id] = l.name || l.id; });

      let totalRows = 0;
      const buckets = {};

      for (const league of leagues || []) {
        let rows = [];
        try {
          rows = await base44.entities.UserLeagueIdentity.filter({ league_id: league.id });
        } catch (_e) {
          rows = [];
        }
        totalRows += (rows || []).length;
        (rows || []).forEach((r) => {
          if (!r || !r.user_id) return;
          const key = r.user_id + "::" + league.id;
          if (!buckets[key]) {
            buckets[key] = { user_id: r.user_id, league_id: league.id, rows: [] };
          }
          buckets[key].rows.push(r);
        });
      }

      const findings = [];
      let dupCount = 0;
      let noRoleCount = 0;
      let noLinkCount = 0;

      Object.values(buckets).forEach((b) => {
        const problems = [];
        if (b.rows.length > 1) {
          problems.push("duplicate");
          dupCount += b.rows.length - 1;
        }
        const roleless = b.rows.filter((r) => !r.role);
        if (roleless.length > 0) {
          problems.push("no_role");
          noRoleCount += roleless.length;
        }
        const brokenPlayer = b.rows.filter((r) => r.role === "player" && !r.matched_player_id);
        if (brokenPlayer.length > 0) {
          problems.push("no_link");
          noLinkCount += brokenPlayer.length;
        }
        if (problems.length === 0) return;

        const good = b.rows.find((r) => r.role && (r.role !== "player" || r.matched_player_id));
        findings.push({
          user_id: b.user_id,
          league_id: b.league_id,
          league_name: leagueName[b.league_id] || b.league_id,
          row_count: b.rows.length,
          problems,
          good_role: good ? good.role : "",
          good_player: good && good.matched_player_name ? good.matched_player_name : "",
        });
      });

      const ids = Array.from(new Set(findings.map((f) => f.user_id)));
      const userInfo = {};
      for (const id of ids) {
        try {
          const u = await base44.entities.User.get(id);
          userInfo[id] = {
            name: (u && (u.display_name || u.full_name)) || "(no name)",
            email: (u && u.email) || "",
          };
        } catch (_e) {
          userInfo[id] = { name: "(account not found)", email: "" };
        }
      }
      findings.forEach((f) => {
        f.user_name = userInfo[f.user_id]?.name || "";
        f.user_email = userInfo[f.user_id]?.email || "";
      });

      findings.sort((a, b) =>
        (a.league_name || "").localeCompare(b.league_name || "") ||
        (a.user_name || "").localeCompare(b.user_name || "")
      );

      setResult({
        leagues_scanned: (leagues || []).length,
        total_rows: totalRows,
        dup_count: dupCount,
        no_role_count: noRoleCount,
        no_link_count: noLinkCount,
        accounts_affected: ids.length,
        findings,
        ran_at: new Date().toLocaleString(),
      });
    } catch (err) {
      setError(err?.message || "Check failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const copyResults = async () => {
    if (!result) return;
    const header = ["Account", "Email", "League", "Rows", "Problems", "Good row"].join("\t");
    const lines = result.findings.map((f) =>
      [
        f.user_name,
        f.user_email,
        f.league_name,
        f.row_count,
        f.problems.join(" + "),
        f.good_role ? (f.good_role + (f.good_player ? " / " + f.good_player : "")) : "none",
      ].join("\t")
    );
    try {
      await navigator.clipboard.writeText([header].concat(lines).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_e) {
      setError("Could not copy. Select the table and copy manually.");
    }
  };

  const chip = (kind) => {
    const map = {
      duplicate: { label: "Duplicate", cls: "bg-amber-100 text-amber-800" },
      no_role: { label: "No role", cls: "bg-red-100 text-red-800" },
      no_link: { label: "No roster link", cls: "bg-indigo-100 text-indigo-800" },
    };
    const m = map[kind];
    if (!m) return null;
    return (
      <span key={kind} className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold mr-1 ${m.cls}`}>
        {m.label}
      </span>
    );
  };

  return (
    <Card className="border-slate-200 shadow-lg">
      <CardHeader className="border-b border-slate-200 bg-white">
        <CardTitle className="text-xl flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-orange-600" />
          Identity Health Check
        </CardTitle>
        <p className="text-sm text-slate-600 mt-2">
          Finds accounts whose league identity records are broken or duplicated — usually left behind by
          the retired post-approval pop-up. Read-only: nothing is changed or deleted. App admin only.
        </p>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Button
            onClick={runCheck}
            disabled={busy}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${busy ? "animate-spin" : ""}`} />
            {busy ? "Checking…" : "Run check"}
          </Button>
          {result && result.findings.length > 0 && (
            <Button onClick={copyResults} variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">
              {copied ? <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied" : "Copy results"}
            </Button>
          )}
          {result && (
            <span className="text-xs text-slate-500">
              Last run: {result.ran_at} · {result.leagues_scanned} leagues scanned
            </span>
          )}
        </div>

        {busy && (
          <div className="text-sm text-slate-600">
            Reading one league at a time — this takes a few seconds.
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}

        {result && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border border-slate-200 rounded-lg p-3">
                <div className="text-2xl font-bold text-slate-900">{result.total_rows}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-1">Identity records</div>
              </div>
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-amber-700">{result.dup_count}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-1">Duplicate rows</div>
              </div>
              <div className="border border-red-200 bg-red-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-red-700">{result.no_role_count}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-1">Missing role</div>
              </div>
              <div className="border border-green-200 bg-green-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-700">{result.accounts_affected}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-1">Accounts affected</div>
              </div>
            </div>

            {result.findings.length === 0 ? (
              <div className="text-center py-8 text-green-700 text-sm">
                ✓ No problems found. {result.total_rows} identity records across {result.leagues_scanned} leagues,
                all with a role and no duplicates.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left text-[11px] uppercase tracking-wide text-slate-500 font-semibold px-3 py-2">Account</th>
                      <th className="text-left text-[11px] uppercase tracking-wide text-slate-500 font-semibold px-3 py-2">League</th>
                      <th className="text-left text-[11px] uppercase tracking-wide text-slate-500 font-semibold px-3 py-2">Rows</th>
                      <th className="text-left text-[11px] uppercase tracking-wide text-slate-500 font-semibold px-3 py-2">Problem</th>
                      <th className="text-left text-[11px] uppercase tracking-wide text-slate-500 font-semibold px-3 py-2">Good row</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.findings.map((f, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2.5 align-top">
                          <div className="font-semibold text-slate-800">{f.user_name}</div>
                          <div className="text-xs text-slate-500">{f.user_email}</div>
                        </td>
                        <td className="px-3 py-2.5 align-top text-slate-700">{f.league_name}</td>
                        <td className="px-3 py-2.5 align-top text-slate-700">{f.row_count}</td>
                        <td className="px-3 py-2.5 align-top">{f.problems.map((p) => chip(p))}</td>
                        <td className="px-3 py-2.5 align-top text-xs text-slate-500 font-mono">
                          {f.good_role ? `${f.good_role}${f.good_player ? " · " + f.good_player : ""}` : "— none —"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
              <b className="text-slate-800">Duplicate</b> — more than one identity record for the same account in the
              same league. One is usually the correct one from approval; the extra came from the old pop-up.<br />
              <b className="text-slate-800">No role</b> — the record has no role saved, so league pages can't tell what
              this person is.<br />
              <b className="text-slate-800">No roster link</b> — a player record not tied to a roster player, so stats
              won't attach to their profile.
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
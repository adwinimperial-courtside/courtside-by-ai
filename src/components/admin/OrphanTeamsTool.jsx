import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Copy, AlertTriangle, CheckCircle2, X } from "lucide-react";

const MARKER = "ORPHAN_TEAMS_V2";

const listAll = async (entityName, sort = "-created_date") => {
  const PAGE = 1000;
  const MAX_PAGES = 30;
  let all = [];
  let skip = 0;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await base44.entities[entityName].list(sort, PAGE, skip);
    if (!page || page.length === 0) break;
    all = all.concat(page);
    skip += page.length;
    if (page.length < PAGE) break;
  }
  return all;
};

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export default function OrphanTeamsTool() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [copying, setCopying] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [groups, setGroups] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [selected, setSelected] = useState({});
  const [targetIds, setTargetIds] = useState([]);
  const [pickerKey, setPickerKey] = useState(0);

  const { data: currentUser } = useQuery({
    queryKey: ["user"],
    queryFn: () => base44.auth.me(),
  });

  const isAppAdmin = currentUser?.user_type === "app_admin";
  if (currentUser && !isAppAdmin) return null;

  const findOrphans = async () => {
    setBusy(true);
    setError("");
    setSuccess("");
    setGroups(null);
    setSelected({});
    try {
      const [leagues, teams, leagueGroups] = await Promise.all([
        listAll("League"),
        listAll("Team"),
        base44.entities.LeagueGroup.list().catch(() => []),
      ]);
      if (!leagues || leagues.length === 0) {
        throw new Error("No seasons came back, so the check was stopped to avoid false results. Try again.");
      }
      let deleteLogs = [];
      try {
        deleteLogs = await base44.entities.LeagueAuditLog.filter({ action: "delete" });
      } catch (_e) {
        deleteLogs = [];
      }

      const liveIds = new Set(leagues.map((l) => l.id));
      const groupName = {};
      (leagueGroups || []).forEach((g) => { groupName[g.id] = g.name || ""; });

      const logById = {};
      (deleteLogs || []).forEach((log) => {
        if (!log || !log.league_id) return;
        const prev = logById[log.league_id];
        if (!prev || (log.performed_at || "") > (prev.performed_at || "")) logById[log.league_id] = log;
      });

      const byLeague = {};
      (teams || []).forEach((t) => {
        if (!t || !t.league_id || liveIds.has(t.league_id)) return;
        if (!byLeague[t.league_id]) byLeague[t.league_id] = [];
        byLeague[t.league_id].push(t);
      });

      const result = [];
      for (const leagueId of Object.keys(byLeague)) {
        let games = [];
        try {
          games = await base44.entities.Game.filter({ league_id: leagueId });
        } catch (_e) {
          games = [];
        }
        const rows = [];
        for (const t of byLeague[leagueId]) {
          let players = [];
          try {
            players = await base44.entities.Player.filter({ team_id: t.id });
          } catch (_e) {
            players = [];
          }
          const gameCount = (games || []).filter((g) => g.home_team_id === t.id || g.away_team_id === t.id).length;
          rows.push({ team: t, playerCount: (players || []).length, gameCount });
        }
        rows.sort((a, b) => (a.team.name || "").localeCompare(b.team.name || ""));
        const log = logById[leagueId];
        result.push({
          leagueId,
          name: log?.league_name || "Unknown season",
          deletedBy: log?.performed_by || "",
          deletedAt: fmtDate(log?.performed_at),
          rows,
        });
      }
      result.sort((a, b) => a.name.localeCompare(b.name));

      const live = leagues
        .filter((l) => !l.is_archived)
        .map((l) => ({
          id: l.id,
          label: (groupName[l.group_id] ? groupName[l.group_id] + " — " : "") + (l.name || "Unnamed") + (l.season ? " (" + l.season + ")" : ""),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setSeasons(live);
      setGroups(result);
    } catch (err) {
      setError(err?.message || "Check failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const selectedRows = (groups || []).flatMap((g) => g.rows).filter((r) => selected[r.team.id]);
  const targets = targetIds.map((id) => seasons.find((s) => s.id === id)).filter(Boolean);
  const availableSeasons = seasons.filter((s) => !targetIds.includes(s.id));

  const addTarget = (id) => {
    setSuccess("");
    setError("");
    if (id && !targetIds.includes(id)) setTargetIds((prev) => [...prev, id]);
    setPickerKey((k) => k + 1);
  };

  const removeTarget = (id) => {
    setSuccess("");
    setTargetIds((prev) => prev.filter((x) => x !== id));
  };

  const toggle = (id) => {
    setSuccess("");
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyTeams = async () => {
    setError("");
    setSuccess("");
    if (selectedRows.length === 0) {
      setError("Tick at least one team first.");
      return;
    }
    if (targets.length === 0) {
      setError("Add at least one season to copy into first.");
      return;
    }
    const teamWord = selectedRows.length + " team" + (selectedRows.length === 1 ? "" : "s");
    const ok = window.confirm(
      "Copy " + teamWord + " with their rosters into " + targets.length + " season" + (targets.length === 1 ? "" : "s") + "?\n\n" +
      targets.map((t) => "• " + t.label).join("\n") +
      "\n\nEach season gets its own copy. The original orphan teams stay where they are."
    );
    if (!ok) return;

    setCopying(true);
    const summaries = [];
    let current = null;
    try {
      for (const target of targets) {
        current = { label: target.label, copied: 0, players: 0, skipped: [] };
        const existing = await base44.entities.Team.filter({ league_id: target.id });
        const existingNames = new Set((existing || []).map((t) => (t.name || "").trim().toLowerCase()));

        for (let i = 0; i < selectedRows.length; i++) {
          const team = selectedRows[i].team;
          setProgress(target.label + ": copying " + (i + 1) + " of " + selectedRows.length + " (" + team.name + ")");
          const key = (team.name || "").trim().toLowerCase();
          if (existingNames.has(key)) {
            current.skipped.push(team.name);
            continue;
          }
          const teamData = { league_id: target.id, name: team.name, wins: 0, losses: 0 };
          if (team.logo_url) teamData.logo_url = team.logo_url;
          if (team.color) teamData.color = team.color;
          if (team.description) teamData.description = team.description;
          if (team.head_coach) teamData.head_coach = team.head_coach;
          if (team.manager) teamData.manager = team.manager;
          if (team.team_captain) teamData.team_captain = team.team_captain;
          const newTeam = await base44.entities.Team.create(teamData);

          const roster = await base44.entities.Player.filter({ team_id: team.id });
          for (const p of roster || []) {
            const playerData = { team_id: newTeam.id, name: p.name };
            if (p.jersey_number !== undefined && p.jersey_number !== null && p.jersey_number !== "") playerData.jersey_number = p.jersey_number;
            if (p.position) playerData.position = p.position;
            if (p.photo_url) playerData.photo_url = p.photo_url;
            await base44.entities.Player.create(playerData);
            current.players++;
          }
          existingNames.add(key);
          current.copied++;
        }

        try {
          await base44.entities.LeagueAuditLog.create({
            action: "copy_orphan_teams",
            league_id: target.id,
            league_name: target.label,
            performed_by: currentUser?.email || "",
            performed_by_name: currentUser?.full_name || "",
            performed_at: new Date().toISOString(),
            notes: MARKER + ": copied " + current.copied + " team(s), " + current.players + " player(s)" +
              (current.skipped.length ? "; skipped (already in season): " + current.skipped.join(", ") : ""),
          });
        } catch (_e) {}

        summaries.push(current);
        current = null;
      }

      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["players"] });
      setSelected({});
      setTargetIds([]);
      setSuccess(
        summaries.map((r) =>
          r.label + ": copied " + r.copied + " team" + (r.copied === 1 ? "" : "s") + " (" + r.players + " players)" +
          (r.skipped.length ? ", skipped (already there): " + r.skipped.join(", ") : "")
        ).join(" · ")
      );
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["players"] });
      const done = summaries.map((r) => r.label + " (" + r.copied + " copied)").join(", ");
      setError(
        "Copy stopped" + (current ? " in " + current.label + " after " + current.copied + " team" + (current.copied === 1 ? "" : "s") : "") + ". " +
        (done ? "Finished: " + done + ". " : "") +
        (err?.message || "") + " Check the seasons before trying again — teams already copied will be skipped."
      );
    } finally {
      setCopying(false);
      setProgress("");
    }
  };

  const totalOrphans = (groups || []).reduce((n, g) => n + g.rows.length, 0);

  return (
    <Card className="border-slate-200 shadow-lg" data-marker={MARKER}>
      <CardHeader className="border-b border-slate-200 bg-white">
        <CardTitle className="text-xl flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-600" />
          Orphan Teams
        </CardTitle>
        <p className="text-sm text-slate-600 mt-2">
          Teams left behind when their season was deleted. Copy them, with their rosters, into one or more existing seasons.
          The originals stay, so the same team can be copied into more than one season. App admin only.
        </p>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <Button
          onClick={findOrphans}
          disabled={busy || copying}
          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50"
        >
          <Search className={`w-4 h-4 mr-2 ${busy ? "animate-pulse" : ""}`} />
          {busy ? "Searching…" : "Find orphan teams"}
        </Button>

        {error && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-red-600 hover:text-red-800 font-semibold">×</button>
          </div>
        )}

        {success && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <span className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />{success}</span>
            <button onClick={() => setSuccess("")} className="text-green-600 hover:text-green-800 font-semibold">×</button>
          </div>
        )}

        {groups && groups.length === 0 && (
          <p className="text-sm text-green-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> No orphan teams found.
          </p>
        )}

        {groups && groups.length > 0 && (
          <>
            <p className="text-sm text-slate-600">{totalOrphans} orphan team{totalOrphans === 1 ? "" : "s"} found.</p>
            {groups.map((g) => (
              <div key={g.leagueId} className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 border-b border-slate-200 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Deleted season: <span className="font-semibold">{g.name}</span>
                    {g.deletedAt ? " · deleted " + g.deletedAt : ""}
                    {g.deletedBy ? " by " + g.deletedBy : ""}
                    {" · " + g.rows.length + " team" + (g.rows.length === 1 ? "" : "s")}
                  </span>
                </div>
                {g.rows.map((r, i) => (
                  <label
                    key={r.team.id}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${i < g.rows.length - 1 ? "border-b border-slate-100" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={!!selected[r.team.id]}
                      onChange={() => toggle(r.team.id)}
                      disabled={copying}
                      className="w-4 h-4 accent-orange-600"
                    />
                    <span className="flex-1 text-slate-900">{r.team.name}</span>
                    <span className="text-xs text-slate-500">
                      {r.playerCount} player{r.playerCount === 1 ? "" : "s"} · {r.gameCount} game{r.gameCount === 1 ? "" : "s"}
                    </span>
                  </label>
                ))}
              </div>
            ))}

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-slate-600">Copy selected into</span>
                <Select key={pickerKey} onValueChange={addTarget} disabled={copying || availableSeasons.length === 0}>
                  <SelectTrigger className="w-80 max-w-full">
                    <SelectValue placeholder={availableSeasons.length === 0 ? "All seasons added" : "Add a season…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSeasons.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {targets.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {targets.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 px-3 py-1 text-sm text-orange-800">
                      {t.label}
                      <button
                        onClick={() => removeTarget(t.id)}
                        disabled={copying}
                        aria-label={"Remove " + t.label}
                        className="text-orange-600 hover:text-orange-900 disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Button
                onClick={copyTeams}
                disabled={copying || busy}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
              >
                <Copy className="w-4 h-4 mr-2" />
                {copying
                  ? "Copying…"
                  : "Copy " + selectedRows.length + " team" + (selectedRows.length === 1 ? "" : "s") +
                    " into " + targets.length + " season" + (targets.length === 1 ? "" : "s")}
              </Button>
            </div>
            {progress && <p className="text-xs text-slate-500">{progress}</p>}
            <p className="text-xs text-slate-500">
              Each season gets its own copy of every ticked team and roster. Wins and losses start at 0. Rosters copy names,
              jersey numbers, positions and photos. Teams already in a season (same name) are skipped there. Linked player accounts must claim their spot again in the new season.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Copy, AlertTriangle, CheckCircle2 } from "lucide-react";

const MARKER = "ORPHAN_TEAMS_V1";

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
  const [targetId, setTargetId] = useState("");

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
  const target = seasons.find((s) => s.id === targetId);

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
    if (!target) {
      setError("Choose the season to copy into first.");
      return;
    }
    const ok = window.confirm(
      "Copy " + selectedRows.length + " team" + (selectedRows.length === 1 ? "" : "s") +
      " with their rosters into " + target.label + "?\n\nThe original orphan teams stay where they are."
    );
    if (!ok) return;

    setCopying(true);
    let copied = 0;
    let playersCopied = 0;
    const skipped = [];
    try {
      const existing = await base44.entities.Team.filter({ league_id: target.id });
      const existingNames = new Set((existing || []).map((t) => (t.name || "").trim().toLowerCase()));

      for (let i = 0; i < selectedRows.length; i++) {
        const team = selectedRows[i].team;
        setProgress("Copying " + (i + 1) + " of " + selectedRows.length + ": " + team.name);
        const key = (team.name || "").trim().toLowerCase();
        if (existingNames.has(key)) {
          skipped.push(team.name);
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
          playersCopied++;
        }
        existingNames.add(key);
        copied++;
      }

      try {
        await base44.entities.LeagueAuditLog.create({
          action: "copy_orphan_teams",
          league_id: target.id,
          league_name: target.label,
          performed_by: currentUser?.email || "",
          performed_by_name: currentUser?.full_name || "",
          performed_at: new Date().toISOString(),
          notes: MARKER + ": copied " + copied + " team(s), " + playersCopied + " player(s)" +
            (skipped.length ? "; skipped (already in season): " + skipped.join(", ") : ""),
        });
      } catch (_e) {}

      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["players"] });
      setSelected({});
      setSuccess(
        "Copied " + copied + " team" + (copied === 1 ? "" : "s") + " (" + playersCopied + " players) into " + target.label + "." +
        (skipped.length ? " Skipped, already in that season: " + skipped.join(", ") + "." : "")
      );
    } catch (err) {
      setError(
        "Copy stopped after " + copied + " team" + (copied === 1 ? "" : "s") + ". " +
        (err?.message || "") + " Check the season before trying again."
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
          Teams left behind when their season was deleted. Copy them, with their rosters, into an existing season.
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

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-600">Copy selected into</span>
              <Select value={targetId} onValueChange={(v) => { setTargetId(v); setSuccess(""); }} disabled={copying}>
                <SelectTrigger className="w-80 max-w-full">
                  <SelectValue placeholder="Choose a season…" />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={copyTeams}
                disabled={copying || busy}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
              >
                <Copy className="w-4 h-4 mr-2" />
                {copying ? "Copying…" : "Copy " + selectedRows.length + " team" + (selectedRows.length === 1 ? "" : "s")}
              </Button>
            </div>
            {progress && <p className="text-xs text-slate-500">{progress}</p>}
            <p className="text-xs text-slate-500">
              Wins and losses start at 0. Rosters copy names, jersey numbers, positions and photos. Teams already in the
              chosen season (same name) are skipped. Linked player accounts must claim their spot again in the new season.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
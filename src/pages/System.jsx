import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Settings2, HardDrive, Trash2, Download, Upload, Database,
  CheckCircle, AlertTriangle, Loader2, Key, User, Calendar, Hash,
  CalendarOff, RefreshCw, ListChecks, Mail
} from "lucide-react";

// ─── Data Backup constants ───────────────────────────────────────────────────
const ENTITIES = [
  "League", "Team", "Player", "Game", "PlayerStats", "GameLog",
  "UserApplication", "UserLeagueIdentity", "TacticalBriefing",
  "AIUsageCounter", "PendingUserAssignment", "LeagueSetupRequest",
  "LeagueAccessRequest", "DeletionLog", "LoginEvent", "User"
];
const CONFIRMATION_PHRASE = "RESTORE MISSING DATA";

export default function System() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  if (currentUser && currentUser.user_type !== "app_admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center max-w-sm">
          <Key className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Page header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-800 rounded-2xl flex items-center justify-center shadow-lg">
            <Settings2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">System</h1>
            <p className="text-slate-500 text-sm mt-0.5">Maintenance and system operations</p>
          </div>
        </div>

        <Tabs defaultValue="backup">
          <TabsList className="mb-6">
            <TabsTrigger value="backup" className="flex items-center gap-2">
              <HardDrive className="w-4 h-4" /> Data Backup
            </TabsTrigger>
            <TabsTrigger
              value="delete"
              className="flex items-center gap-2 data-[state=active]:text-red-600 data-[state=active]:border-red-600"
            >
              <Trash2 className="w-4 h-4" /> Delete League
            </TabsTrigger>
            <TabsTrigger
              value="dormant"
              className="flex items-center gap-2 data-[state=active]:text-amber-700 data-[state=active]:border-amber-600"
            >
              <CalendarOff className="w-4 h-4" /> Dormant Leagues
            </TabsTrigger>
          </TabsList>

          <TabsContent value="backup">
            <DataBackupTab />
          </TabsContent>

          <TabsContent value="delete">
            <DeleteLeagueTab currentUser={currentUser} />
          </TabsContent>

          <TabsContent value="dormant">
            <DormantLeaguesTab currentUser={currentUser} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Data Backup Tab ──────────────────────────────────────────────────────────
function DataBackupTab() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState(null);
  const [backupProgress, setBackupProgress] = useState([]);
  const [pendingFile, setPendingFile] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const fileInputRef = useRef(null);

  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupProgress([]);
    const backup = { version: "1.0", created_at: new Date().toISOString(), entities: {} };
    for (const entity of ENTITIES) {
      try {
        const PAGE_SIZE = 5000;
        let allRecords = [];
        let skip = 0;
        while (true) {
          const page = await base44.entities[entity].list('-created_date', PAGE_SIZE, skip);
          allRecords = allRecords.concat(page);
          if (page.length < PAGE_SIZE) break;
          skip += PAGE_SIZE;
        }
        backup.entities[entity] = allRecords;
        setBackupProgress(prev => [...prev, { entity, count: allRecords.length, status: "ok" }]);
      } catch {
        backup.entities[entity] = [];
        setBackupProgress(prev => [...prev, { entity, count: 0, status: "error" }]);
      }
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `courtside-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsBackingUp(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setConfirmInput("");
    setShowConfirmDialog(true);
    e.target.value = "";
  };

  const handleConfirmedRestore = async () => {
    if (!pendingFile || confirmInput !== CONFIRMATION_PHRASE) return;
    setShowConfirmDialog(false);
    setIsRestoring(true);
    setRestoreStatus(null);
    try {
      const text = await pendingFile.text();
      const backup = JSON.parse(text);
      if (!backup.entities) throw new Error("Invalid backup file format.");
      const counts = {};
      for (const entity of ENTITIES) {
        if (entity === "User") {
          counts[entity] = { restored: 0, skipped: 0, userSkipped: true };
          continue;
        }
        const records = backup.entities[entity];
        if (!records || records.length === 0) { counts[entity] = { restored: 0, skipped: 0 }; continue; }
        const PAGE_SIZE = 5000;
        let existing = [];
        let skip = 0;
        while (true) {
          const page = await base44.entities[entity].list('-created_date', PAGE_SIZE, skip);
          existing = existing.concat(page);
          if (page.length < PAGE_SIZE) break;
          skip += PAGE_SIZE;
        }
        const existingIds = new Set(existing.map(r => r.id));
        const missing = records.filter(r => !existingIds.has(r.id));
        if (missing.length > 0) await base44.entities[entity].bulkCreate(missing);
        counts[entity] = { restored: missing.length, skipped: records.length - missing.length };
      }
      setRestoreStatus({ success: true, message: "Additive restore completed successfully!", counts });
    } catch (err) {
      setRestoreStatus({ success: false, message: "Restore failed: " + err.message, counts: {} });
    } finally {
      setIsRestoring(false);
      setPendingFile(null);
    }
  };

  const totalBackedUp = backupProgress.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="grid gap-6">
      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="border-b border-slate-200 bg-slate-50">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Download className="w-5 h-5 text-blue-600" /> Create Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-slate-600">Downloads a complete JSON snapshot of all entities.</p>
          <div className="flex flex-wrap gap-2">
            {ENTITIES.map(e => <Badge key={e} variant="outline" className="text-xs">{e}</Badge>)}
          </div>
          <Button onClick={handleBackup} disabled={isBackingUp} className="bg-blue-600 hover:bg-blue-700 text-white">
            {isBackingUp ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Backing up...</> : <><Download className="w-4 h-4 mr-2" /> Download Backup</>}
          </Button>
          {backupProgress.length > 0 && !isBackingUp && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800">Backup complete — {totalBackedUp.toLocaleString()} total records</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {backupProgress.map(p => (
                  <div key={p.entity} className="flex justify-between bg-white rounded px-2 py-1 border border-green-100">
                    <span className="text-slate-600">{p.entity}</span>
                    <span className="font-semibold text-slate-800">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-orange-200 shadow-lg">
        <CardHeader className="border-b border-orange-200 bg-orange-50">
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <Upload className="w-5 h-5 text-orange-600" /> Restore from Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 flex gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Safe additive restore</p>
              <p>This will recover records that are missing from the app. Existing data will NOT be changed or deleted. User records are always skipped.</p>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
          <Button onClick={() => fileInputRef.current?.click()} disabled={isRestoring} variant="outline" className="border-orange-400 text-orange-700 hover:bg-orange-50">
            {isRestoring ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Restoring...</> : <><Upload className="w-4 h-4 mr-2" /> Select Backup File (.json)</>}
          </Button>
          {restoreStatus && (
            <div className={`border rounded-lg p-4 ${restoreStatus.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {restoreStatus.success ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
                <span className={`font-semibold ${restoreStatus.success ? 'text-green-800' : 'text-red-800'}`}>{restoreStatus.message}</span>
              </div>
              {restoreStatus.success && Object.keys(restoreStatus.counts).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mt-3">
                  {Object.entries(restoreStatus.counts).map(([entity, c]) => (
                    <div key={entity} className="flex flex-col bg-white rounded px-2 py-1.5 border border-green-100">
                      <span className="text-slate-600 font-medium">{entity}</span>
                      {c.userSkipped
                        ? <span className="text-slate-400 italic">Skipped — managed by auth system</span>
                        : <span className="text-slate-700"><span className="text-green-700 font-semibold">+{c.restored} restored</span>{c.skipped > 0 && <span className="text-slate-400"> · {c.skipped} skipped</span>}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={(open) => { if (!open) { setShowConfirmDialog(false); setPendingFile(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-700">
              <Upload className="w-5 h-5" /> Confirm Additive Restore
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p className="text-slate-700">This will recover records that are missing from the app. <strong>Existing data will NOT be changed or deleted.</strong> User records are always skipped.</p>
              <p className="text-slate-700">File: <span className="font-semibold">{pendingFile?.name}</span></p>
              <div className="pt-2">
                <p className="text-sm font-medium text-slate-700 mb-2">Type <span className="font-bold text-blue-600">{CONFIRMATION_PHRASE}</span> to proceed:</p>
                <Input value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} placeholder={CONFIRMATION_PHRASE} className="border-blue-300 focus-visible:ring-blue-400" />
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="outline" onClick={() => { setShowConfirmDialog(false); setPendingFile(null); }}>Cancel</Button>
            <Button disabled={confirmInput !== CONFIRMATION_PHRASE} onClick={handleConfirmedRestore} className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40">
              <Upload className="w-4 h-4 mr-2" /> Restore Missing Data
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Delete League Tab ────────────────────────────────────────────────────────
function DeleteLeagueTab({ currentUser }) {
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const queryClient = useQueryClient();

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
    enabled: currentUser?.user_type === "app_admin",
  });

  const selectedLeague = leagues.find((l) => l.id === selectedLeagueId);
  const confirmationPhrase = selectedLeague ? selectedLeague.name : "";
  const canDelete = confirmText === confirmationPhrase && !!selectedLeagueId;

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      const [games, teams, players] = await Promise.all([
        base44.entities.Game.filter({ league_id: selectedLeagueId }),
        base44.entities.Team.filter({ league_id: selectedLeagueId }),
        base44.entities.Player.list(),
      ]);
      const teamIds = teams.map((t) => t.id);
      const leaguePlayers = players.filter((p) => teamIds.includes(p.team_id));
      const gameIds = games.map((g) => g.id);
      const [allStats, allLogs] = await Promise.all([
        base44.entities.PlayerStats.list(),
        base44.entities.GameLog.list(),
      ]);
      const statsToDelete = allStats.filter((s) => gameIds.includes(s.game_id));
      const logsToDelete = allLogs.filter((l) => gameIds.includes(l.game_id));
      await Promise.all([
        ...statsToDelete.map((s) => base44.entities.PlayerStats.delete(s.id)),
        ...logsToDelete.map((l) => base44.entities.GameLog.delete(l.id)),
      ]);
      await Promise.all(games.map((g) => base44.entities.Game.delete(g.id)));
      await Promise.all(leaguePlayers.map((p) => base44.entities.Player.delete(p.id)));
      await Promise.all(teams.map((t) => base44.entities.Team.delete(t.id)));
      await base44.entities.League.delete(selectedLeagueId);
      queryClient.invalidateQueries({ queryKey: ["leagues"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
      alert(`League "${confirmationPhrase}" and all associated data have been permanently deleted.`);
      setSelectedLeagueId("");
      setConfirmText("");
    } catch (error) {
      alert("Error deleting league: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="border-red-200 shadow-lg">
      <CardHeader className="bg-red-50 border-b border-red-200">
        <CardTitle className="text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Danger Zone — This action is irreversible
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 space-y-1">
          <p className="font-semibold">The following data will be permanently deleted:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>The league record</li>
            <li>All teams in the league</li>
            <li>All players on those teams</li>
            <li>All games and their player statistics</li>
            <li>All game logs</li>
          </ul>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Select League to Delete</label>
          <Select value={selectedLeagueId} onValueChange={(v) => { setSelectedLeagueId(v); setConfirmText(""); }}>
            <SelectTrigger><SelectValue placeholder="Choose a league..." /></SelectTrigger>
            <SelectContent>
              {leagues.map((league) => (
                <SelectItem key={league.id} value={league.id}>{league.name} ({league.season})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedLeague && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-sm">
            <p className="font-semibold text-slate-700 mb-2">League Details</p>
            <div className="flex items-center gap-2 text-slate-600">
              <Hash className="w-4 h-4 flex-shrink-0 text-slate-400" />
              <span className="font-medium">ID:</span>
              <span className="font-mono text-xs bg-slate-200 px-2 py-0.5 rounded">{selectedLeague.id}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <User className="w-4 h-4 flex-shrink-0 text-slate-400" />
              <span className="font-medium">Created by:</span>
              <span>{selectedLeague.created_by || "Unknown"}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="w-4 h-4 flex-shrink-0 text-slate-400" />
              <span className="font-medium">Created on:</span>
              <span>{selectedLeague.created_date ? new Date(selectedLeague.created_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Unknown"}</span>
            </div>
          </div>
        )}

        {selectedLeague && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Type <span className="font-bold text-red-600">"{confirmationPhrase}"</span> to confirm deletion
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type league name to confirm..."
              className="w-full px-3 py-2 border border-input rounded-md text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        )}

        <Button onClick={handleDelete} disabled={!canDelete || isDeleting} className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-40">
          <Trash2 className="w-4 h-4 mr-2" />
          {isDeleting ? "Deleting..." : "Permanently Delete League"}
        </Button>
      </CardContent>
    </Card>
  );
}
// ─── Dormant Leagues Tab ──────────────────────────────────────────────────────
function DormantLeaguesTab({ currentUser }) {
  const [thresholdDays, setThresholdDays] = useState(30);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [banner, setBanner] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkConfirmText, setBulkConfirmText] = useState("");
  const [pendingSingle, setPendingSingle] = useState(null);
  const queryClient = useQueryClient();

  const isAdmin = currentUser?.user_type === "app_admin";

  const fetchAll = async (entityName) => {
    const PAGE_SIZE = 5000;
    let all = [];
    let skip = 0;
    while (true) {
      const page = await base44.entities[entityName].list("-created_date", PAGE_SIZE, skip);
      all = all.concat(page);
      if (page.length < PAGE_SIZE) break;
      skip += PAGE_SIZE;
    }
    return all;
  };

  const { data: leagues = [], isLoading: leaguesLoading } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => fetchAll("League"),
    enabled: isAdmin,
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => fetchAll("Team"),
    enabled: isAdmin,
  });

  const { data: warnings = [] } = useQuery({
    queryKey: ["dormantWarnings"],
    queryFn: () => fetchAll("DormantWarning"),
    enabled: isAdmin,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchAll("User"),
    enabled: isAdmin,
  });

  const [isWarning, setIsWarning] = useState(false);

  const loading = leaguesLoading || teamsLoading;

  // Most recent warning per league (by warned_at).
  const warningByLeague = React.useMemo(() => {
    const map = {};
    for (const w of warnings) {
      if (!w.league_id) continue;
      const prev = map[w.league_id];
      if (!prev || new Date(w.warned_at) > new Date(prev.warned_at)) map[w.league_id] = w;
    }
    return map;
  }, [warnings]);

  // Real admin per league: the league_admin User whose assigned_league_ids
  // includes this league. This is the authoritative link — older leagues have
  // no owner_email stamped on the League record itself.
  const adminByLeague = React.useMemo(() => {
    const map = {};
    for (const u of users) {
      if (u.user_type !== "league_admin") continue;
      const ids = Array.isArray(u.assigned_league_ids) ? u.assigned_league_ids : [];
      for (const id of ids) {
        if (!map[id] && u.email) map[id] = { email: u.email, name: u.full_name || u.email };
      }
    }
    return map;
  }, [users]);

  const ownerEmailOf = (l) => (adminByLeague[l.id]?.email) || l.owner_email || "";
  const ownerNameOf = (l) => (adminByLeague[l.id]?.name) || l.owner_name || "";

  const warnStatusOf = (league) => {
    const w = warningByLeague[league.id];
    if (!w) return { state: "none" };
    const msLeft = new Date(w.deadline).getTime() - Date.now();
    if (msLeft <= 0) return { state: "passed" };
    return { state: "warned", daysLeft: Math.ceil(msLeft / 86400000) };
  };

  const teamCountByLeague = React.useMemo(() => {
    const map = {};
    for (const t of teams) {
      if (!t.league_id) continue;
      map[t.league_id] = (map[t.league_id] || 0) + 1;
    }
    return map;
  }, [teams]);

  const dormant = React.useMemo(() => {
    const now = Date.now();
    const rows = [];
    for (const league of leagues) {
      const teamCount = teamCountByLeague[league.id] || 0;
      if (teamCount > 0) continue;
      const lastActivityStr = league.updated_date || league.created_date;
      if (!lastActivityStr) continue;
      const lastActivity = new Date(lastActivityStr).getTime();
      if (isNaN(lastActivity)) continue;
      const daysDormant = Math.floor((now - lastActivity) / 86400000);
      if (daysDormant <= thresholdDays) continue;
      rows.push({ ...league, daysDormant });
    }
    rows.sort((a, b) => b.daysDormant - a.daysDormant);
    return rows;
  }, [leagues, teamCountByLeague, thresholdDays]);

  const dormantIds = React.useMemo(() => new Set(dormant.map((l) => l.id)), [dormant]);

  React.useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set();
      for (const id of prev) if (dormantIds.has(id)) next.add(id);
      return next;
    });
  }, [dormantIds]);

  const allSelected = dormant.length > 0 && dormant.every((l) => selectedIds.has(l.id));
  const selectedCount = selectedIds.size;

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(dormant.map((l) => l.id)));
  };

  const rescan = () => {
    queryClient.invalidateQueries({ queryKey: ["leagues"] });
    queryClient.invalidateQueries({ queryKey: ["teams"] });
    setBanner(null);
  };

  const badgeClass = (days) => {
    if (days >= 90) return "bg-red-100 text-red-700";
    if (days >= 45) return "bg-orange-100 text-orange-700";
    return "bg-amber-100 text-amber-700";
  };

  const deleteOneLeague = async (leagueId) => {
    try {
      const teamsNow = await base44.entities.Team.filter({ league_id: leagueId });
      if (teamsNow.length > 0) return "skipped";
      const games = await base44.entities.Game.filter({ league_id: leagueId });
      const gameIds = games.map((g) => g.id);
      if (gameIds.length > 0) {
        const [allStats, allLogs] = await Promise.all([
          base44.entities.PlayerStats.list(),
          base44.entities.GameLog.list(),
        ]);
        const gset = new Set(gameIds);
        await Promise.all([
          ...allStats.filter((s) => gset.has(s.game_id)).map((s) => base44.entities.PlayerStats.delete(s.id)),
          ...allLogs.filter((l) => gset.has(l.game_id)).map((l) => base44.entities.GameLog.delete(l.id)),
        ]);
        await Promise.all(games.map((g) => base44.entities.Game.delete(g.id)));
      }
      await base44.entities.League.delete(leagueId);
      return "deleted";
    } catch {
      return "error";
    }
  };

  const handleSingleDelete = async () => {
    if (!pendingSingle) return;
    const target = pendingSingle;
    setPendingSingle(null);
    setIsDeleting(true);
    setBanner(null);
    const result = await deleteOneLeague(target.id);
    queryClient.invalidateQueries({ queryKey: ["leagues"] });
    queryClient.invalidateQueries({ queryKey: ["teams"] });
    queryClient.invalidateQueries({ queryKey: ["games"] });
    setIsDeleting(false);
    if (result === "deleted") setBanner({ type: "success", text: `Deleted "${target.name}".` });
    else if (result === "skipped") setBanner({ type: "error", text: `"${target.name}" now has at least one team — skipped, not deleted.` });
    else setBanner({ type: "error", text: `Could not delete "${target.name}". Please try again.` });
  };

  const handleBulkDelete = async () => {
    setShowBulkConfirm(false);
    setBulkConfirmText("");
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setIsDeleting(true);
    setBanner(null);
    let deleted = 0, skipped = 0, errors = 0;
    setProgress({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      const result = await deleteOneLeague(ids[i]);
      if (result === "deleted") deleted++;
      else if (result === "skipped") skipped++;
      else errors++;
      setProgress({ done: i + 1, total: ids.length });
    }
    queryClient.invalidateQueries({ queryKey: ["leagues"] });
    queryClient.invalidateQueries({ queryKey: ["teams"] });
    queryClient.invalidateQueries({ queryKey: ["games"] });
    setSelectedIds(new Set());
    setProgress(null);
    setIsDeleting(false);
    const parts = [`Deleted ${deleted} league${deleted === 1 ? "" : "s"}.`];
    if (skipped > 0) parts.push(`Skipped ${skipped} (gained a team since the scan).`);
    if (errors > 0) parts.push(`${errors} failed — try again.`);
    setBanner({ type: errors > 0 ? "error" : "success", text: parts.join(" ") });
  };

  const sendWarning = async (league) => {
    const email = ownerEmailOf(league);
    if (!email) { setBanner({ type: "error", text: `"${league.name}" has no admin email on file.` }); return; }
    setIsWarning(true);
    setBanner(null);
    try {
      const res = await base44.functions.invoke("sendDormantWarningEmail", {
        league_id: league.id, league_name: league.name, owner_email: email,
        owner_name: ownerNameOf(league), days_dormant: league.daysDormant,
      });
      const d = res?.data || res || {};
      if (d.success) setBanner({ type: "success", text: `Warning sent to ${email} for "${league.name}". 3-day countdown started.` });
      else setBanner({ type: "error", text: d.reason || d.error || `Could not send warning for "${league.name}".` });
    } catch (e) {
      setBanner({ type: "error", text: `Could not send warning for "${league.name}".` });
    }
    setIsWarning(false);
    queryClient.invalidateQueries({ queryKey: ["dormantWarnings"] });
  };

  const handleBulkWarn = async () => {
    const targets = dormant.filter((l) => selectedIds.has(l.id));
    if (targets.length === 0) return;
    setIsWarning(true);
    setBanner(null);
    let sent = 0, noEmail = 0, failed = 0;
    setProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      const l = targets[i];
      const email = ownerEmailOf(l);
      if (!email) { noEmail++; setProgress({ done: i + 1, total: targets.length }); continue; }
      try {
        const res = await base44.functions.invoke("sendDormantWarningEmail", {
          league_id: l.id, league_name: l.name, owner_email: email,
          owner_name: ownerNameOf(l), days_dormant: l.daysDormant,
        });
        const d = res?.data || res || {};
        if (d.success) sent++; else failed++;
      } catch { failed++; }
      setProgress({ done: i + 1, total: targets.length });
    }
    setProgress(null);
    setIsWarning(false);
    queryClient.invalidateQueries({ queryKey: ["dormantWarnings"] });
    const parts = [`Sent ${sent} warning${sent === 1 ? "" : "s"}.`];
    if (noEmail > 0) parts.push(`Skipped ${noEmail} with no email.`);
    if (failed > 0) parts.push(`${failed} failed.`);
    setBanner({ type: failed > 0 ? "error" : "success", text: parts.join(" ") });
  };

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Unknown";

  return (
    <Card className="border-amber-200 shadow-lg">
      <CardHeader className="bg-amber-50 border-b border-amber-200">
        <CardTitle className="text-amber-800 flex items-center gap-2">
          <CalendarOff className="w-5 h-5" /> Dormant Leagues — empty and inactive
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        <p className="text-sm text-slate-600">
          Leagues with <span className="font-semibold">no teams</span> that have not been touched for longer than the
          selected period. Deleting these removes only the empty league record (plus any leftover game data, if any).
        </p>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Inactive for more than</span>
            <Select value={String(thresholdDays)} onValueChange={(v) => setThresholdDays(Number(v))}>
              <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="45">45 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={rescan} disabled={loading || isDeleting} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Rescan
            </Button>
          </div>
          <span className="text-sm text-slate-500">
            {loading ? "Scanning…" : `Found ${dormant.length} dormant league${dormant.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {/* Status banner */}
        {banner && (
          <div className={`rounded-lg p-3 text-sm flex items-start gap-2 border ${
            banner.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
          }`}>
            {banner.type === "success" ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span>{banner.text}</span>
          </div>
        )}

        {/* Deleting progress */}
        {isDeleting && progress && (
          <div className="rounded-lg p-3 text-sm bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> {isWarning ? "Sending" : "Deleting"} {progress.done} of {progress.total}…
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Scanning leagues…
          </div>
        ) : dormant.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="font-medium text-slate-700">No dormant leagues</p>
            <p className="text-sm">Nothing empty and inactive beyond {thresholdDays} days. All tidy.</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-left">
                  <th className="w-10 px-3 py-2.5 text-center">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all"
                      className="w-4 h-4 accent-red-600 cursor-pointer align-middle" disabled={isDeleting} />
                  </th>
                  <th className="px-3 py-2.5 font-medium">League</th>
                  <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Admin</th>
                  <th className="px-3 py-2.5 font-medium w-24">Dormant</th>
                  <th className="px-3 py-2.5 font-medium w-32">Warning</th>
                  <th className="px-3 py-2.5 font-medium w-36 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dormant.map((league) => {
                  const checked = selectedIds.has(league.id);
                  return (
                    <tr key={league.id} className={`border-t border-slate-100 ${checked ? "bg-amber-50" : "bg-white"}`}>
                      <td className="px-3 py-2.5 text-center">
                        <input type="checkbox" checked={checked} onChange={() => toggleOne(league.id)}
                          aria-label={`Select ${league.name}`} className="w-4 h-4 accent-red-600 cursor-pointer align-middle"
                          disabled={isDeleting} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-800 truncate max-w-[200px]" title={league.name}>{league.name}</div>
                        {league.season && <div className="text-xs text-slate-400">{league.season}</div>}
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        {ownerEmailOf(league) ? (
                          <>
                            <div className="text-slate-700 truncate max-w-[160px]" title={ownerNameOf(league)}>{ownerNameOf(league) || "—"}</div>
                            <div className="text-xs text-orange-600 truncate max-w-[160px]" title={ownerEmailOf(league)}>{ownerEmailOf(league)}</div>
                          </>
                        ) : (
                          <span className="text-slate-400 italic">No email on file</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badgeClass(league.daysDormant)}`}>
                          {league.daysDormant} days
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {(() => {
                          const w = warnStatusOf(league);
                          if (w.state === "warned") return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Warned · {w.daysLeft}d left</span>;
                          if (w.state === "passed") return <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Deadline passed</span>;
                          return <span className="text-xs text-slate-400">{ownerEmailOf(league) ? "Not warned" : "Can't warn"}</span>;
                        })()}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          {(() => {
                            const w = warnStatusOf(league);
                            const email = ownerEmailOf(league);
                            if (!email) return <span className="text-xs text-slate-300">No email</span>;
                            if (w.state === "warned") return <span className="text-xs text-slate-400">Warned</span>;
                            const label = w.state === "passed" ? "Re-send" : "Send warning";
                            return (
                              <button onClick={() => sendWarning(league)} disabled={isWarning || isDeleting}
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                                <Mail className="w-3 h-3" /> {label}
                              </button>
                            );
                          })()}
                          <button onClick={() => setPendingSingle(league)} disabled={isDeleting}
                            aria-label={`Delete ${league.name}`}
                            className="text-slate-400 hover:text-red-600 disabled:opacity-40 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Bulk action bar */}
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-slate-200 bg-slate-50">
              <span className="text-sm text-slate-500 flex items-center gap-1.5">
                <ListChecks className="w-4 h-4" /> {selectedCount} selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleBulkWarn}
                  disabled={selectedCount === 0 || isWarning || isDeleting}
                  className="gap-2">
                  <Mail className="w-4 h-4" /> Warn selected ({selectedCount})
                </Button>
                <Button onClick={() => { setBulkConfirmText(""); setShowBulkConfirm(true); }}
                  disabled={selectedCount === 0 || isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 gap-2">
                  <Trash2 className="w-4 h-4" /> Delete selected ({selectedCount})
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Single-delete confirm dialog */}
        <Dialog open={!!pendingSingle} onOpenChange={(open) => { if (!open) setPendingSingle(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <Trash2 className="w-5 h-5" /> Delete this league?
              </DialogTitle>
              <DialogDescription className="space-y-2 pt-2">
                <span className="block text-slate-700">
                  Permanently delete <span className="font-semibold">{pendingSingle?.name}</span>
                  {pendingSingle?.season ? ` (${pendingSingle.season})` : ""}? It has no teams. This cannot be undone.
                </span>
                <span className="block text-xs text-slate-500">Created {fmtDate(pendingSingle?.created_date)} · by {pendingSingle?.created_by || "Unknown"}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 justify-end mt-2">
              <Button variant="outline" onClick={() => setPendingSingle(null)}>Cancel</Button>
              <Button onClick={handleSingleDelete} className="bg-red-600 hover:bg-red-700 text-white gap-2">
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk-delete confirm dialog */}
        <Dialog open={showBulkConfirm} onOpenChange={(open) => { if (!open) { setShowBulkConfirm(false); setBulkConfirmText(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" /> Delete {selectedCount} league{selectedCount === 1 ? "" : "s"}?
              </DialogTitle>
              <DialogDescription className="space-y-3 pt-2">
                <span className="block text-slate-700">
                  This permanently deletes the {selectedCount} selected empty league{selectedCount === 1 ? "" : "s"}. This cannot be undone.
                </span>
                <span className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-2">Type <span className="font-bold text-red-600">DELETE</span> to confirm:</span>
                  <Input value={bulkConfirmText} onChange={(e) => setBulkConfirmText(e.target.value)} placeholder="DELETE"
                    className="border-red-300 focus-visible:ring-red-400" />
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 justify-end mt-2">
              <Button variant="outline" onClick={() => { setShowBulkConfirm(false); setBulkConfirmText(""); }}>Cancel</Button>
              <Button disabled={bulkConfirmText !== "DELETE"} onClick={handleBulkDelete}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 gap-2">
                <Trash2 className="w-4 h-4" /> Delete {selectedCount}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
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
  CheckCircle, AlertTriangle, Loader2, Key, User, Calendar, Hash
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
          </TabsList>

          <TabsContent value="backup">
            <DataBackupTab />
          </TabsContent>

          <TabsContent value="delete">
            <DeleteLeagueTab currentUser={currentUser} />
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
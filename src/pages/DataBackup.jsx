import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Database, CheckCircle, AlertTriangle, Loader2, Key } from "lucide-react";

const ENTITIES = [
  "League", "Team", "Player", "Game", "PlayerStats", "GameLog",
  "UserApplication", "UserLeagueIdentity", "TacticalBriefing",
  "AIUsageCounter", "PendingUserAssignment", "LeagueSetupRequest",
  "LeagueAccessRequest", "DeletionLog", "LoginEvent", "User"
];

const CONFIRMATION_PHRASE = "DELETE AND RESTORE";

export default function DataBackup() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState(null);
  const [backupProgress, setBackupProgress] = useState([]);
  const [pendingFile, setPendingFile] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const fileInputRef = useRef(null);

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  if (currentUser && currentUser.user_type !== "app_admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <Key className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
            <p className="text-slate-600">You don't have permission to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupProgress([]);
    const backup = {
      version: "1.0",
      created_at: new Date().toISOString(),
      entities: {}
    };

    for (const entity of ENTITIES) {
      try {
        const records = await base44.entities[entity].list('-created_date', 5000);
        backup.entities[entity] = records;
        setBackupProgress(prev => [...prev, { entity, count: records.length, status: "ok" }]);
      } catch (e) {
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
        try {
          const existing = await base44.entities[entity].list('-created_date', 5000);
          await Promise.all(existing.map(r => base44.entities[entity].delete(r.id)));
        } catch (_) {}
        const records = backup.entities[entity];
        if (!records || records.length === 0) { counts[entity] = 0; continue; }
        const cleaned = records.map(({ id, created_date, updated_date, created_by, ...rest }) => rest);
        await base44.entities[entity].bulkCreate(cleaned);
        counts[entity] = cleaned.length;
      }
      setRestoreStatus({ success: true, message: "Clean restore completed successfully!", counts });
    } catch (err) {
      setRestoreStatus({ success: false, message: "Restore failed: " + err.message, counts: {} });
    } finally {
      setIsRestoring(false);
      setPendingFile(null);
    }
  };

  const totalBackedUp = backupProgress.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900">Data Backup & Restore</h1>
          </div>
          <p className="text-slate-600">Export all app data to a JSON file, or restore from a previous backup.</p>
        </div>

        <div className="grid gap-6">
          {/* Backup Card */}
          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="border-b border-slate-200 bg-slate-50">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <Download className="w-5 h-5 text-blue-600" />
                Create Backup
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-slate-600">
                Downloads a complete JSON snapshot of all entities: leagues, teams, players, games, stats, logs, users, and more.
              </p>
              <div className="flex flex-wrap gap-2">
                {ENTITIES.map(e => (
                  <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                ))}
              </div>

              <Button
                onClick={handleBackup}
                disabled={isBackingUp}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isBackingUp ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Backing up...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" /> Download Backup</>
                )}
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

          {/* Restore Card */}
          <Card className="border-orange-200 shadow-lg">
            <CardHeader className="border-b border-orange-200 bg-orange-50">
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <Upload className="w-5 h-5 text-orange-600" />
                Restore from Backup
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Warning: This is a destructive operation</p>
                  <p>ALL existing data will be permanently deleted and replaced with the backup. You will be asked to type a confirmation phrase before proceeding.</p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />

              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isRestoring}
                variant="outline"
                className="border-orange-400 text-orange-700 hover:bg-orange-50"
              >
                {isRestoring ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Restoring...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> Select Backup File (.json)</>
                )}
              </Button>

              {restoreStatus && (
                <div className={`border rounded-lg p-4 ${restoreStatus.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {restoreStatus.success
                      ? <CheckCircle className="w-5 h-5 text-green-600" />
                      : <AlertTriangle className="w-5 h-5 text-red-600" />}
                    <span className={`font-semibold ${restoreStatus.success ? 'text-green-800' : 'text-red-800'}`}>
                      {restoreStatus.message}
                    </span>
                  </div>
                  {restoreStatus.success && Object.keys(restoreStatus.counts).length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mt-3">
                      {Object.entries(restoreStatus.counts).filter(([, v]) => v > 0).map(([entity, count]) => (
                        <div key={entity} className="flex justify-between bg-white rounded px-2 py-1 border border-green-100">
                          <span className="text-slate-600">{entity}</span>
                          <span className="font-semibold text-slate-800">+{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={(open) => { if (!open) { setShowConfirmDialog(false); setPendingFile(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Confirm Clean Restore
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p className="text-slate-700">This will <strong>permanently delete ALL existing data</strong> in every table and replace it with the contents of the backup file. This cannot be undone.</p>
              <p className="text-slate-700">File: <span className="font-semibold">{pendingFile?.name}</span></p>
              <div className="pt-2">
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Type <span className="font-bold text-red-600">{CONFIRMATION_PHRASE}</span> to proceed:
                </p>
                <Input
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={CONFIRMATION_PHRASE}
                  className="border-red-300 focus-visible:ring-red-400"
                />
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="outline" onClick={() => { setShowConfirmDialog(false); setPendingFile(null); }}>Cancel</Button>
            <Button
              disabled={confirmInput !== CONFIRMATION_PHRASE}
              onClick={handleConfirmedRestore}
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete All & Restore
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
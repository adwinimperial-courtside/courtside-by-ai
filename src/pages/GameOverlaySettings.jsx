import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonitorPlay, Upload, CheckCircle, Trash2 } from "lucide-react";

export default function GameOverlaySettingsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [settingsId, setSettingsId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const canAccess = (user) =>
    user?.user_type === "app_admin" ||
    user?.user_type === "league_admin" ||
    user?.user_type === "video_team";

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
      if (!canAccess(user)) return;
      const settings = await base44.entities.OverlaySettings.list("-created_date", 1);
      if (settings?.[0]) {
        setLogoUrl(settings[0].logo_url || null);
        setSettingsId(settings[0].id);
      }
    };
    load();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setLogoUrl(file_url);
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    if (settingsId) {
      await base44.entities.OverlaySettings.update(settingsId, { logo_url: logoUrl });
    } else {
      const created = await base44.entities.OverlaySettings.create({ logo_url: logoUrl });
      setSettingsId(created.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRemoveLogo = () => setLogoUrl(null);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!canAccess(currentUser)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500">Access denied.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 w-full">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <MonitorPlay className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Game Overlay</h1>
            <p className="text-slate-500 text-sm">Configure your OBS live game overlay</p>
          </div>
        </div>

        <Card className="border-slate-200 mb-6">
          <CardHeader className="pb-2">
            <h2 className="font-semibold text-slate-800">Overlay Logo</h2>
            <p className="text-sm text-slate-500">Upload a logo to display in the top-right corner of the overlay.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {logoUrl ? (
              <div className="flex items-center gap-4">
                <img
                  src={logoUrl}
                  alt="Overlay Logo"
                  className="w-20 h-20 object-contain rounded-xl border border-slate-200 bg-slate-50 p-2"
                />
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Logo
                  </Button>
                  <label>
                    <Button variant="outline" size="sm" asChild>
                      <span className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        {uploading ? "Uploading..." : "Replace Logo"}
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="block">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition-colors">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-sm text-slate-600 font-medium">
                    {uploading ? "Uploading..." : "Click to upload logo"}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">PNG, JPG, WebP — transparent background recommended</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
            )}

            <Button
              onClick={handleSave}
              disabled={saving || uploading}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {saved ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Saved!
                </>
              ) : saving ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <h2 className="font-semibold text-slate-800">How to Use in OBS</h2>
          </CardHeader>
          <CardContent>
            <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
              <li>In OBS, add a new <strong>Browser Source</strong>.</li>
              <li>Go to the <strong>Schedule</strong> page and click <strong>Overlay</strong> on a live game.</li>
              <li>Copy the generated URL and paste it into the OBS Browser Source URL field.</li>
              <li>Set the width/height to match your stream resolution (e.g. 1920×1080).</li>
              <li>Check <strong>"Shutdown source when not visible"</strong> and enable <strong>"Transparent background"</strong> (custom CSS: <code className="bg-slate-100 px-1 rounded">body {"{"} background: transparent; {"}"}</code>).</li>
              <li>The overlay will automatically update in real-time as the game progresses.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
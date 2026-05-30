import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonitorPlay, Upload, CheckCircle, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

function LogoUploadBlock({ label, hint, value, field, uploading, onRemove, onUpload }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{hint}</p>
      </div>
      {value ? (
        <div className="flex items-center gap-4">
          <img
            src={value}
            alt={label}
            className="w-20 h-20 object-contain rounded-xl border border-slate-200 bg-slate-50 p-2"
          />
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRemove}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove
            </Button>
            <label>
              <Button variant="outline" size="sm" asChild>
                <span className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading === field ? "Uploading..." : "Replace"}
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUpload(e, field)}
                disabled={!!uploading}
              />
            </label>
          </div>
        </div>
      ) : (
        <label className="block">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-6 cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition-colors">
            <Upload className="w-7 h-7 text-slate-400 mb-2" />
            <span className="text-sm text-slate-600 font-medium">
              {uploading === field ? "Uploading..." : "Click to upload"}
            </span>
            <span className="text-xs text-slate-400 mt-1">PNG, JPG, WebP — transparent background recommended</span>
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onUpload(e, field)}
            disabled={!!uploading}
          />
        </label>
      )}
    </div>
  );
}

export default function GameOverlaySettingsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [leagueLogoUrl, setLeagueLogoUrl] = useState(null);
  const [tickerText, setTickerText] = useState("");
  const [tickerEnabled, setTickerEnabled] = useState(true);
  const [settingsId, setSettingsId] = useState(null);
  const [uploading, setUploading] = useState(null); // "logo" | "league_logo" | null
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
        setLeagueLogoUrl(settings[0].league_logo_url || null);
        setTickerText(settings[0].ticker_text || "");
        setTickerEnabled(settings[0].ticker_enabled !== false);
        setSettingsId(settings[0].id);
      }
    };
    load();
  }, []);

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(field);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (field === "logo") setLogoUrl(file_url);
    else setLeagueLogoUrl(file_url);
    setUploading(null);
  };

  const handleSave = async () => {
    setSaving(true);
    const data = { logo_url: logoUrl, league_logo_url: leagueLogoUrl, ticker_text: tickerText, ticker_enabled: tickerEnabled };
    if (settingsId) {
      await base44.entities.OverlaySettings.update(settingsId, data);
    } else {
      const created = await base44.entities.OverlaySettings.create(data);
      setSettingsId(created.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
            <h2 className="font-semibold text-slate-800">Overlay Logos</h2>
            <p className="text-sm text-slate-500">Both logos will appear in the top-right corner of the overlay.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <LogoUploadBlock
              label="App / Sponsor Logo"
              hint="E.g. Courtside by AI or a sponsor logo"
              value={logoUrl}
              field="logo"
              uploading={uploading}
              onRemove={() => setLogoUrl(null)}
              onUpload={handleFileUpload}
            />

            <div className="border-t border-slate-100" />

            <LogoUploadBlock
              label="League Logo"
              hint="Your league's official logo"
              value={leagueLogoUrl}
              field="league_logo"
              uploading={uploading}
              onRemove={() => setLeagueLogoUrl(null)}
              onUpload={handleFileUpload}
            />

            <Button
              onClick={handleSave}
              disabled={saving || !!uploading}
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

        <Card className="border-slate-200 mb-6">
          <CardHeader className="pb-2">
            <h2 className="font-semibold text-slate-800">Ticker / Announcements</h2>
            <p className="text-sm text-slate-500">A scrolling text bar at the bottom of the overlay for ads and announcements.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Enable Ticker</p>
                <p className="text-xs text-slate-400">Show or hide the ticker on the overlay</p>
              </div>
              <Switch checked={tickerEnabled} onCheckedChange={setTickerEnabled} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">Ticker Text</p>
              <Textarea
                placeholder="e.g. Welcome to the game! Sponsored by ACME Corp. • Half-time show at 8pm • Follow us @leaguename"
                value={tickerText}
                onChange={(e) => setTickerText(e.target.value)}
                className="resize-none"
                rows={3}
              />
              <p className="text-xs text-slate-400 mt-1">The text will scroll continuously across the bottom of the screen.</p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !!uploading}
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
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonitorPlay, Upload, CheckCircle, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import HelpButton from "../components/help/HelpButton";

function LogoUploadBlock({ label, hint, value, field, uploading, onRemove, onUpload, disabled }) {
  return (
    <div className={disabled ? "space-y-3 opacity-40 pointer-events-none" : "space-y-3"}>
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{disabled ? "Hidden on the overlay — your upload is kept" : hint}</p>
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
                disabled={!!uploading || disabled}
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
            disabled={!!uploading || disabled}
          />
        </label>
      )}
    </div>
  );
}

export default function GameOverlaySettingsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [allSettings, setAllSettings] = useState([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [logoUrl, setLogoUrl] = useState(null);
  const [leagueLogoUrl, setLeagueLogoUrl] = useState(null);
  const [logoEnabled, setLogoEnabled] = useState(true);
  const [leagueLogoEnabled, setLeagueLogoEnabled] = useState(true);
  const [tickerText, setTickerText] = useState("");
  const [tickerEnabled, setTickerEnabled] = useState(true);
  const [clockEnabled, setClockEnabled] = useState(true);
  const [timeoutPanelEnabled, setTimeoutPanelEnabled] = useState(true);
  const [breakPanelEnabled, setBreakPanelEnabled] = useState(true);
  const [startersPanelEnabled, setStartersPanelEnabled] = useState(true);
  const [playerCardsEnabled, setPlayerCardsEnabled] = useState(true);
  const [settingsId, setSettingsId] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // VIDEO_ADMIN_PER_LEAGUE_V1 - video admin can be held as a per-league role, so a user
  // whose global type is coach or player may still be a video admin somewhere. The league
  // list below is already filtered to assigned_league_ids, so access stays scoped.
  const canAccess = (user) =>
    user?.user_type === "app_admin" ||
    user?.user_type === "league_admin" ||
    user?.user_type === "video_admin" ||
    Object.values(user?.league_role_map || {}).includes("video_admin");

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
      if (!canAccess(user)) { setLoading(false); return; }

      // Load all leagues, then filter by assigned leagues for non-app-admins
      const allLeagues = await base44.entities.League.list("name");
      let visibleLeagues = allLeagues;
      if (user.user_type !== "app_admin") {
        const assignedIds = user.assigned_league_ids || [];
        visibleLeagues = allLeagues.filter(l => assignedIds.includes(l.id));
      }
      setLeagues(visibleLeagues);

      const settingsList = await base44.entities.OverlaySettings.list("-created_date", 200);
      setAllSettings(settingsList);
      setLoading(false);
    };
    load();
  }, []);

  const applyLeagueConfig = (lid, settingsList, user) => {
    const rec = settingsList.find(
      (s) => s.league_id === lid && (s.user_id === user.id || s.created_by_id === user.id)
    );
    if (rec) {
      setLogoUrl(rec.logo_url || null);
      setLeagueLogoUrl(rec.league_logo_url || null);
      setLogoEnabled(rec.logo_enabled !== false);
      setLeagueLogoEnabled(rec.league_logo_enabled !== false);
      setTickerText(rec.ticker_text || "");
      setTickerEnabled(rec.ticker_enabled !== false);
      setClockEnabled(rec.clock_enabled !== false);
      setTimeoutPanelEnabled(rec.timeout_panel_enabled !== false);
      setBreakPanelEnabled(rec.break_panel_enabled !== false);
      setStartersPanelEnabled(rec.starters_panel_enabled !== false);
      setPlayerCardsEnabled(rec.player_cards_enabled !== false);
      setSettingsId(rec.id);
    } else {
      setLogoUrl(null);
      setLeagueLogoUrl(null);
      setLogoEnabled(true);
      setLeagueLogoEnabled(true);
      setTickerText("");
      setTickerEnabled(true);
      setClockEnabled(true);
      setTimeoutPanelEnabled(true);
      setBreakPanelEnabled(true);
      setStartersPanelEnabled(true);
      setPlayerCardsEnabled(true);
      setSettingsId(null);
    }
  };

  const handleLeagueChange = (lid) => {
    setSelectedLeagueId(lid);
    applyLeagueConfig(lid, allSettings, currentUser);
  };

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
    if (!selectedLeagueId) return;
    setSaving(true);
    const data = {
      user_id: currentUser.id,
      league_id: selectedLeagueId,
      logo_url: logoUrl,
      league_logo_url: leagueLogoUrl,
      logo_enabled: logoEnabled,
      league_logo_enabled: leagueLogoEnabled,
      ticker_text: tickerText,
      ticker_enabled: tickerEnabled,
      clock_enabled: clockEnabled,
      timeout_panel_enabled: timeoutPanelEnabled,
      break_panel_enabled: breakPanelEnabled,
      starters_panel_enabled: startersPanelEnabled,
      player_cards_enabled: playerCardsEnabled,
    };
    let recId = settingsId;
    if (settingsId) {
      await base44.entities.OverlaySettings.update(settingsId, data);
    } else {
      const created = await base44.entities.OverlaySettings.create(data);
      recId = created.id;
      setSettingsId(created.id);
    }
    setAllSettings((prev) => {
      const others = prev.filter((s) => s.id !== recId);
      return [{ ...data, id: recId }, ...others];
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
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
    <div data-marker="OVERLAY_LOGO_TOGGLE_V1" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 w-full">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <MonitorPlay className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2"><h1 className="text-3xl font-bold text-slate-900">Game Overlay</h1><HelpButton pageKey="gameoverlay" /></div>
            <p className="text-slate-500 text-sm">Configure your personal OBS live game overlay</p>
          </div>
        </div>

        {/* League Selector */}
        <Card className="border-slate-200 mb-6">
          <CardHeader className="pb-2">
            <h2 className="font-semibold text-slate-800">League</h2>
            <p className="text-sm text-slate-500">Each league has its own overlay configuration. Pick a league to view or edit its logos and ticker.</p>
          </CardHeader>
          <CardContent>
            <Select value={selectedLeagueId || undefined} onValueChange={handleLeagueChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a league..." />
              </SelectTrigger>
              <SelectContent>
                {leagues.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name} ({l.season})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedLeagueId && (
              <p className="text-sm text-slate-500 mt-3">Select a league above to configure its overlay.</p>
            )}
          </CardContent>
        </Card>

        {selectedLeagueId && (
        <>
        <Card className="border-slate-200 mb-6">
          <CardHeader className="pb-2">
            <h2 className="font-semibold text-slate-800">Overlay Logos</h2>
            <p className="text-sm text-slate-500">These logos will appear on your personal overlay. Switch either one off for a clean, logo-free overlay.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">Show sponsor logo</p>
                  <p className="text-xs text-slate-400">Top right of the overlay</p>
                </div>
                <Switch checked={logoEnabled} onCheckedChange={setLogoEnabled} />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">Show league logo</p>
                  <p className="text-xs text-slate-400">Top left of the overlay</p>
                </div>
                <Switch checked={leagueLogoEnabled} onCheckedChange={setLeagueLogoEnabled} />
              </div>
            </div>

            <div className="border-t border-slate-100" />

            <LogoUploadBlock
              label="App / Sponsor Logo"
              hint="E.g. Courtside by AI or a sponsor logo"
              value={logoUrl}
              field="logo"
              uploading={uploading}
              disabled={!logoEnabled}
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
              disabled={!leagueLogoEnabled}
              onRemove={() => setLeagueLogoUrl(null)}
              onUpload={handleFileUpload}
            />

            <Button
              onClick={handleSave}
              disabled={saving || !!uploading}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {saved ? <><CheckCircle className="w-4 h-4 mr-2" />Saved!</> : saving ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>

        <Card data-marker="OVERLAY_TOGGLES_V1" className="border-slate-200 mb-6">
          <CardHeader className="pb-2">
            <h2 className="font-semibold text-slate-800">Scoreboard &amp; Panels</h2>
            <p className="text-sm text-slate-500">Choose what appears on the overlay for this league. Everything is on by default.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="pr-6">
                <p className="text-sm font-medium text-slate-700">Show game clock</p>
                <p className="text-xs text-slate-400">Switch off if your scorer does not keep the in-app clock in sync with the clock on the court. The quarter is always shown.</p>
              </div>
              <Switch checked={clockEnabled} onCheckedChange={setClockEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <div className="pr-6">
                <p className="text-sm font-medium text-slate-700">Timeout stats panel</p>
                <p className="text-xs text-slate-400">The team comparison panel that appears automatically when a team calls a timeout.</p>
              </div>
              <Switch checked={timeoutPanelEnabled} onCheckedChange={setTimeoutPanelEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <div className="pr-6">
                <p className="text-sm font-medium text-slate-700">End of period leaders</p>
                <p className="text-xs text-slate-400">The player leaders board that appears at the end of each quarter or half.</p>
              </div>
              <Switch checked={breakPanelEnabled} onCheckedChange={setBreakPanelEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <div className="pr-6">
                <p className="text-sm font-medium text-slate-700">Starting five panel</p>
                <p className="text-xs text-slate-400">The starting line-ups shown before tip-off.</p>
              </div>
              <Switch checked={startersPanelEnabled} onCheckedChange={setStartersPanelEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <div className="pr-6">
                <p className="text-sm font-medium text-slate-700">Player highlight cards</p>
                <p className="text-xs text-slate-400">The card that pops up bottom-left when a player hits a milestone during play.</p>
              </div>
              <Switch checked={playerCardsEnabled} onCheckedChange={setPlayerCardsEnabled} />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !!uploading}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {saved ? <><CheckCircle className="w-4 h-4 mr-2" />Saved!</> : saving ? "Saving..." : "Save Settings"}
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
              {saved ? <><CheckCircle className="w-4 h-4 mr-2" />Saved!</> : saving ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>
        </>
        )}

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
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonitorPlay, Upload, CheckCircle, Trash2, ChevronUp, ChevronDown, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import HelpButton from "../components/help/HelpButton";
import { LiveOverlayLayout } from "@/components/overlay/LiveOverlayPanels";

// OVERLAY_SETTINGS_V2 - settings for the one stream overlay (OBS + PRISM, LIVE_OVERLAY_V4).
// One shared settings record per league: the same record the overlay reads (getLiveOverlay):
// a record that has a sponsors list wins, then one with the old sponsor_logos, then the newest.
// Sponsors never rotate: up to 4 sit in the footer, plus one "presented by" sponsor on the
// timeout strip and one on the end-of-quarter strip. A live preview uses the real overlay pieces.
const MAX_SPONSORS = 8;
const MAX_FOOTER = 4;

const ts = (s) => new Date(s?.updated_date || s?.created_date || 0).getTime() || 0;
function pickRecord(list, leagueId) {
  const mine = (list || []).filter((s) => s.league_id === leagueId).sort((a, b) => ts(b) - ts(a));
  return mine.find((s) => Array.isArray(s.sponsors))
    || mine.find((s) => Array.isArray(s.sponsor_logos) && s.sponsor_logos.length > 0)
    || mine[0] || null;
}

const SAMPLE_NAMES = [["Miguel Santos", 3], ["Jose Cruz", 7], ["Rico Dela Rosa", 11], ["Adrian Reyes", 23], ["Ken Bautista", 32]];
const SAMPLE_NAMES_B = [["Paolo Garcia", 1], ["Luis Mendoza", 5], ["Dan Ramos", 9], ["Eli Villanueva", 14], ["Carl Aquino", 21]];
const MOMENTS = [
  { key: "starters", label: "Tip-off" },
  { key: "timeout", label: "Timeout" },
  { key: "leaders", label: "End of quarter" },
  { key: "card", label: "Player card" },
  { key: "live", label: "Live play" },
];

function Row({ title, hint, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="text-xs text-slate-400">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function GameOverlaySettingsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [allSettings, setAllSettings] = useState([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [settingsId, setSettingsId] = useState(null);
  const [leagueLogoUrl, setLeagueLogoUrl] = useState(null);
  const [leagueLogoEnabled, setLeagueLogoEnabled] = useState(true);
  const [sponsors, setSponsors] = useState([]);
  const [timeoutSponsorUrl, setTimeoutSponsorUrl] = useState("");
  const [breakSponsorUrl, setBreakSponsorUrl] = useState("");
  const [clockEnabled, setClockEnabled] = useState(true);
  const [startersOn, setStartersOn] = useState(true);
  const [timeoutOn, setTimeoutOn] = useState(true);
  const [leadersOn, setLeadersOn] = useState(true);
  const [cardsOn, setCardsOn] = useState(true);
  const [tickerMode, setTickerMode] = useState("off");
  const [tickerText, setTickerText] = useState("");
  const [uploading, setUploading] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [moment, setMoment] = useState("timeout");
  const [howTo, setHowTo] = useState("obs");
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
      const allLeagues = await base44.entities.League.list("name");
      let visibleLeagues = allLeagues;
      if (user.user_type !== "app_admin") {
        const assignedIds = user.assigned_league_ids || [];
        visibleLeagues = allLeagues.filter((l) => assignedIds.includes(l.id));
      }
      setLeagues(visibleLeagues);
      const settingsList = await base44.entities.OverlaySettings.list("-created_date", 200);
      setAllSettings(settingsList || []);
      setLoading(false);
    };
    load();
  }, []);

  const touch = () => { setDirty(true); setMessage(""); };
  const set = (fn) => (v) => { fn(v); touch(); };

  const applyLeagueConfig = (lid, list) => {
    const rec = pickRecord(list, lid);
    setSettingsId(rec?.id || null);
    setLeagueLogoUrl(rec?.league_logo_url || null);
    setLeagueLogoEnabled(rec ? rec.league_logo_enabled !== false : true);
    if (rec && Array.isArray(rec.sponsors)) {
      setSponsors(rec.sponsors.filter((s) => s && s.url).slice(0, MAX_SPONSORS).map((s) => ({ url: s.url, name: s.name || "", in_footer: !!s.in_footer })));
    } else {
      // Older records: the single sponsor logo plus the phone sponsor list become the sponsor list.
      const urls = [];
      if (rec?.logo_url && rec.logo_enabled !== false) urls.push(rec.logo_url);
      (Array.isArray(rec?.sponsor_logos) ? rec.sponsor_logos : []).forEach((u) => { if (u && !urls.includes(u)) urls.push(u); });
      setSponsors(urls.slice(0, MAX_SPONSORS).map((url, i) => ({ url, name: `Sponsor ${i + 1}`, in_footer: i < MAX_FOOTER })));
    }
    setTimeoutSponsorUrl(rec?.timeout_sponsor_url || "");
    setBreakSponsorUrl(rec?.break_sponsor_url || "");
    setClockEnabled(rec ? rec.clock_enabled !== false : true);
    setStartersOn(rec ? rec.starters_panel_enabled !== false : true);
    setTimeoutOn(rec ? rec.timeout_panel_enabled !== false : true);
    setLeadersOn(rec ? rec.break_panel_enabled !== false : true);
    setCardsOn(rec ? rec.player_cards_enabled !== false : true);
    setTickerText(rec?.ticker_text || "");
    const mode = ["off", "stopped", "always"].includes(rec?.ticker_mode) ? rec.ticker_mode
      : rec && rec.ticker_enabled !== false && rec.ticker_text ? "always" : "off";
    setTickerMode(mode);
    setDirty(false);
    setMessage("");
  };

  const handleLeagueChange = (lid) => {
    setSelectedLeagueId(lid);
    applyLeagueConfig(lid, allSettings);
  };

  const upload = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  };

  const handleLeagueLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading("league");
    try { setLeagueLogoUrl(await upload(file)); touch(); } finally { setUploading(null); }
  };

  const handleAddSponsor = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading("sponsor");
    try {
      const url = await upload(file);
      setSponsors((prev) => {
        if (prev.length >= MAX_SPONSORS) return prev;
        const footerCount = prev.filter((s) => s.in_footer).length;
        return [...prev, { url, name: `Sponsor ${prev.length + 1}`, in_footer: footerCount < MAX_FOOTER }];
      });
      touch();
    } finally { setUploading(null); }
  };

  const updateSponsor = (i, patch) => { setSponsors((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s))); touch(); };
  const moveSponsor = (i, dir) => {
    setSponsors((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    touch();
  };
  const removeSponsor = (i) => {
    const gone = sponsors[i]?.url;
    setSponsors((prev) => prev.filter((_, k) => k !== i));
    if (gone && timeoutSponsorUrl === gone) setTimeoutSponsorUrl("");
    if (gone && breakSponsorUrl === gone) setBreakSponsorUrl("");
    touch();
  };

  const handleSave = async () => {
    if (!selectedLeagueId) return;
    setSaving(true);
    setMessage("");
    const data = {
      league_id: selectedLeagueId,
      league_logo_url: leagueLogoUrl,
      league_logo_enabled: leagueLogoEnabled,
      sponsors: sponsors.map((s) => ({ url: s.url, name: (s.name || "").trim(), in_footer: !!s.in_footer })),
      timeout_sponsor_url: timeoutSponsorUrl || "",
      break_sponsor_url: breakSponsorUrl || "",
      clock_enabled: clockEnabled,
      starters_panel_enabled: startersOn,
      timeout_panel_enabled: timeoutOn,
      break_panel_enabled: leadersOn,
      player_cards_enabled: cardsOn,
      ticker_text: tickerText,
      ticker_mode: tickerMode,
      ticker_enabled: tickerMode !== "off",
    };
    try {
      let rec;
      if (settingsId) {
        rec = await base44.entities.OverlaySettings.update(settingsId, data);
      } else {
        rec = await base44.entities.OverlaySettings.create({ ...data, user_id: currentUser.id });
        setSettingsId(rec.id);
      }
      const recId = rec?.id || settingsId;
      const now = new Date().toISOString();
      setAllSettings((prev) => {
        const old = prev.find((s) => s.id === recId) || {};
        return [{ ...old, ...data, id: recId, updated_date: now }, ...prev.filter((s) => s.id !== recId)];
      });
      setDirty(false);
      setMessage("saved");
    } catch (err) {
      setMessage("error");
    } finally {
      setSaving(false);
    }
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

  const footerCount = sponsors.filter((s) => s.in_footer).length;
  const footerSponsors = sponsors.filter((s) => s.in_footer).slice(0, MAX_FOOTER);

  // Preview data: the real overlay pieces with example teams and players.
  const d = {
    status: moment === "starters" ? "scheduled" : "in_progress", period: moment === "starters" ? 1 : 2, period_type: "quarters", period_count: 4,
    clock_enabled: clockEnabled,
    home: { name: "Home Team", color: "#8B1020", score: moment === "starters" ? 0 : 48, fouls: 3, bonus: false, timeouts_left: 1 },
    away: { name: "Away Team", color: "#0F7F72", score: moment === "starters" ? 0 : 45, fouls: 4, bonus: true, timeouts_left: 2 },
    league_logo: leagueLogoEnabled ? leagueLogoUrl : "",
    footer_sponsors: footerSponsors,
  };
  let pop = null;
  let card = null;
  let offNote = "";
  if (moment === "starters") {
    if (startersOn) pop = { kind: "starters", homeFive: SAMPLE_NAMES.map(([name, jersey]) => ({ name, jersey })), awayFive: SAMPLE_NAMES_B.map(([name, jersey]) => ({ name, jersey })) };
    else offNote = "Starting five is off: nothing shows before tip-off.";
  } else if (moment === "timeout") {
    if (timeoutOn) pop = { kind: "timeout", calledBy: "Away Team", sponsorUrl: timeoutSponsorUrl, run: { side: "home", pf: 12, pa: 4 }, rows: [
      { label: "POINTS", home: 48, away: 45 }, { label: "3-POINTERS", home: 5, away: 3 }, { label: "REBOUNDS", home: 19, away: 16 },
      { label: "ASSISTS", home: 9, away: 11 }, { label: "STEALS", home: 4, away: 6 }, { label: "BLOCKS", home: 2, away: 1 }] };
    else offNote = "Timeout stats are off: nothing shows during timeouts.";
  } else if (moment === "leaders") {
    if (leadersOn) pop = { kind: "leaders", title: "End of Q2 · Scoring leaders", page: 0, pages: 3, sponsorUrl: breakSponsorUrl, leaders: [
      { name: "Adrian Reyes", value: 20, label: "PTS", sub: "#23 HOM · 6 REB · 3 AST" },
      { name: "Dan Ramos", value: 16, label: "PTS", sub: "#9 AWA · 4 REB · 5 AST" },
      { name: "Jose Cruz", value: 11, label: "PTS", sub: "#7 HOM · 8 REB · 2 AST" }] };
    else offNote = "End-of-quarter leaders are off: nothing shows at breaks.";
  } else if (moment === "card") {
    if (cardsOn) card = { type: "points", tone: "orange", value: 20, label: "POINTS", name: "ADRIAN REYES", jersey: 23 };
    else offNote = "Player cards are off.";
  }
  const showTicker = tickerMode === "always" || (tickerMode === "stopped" && moment !== "card" && moment !== "live");
  const previewClock = clockEnabled ? (moment === "starters" ? "--:--" : moment === "leaders" ? "0.0" : "7:42") : "";

  return (
    <div data-marker="OVERLAY_SETTINGS_V2" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 w-full">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 pb-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <MonitorPlay className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2"><h1 className="text-3xl font-bold text-slate-900">Game Overlay</h1><HelpButton pageKey="gameoverlay" /></div>
            <p className="text-slate-500 text-sm">Set up the live stream overlay for a league. One overlay works in OBS and on a phone (PRISM).</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] items-start">
          <div className="space-y-6 min-w-0">
            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <h2 className="font-semibold text-slate-800">League</h2>
                <p className="text-sm text-slate-500">Each league has its own overlay settings, shared by its League Admins and Stream Crew.</p>
              </CardHeader>
              <CardContent>
                <Select value={selectedLeagueId || undefined} onValueChange={handleLeagueChange}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select a league..." /></SelectTrigger>
                  <SelectContent>
                    {leagues.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} ({l.season})</SelectItem>)}
                  </SelectContent>
                </Select>
                {!selectedLeagueId && <p className="text-sm text-slate-500 mt-3">Select a league above to set up its overlay.</p>}
              </CardContent>
            </Card>

            {selectedLeagueId && (
              <>
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <h2 className="font-semibold text-slate-800">League logo</h2>
                    <p className="text-sm text-slate-500">Shown top-left on the stream for the whole game. With no upload, the league group's logo is used.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Row title="Show league logo" hint="Top left of the overlay" checked={leagueLogoEnabled} onChange={set(setLeagueLogoEnabled)} />
                    <div className={leagueLogoEnabled ? "flex items-center gap-4" : "flex items-center gap-4 opacity-40 pointer-events-none"}>
                      <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                        {leagueLogoUrl ? <img src={leagueLogoUrl} alt="League logo" className="w-full h-full object-contain p-1" /> : <span className="text-xs text-slate-400">None</span>}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <label>
                          <Button variant="outline" size="sm" asChild>
                            <span className="cursor-pointer"><Upload className="w-4 h-4 mr-2" />{uploading === "league" ? "Uploading..." : leagueLogoUrl ? "Replace" : "Upload"}</span>
                          </Button>
                          <input type="file" accept="image/*" className="hidden" onChange={handleLeagueLogo} disabled={!!uploading} />
                        </label>
                        {leagueLogoUrl && (
                          <Button variant="outline" size="sm" onClick={() => { setLeagueLogoUrl(null); touch(); }} className="text-red-600 border-red-200 hover:bg-red-50">
                            <Trash2 className="w-4 h-4 mr-2" />Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <h2 className="font-semibold text-slate-800">Sponsors</h2>
                    <p className="text-sm text-slate-500">Every sponsor gets a fixed spot, so viewers always find a logo in the same place. Nothing rotates. Use the arrows to set the left-to-right order in the footer.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <span className="flex gap-1">{Array.from({ length: MAX_FOOTER }).map((_, i) => <span key={i} className={`w-6 h-2 rounded ${i < footerCount ? "bg-orange-500" : "bg-slate-200"}`} />)}</span>
                      <span>Footer spots used: {footerCount} of {MAX_FOOTER}{footerCount >= MAX_FOOTER ? " (full: untick one to swap)" : ""}</span>
                    </div>
                    {sponsors.length === 0 && <p className="text-sm text-slate-500">No sponsors yet. The footer shows only "Powered by Courtside by AI".</p>}
                    <div className="space-y-2">
                      {sponsors.map((s, i) => {
                        const full = !s.in_footer && footerCount >= MAX_FOOTER;
                        const spots = [s.in_footer && "Footer", timeoutSponsorUrl === s.url && "Presents timeouts", breakSponsorUrl === s.url && "Presents end of quarter"].filter(Boolean);
                        return (
                          <div key={s.url + i} className="flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex flex-col gap-0.5">
                              <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => moveSponsor(i, -1)} className="rounded bg-slate-50 p-0.5 text-slate-500 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                              <button type="button" aria-label="Move down" disabled={i === sponsors.length - 1} onClick={() => moveSponsor(i, 1)} className="rounded bg-slate-50 p-0.5 text-slate-500 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                            </div>
                            <img src={s.url} alt="" className="h-9 w-24 object-contain rounded bg-slate-50" />
                            <div className="flex-1 min-w-[140px] space-y-1">
                              <Input value={s.name} onChange={(e) => updateSponsor(i, { name: e.target.value })} placeholder="Sponsor name" className="h-8 text-sm" />
                              <div className="flex flex-wrap gap-1">
                                {spots.length > 0
                                  ? spots.map((t) => <span key={t} className="text-[11px] font-semibold rounded-full px-2 bg-orange-50 text-orange-700 border border-orange-200">{t}</span>)
                                  : <span className="text-[11px] rounded-full px-2 bg-slate-50 text-slate-500 border border-slate-200">Not shown yet: add to the footer or pick it below</span>}
                              </div>
                            </div>
                            <label className={`flex items-center gap-2 text-sm font-medium ${full ? "text-slate-300" : "text-slate-700"}`}>
                              <input type="checkbox" className="w-4 h-4 accent-orange-500" checked={!!s.in_footer} disabled={full} onChange={(e) => updateSponsor(i, { in_footer: e.target.checked })} />
                              Footer
                            </label>
                            <button type="button" aria-label="Remove sponsor" onClick={() => removeSponsor(i)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        );
                      })}
                    </div>
                    {sponsors.length < MAX_SPONSORS ? (
                      <label className="block">
                        <div className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-3 cursor-pointer hover:border-orange-400 text-sm font-medium text-slate-600">
                          <Plus className="w-4 h-4" />{uploading === "sponsor" ? "Uploading..." : "Add sponsor logo"}
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={handleAddSponsor} disabled={!!uploading} />
                      </label>
                    ) : <p className="text-xs text-slate-400">8 sponsors is the most.</p>}
                    <div className="grid sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                      <label className="text-sm font-medium text-slate-700 space-y-1">
                        <span>Timeout strip presented by</span>
                        <select value={timeoutSponsorUrl} onChange={(e) => { setTimeoutSponsorUrl(e.target.value); touch(); }} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="">No sponsor</option>
                          {sponsors.map((s, i) => <option key={s.url + i} value={s.url}>{s.name || `Sponsor ${i + 1}`}</option>)}
                        </select>
                        <span className="block text-xs font-normal text-slate-400">Shown while a timeout is on screen</span>
                      </label>
                      <label className="text-sm font-medium text-slate-700 space-y-1">
                        <span>End-of-quarter strip presented by</span>
                        <select value={breakSponsorUrl} onChange={(e) => { setBreakSponsorUrl(e.target.value); touch(); }} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="">No sponsor</option>
                          {sponsors.map((s, i) => <option key={s.url + i} value={s.url}>{s.name || `Sponsor ${i + 1}`}</option>)}
                        </select>
                        <span className="block text-xs font-normal text-slate-400">Shown with the leaders at each break</span>
                      </label>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <h2 className="font-semibold text-slate-800">What shows on the stream</h2>
                    <p className="text-sm text-slate-500">Everything is on by default. Pop-ups only appear when play is stopped, except player cards. For youth leagues, switch off the starting five, leaders and player cards: then no player names or stats are sent to the overlay at all.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Row title="Game clock" hint="Switch off if your scorer doesn't keep the in-app clock in sync with the court. The quarter always shows." checked={clockEnabled} onChange={set(setClockEnabled)} />
                    <Row title="Starting five" hint="Before tip-off: home team on the left edge, away on the right." checked={startersOn} onChange={set(setStartersOn)} />
                    <Row title="Timeout stats" hint="Strip above the scoreboard when a team calls a timeout." checked={timeoutOn} onChange={set(setTimeoutOn)} />
                    <Row title="End-of-quarter leaders" hint="Strip above the scoreboard with the top 3 players at each break." checked={leadersOn} onChange={set(setLeadersOn)} />
                    <Row title="Player highlight cards" hint="Small card bottom-left for about 6 seconds when a player hits a milestone." checked={cardsOn} onChange={set(setCardsOn)} />
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <h2 className="font-semibold text-slate-800">Ticker</h2>
                    <p className="text-sm text-slate-500">A scrolling line of text just above the scoreboard, for announcements. "Only when play stops" keeps viewers' eyes on the game during play.</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700 space-y-1">
                      <span>When to show it</span>
                      <select value={tickerMode} onChange={(e) => { setTickerMode(e.target.value); touch(); }} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                        <option value="off">Off</option>
                        <option value="stopped">Only when play stops (before tip-off, timeouts, breaks)</option>
                        <option value="always">Always, including live play</option>
                      </select>
                    </label>
                    <Textarea placeholder="e.g. Finals night! Tip-off 7 pm · Follow us @leaguename" value={tickerText} onChange={(e) => { setTickerText(e.target.value); touch(); }} className="resize-none" rows={2} />
                  </CardContent>
                </Card>
              </>
            )}

            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <h2 className="font-semibold text-slate-800">How to add the overlay to your stream</h2>
                <p className="text-sm text-slate-500">Get the link first: <strong>Schedule</strong> → game card → <strong>Stream overlay</strong> → <strong>Copy link</strong>. One link per game. It works in both apps and needs no login.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={howTo === "obs" ? "default" : "outline"} onClick={() => setHowTo("obs")}>OBS (laptop)</Button>
                  <Button type="button" size="sm" variant={howTo === "prism" ? "default" : "outline"} onClick={() => setHowTo("prism")}>PRISM (phone)</Button>
                </div>
                {howTo === "obs" ? (
                  <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                    <li>In OBS, add a <strong>Browser Source</strong> and paste the link.</li>
                    <li>Set width <strong>1920</strong> and height <strong>1080</strong>.</li>
                    <li>Tick <strong>Shutdown source when not visible</strong>. The background is already see-through.</li>
                    <li>Put the Browser Source above your camera in the source list.</li>
                  </ol>
                ) : (
                  <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                    <li>Unlock the phone's rotation and turn it sideways. PRISM locks the direction when you go live.</li>
                    <li>Swipe right → <strong>My Studio</strong> → <strong>Widget</strong> → <strong>Web</strong> → paste the link → <strong>Save</strong>.</li>
                    <li><strong>Stretch the widget to fill the whole screen.</strong> The league logo and pop-ups need the full picture, not just the bottom.</li>
                    <li>Test with Facebook privacy set to <strong>Only me</strong>, then go live.</li>
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          {selectedLeagueId && (
            <aside className="lg:sticky lg:top-4 order-first lg:order-none">
              <div className="rounded-2xl bg-[#0B1628] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-white">Preview</h2>
                  <span className="text-xs text-slate-400">example teams and players</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MOMENTS.map((m) => (
                    <button key={m.key} type="button" onClick={() => setMoment(m.key)}
                      className={`text-xs font-semibold rounded-full px-3 py-1 border ${moment === m.key ? "bg-orange-500 border-orange-500 text-white" : "border-white/20 text-slate-300"}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="relative w-full overflow-hidden rounded-md" style={{ aspectRatio: "16 / 9", containerType: "inline-size", background: "linear-gradient(180deg,#3a3f4a 0%,#50607a 18%,#4a3a2a 40%,#8a6538 68%,#6b4a2a 100%)" }}>
                  <LiveOverlayLayout d={d} clockText={previewClock} pop={pop} card={card} tickerText={showTicker ? tickerText : ""} />
                </div>
                <p className="text-xs text-slate-400 min-h-[16px]">{offNote || "Updates as you change settings. Save to send it to live overlays."}</p>
              </div>
            </aside>
          )}
        </div>

        {selectedLeagueId && (
          <div className="sticky bottom-0 z-40 mt-6 rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className={`text-sm ${message === "error" ? "text-red-600" : message === "saved" ? "text-green-600" : "text-slate-500"}`}>
                {message === "error" ? "Couldn't save. Check your connection and try again."
                  : message === "saved" ? "Saved. Live overlays pick this up within a few seconds."
                  : dirty ? "You have unsaved changes" : "All changes saved"}
              </span>
              <Button onClick={handleSave} disabled={saving || !!uploading || !dirty} className="bg-purple-600 hover:bg-purple-700 text-white">
                {message === "saved" && !dirty ? <><CheckCircle className="w-4 h-4 mr-2" />Saved</> : saving ? "Saving..." : "Save settings"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
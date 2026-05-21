import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy, Shield, Star, Users, Save, RotateCcw, Info, CheckCircle, BookOpen, ChevronDown, ChevronUp, History } from "lucide-react";
import { DEFAULT_AWARD_SETTINGS, resolveSettings } from "@/utils/awardDefaults";
import { format } from "date-fns";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

const FIELD_LABELS = {
  mvp_pts_weight: "MVP — Points weight",
  mvp_oreb_weight: "MVP — Offensive rebound weight",
  mvp_dreb_weight: "MVP — Defensive rebound weight",
  mvp_ast_weight: "MVP — Assist weight",
  mvp_stl_weight: "MVP — Steal weight",
  mvp_blk_weight: "MVP — Block weight",
  mvp_turnover_penalty: "MVP — Turnover penalty",
  mvp_foul_penalty: "MVP — Foul penalty",
  mvp_tech_penalty: "MVP — Technical foul penalty",
  mvp_unsportsmanlike_penalty: "MVP — Unsportsmanlike penalty",
  mvp_avg_gis_weight: "MVP — Avg GIS contribution",
  mvp_gp_percent_weight: "MVP — Games played % contribution",
  mvp_team_win_percent_weight: "MVP — Team win % contribution",
  mvp_min_games_percent: "MVP — Minimum games played %",
  mvp_tech_final_penalty: "MVP — Season tech foul penalty",
  mvp_unsp_final_penalty: "MVP — Season unsports. penalty",
  dpoy_stl_weight: "DPOY — Steal weight",
  dpoy_blk_weight: "DPOY — Block weight",
  dpoy_oreb_weight: "DPOY — Offensive rebound weight",
  dpoy_dreb_weight: "DPOY — Defensive rebound weight",
  dpoy_foul_penalty: "DPOY — Foul penalty",
  dpoy_turnover_penalty: "DPOY — Turnover penalty",
  dpoy_tech_penalty: "DPOY — Technical foul penalty",
  dpoy_unsportsmanlike_penalty: "DPOY — Unsportsmanlike penalty",
  dpoy_gp_percent_weight: "DPOY — Games played % contribution",
  dpoy_min_games_percent: "DPOY — Minimum games played %",
  dpoy_tech_final_penalty: "DPOY — Season tech foul penalty",
  dpoy_unsp_final_penalty: "DPOY — Season unsports. penalty",
  pog_pts_weight: "POG — Points weight",
  pog_oreb_weight: "POG — Offensive rebound weight",
  pog_dreb_weight: "POG — Defensive rebound weight",
  pog_ast_weight: "POG — Assist weight",
  pog_stl_weight: "POG — Steal weight",
  pog_blk_weight: "POG — Block weight",
  pog_turnover_penalty: "POG — Turnover penalty",
  pog_foul_penalty: "POG — Foul penalty",
  pog_tech_penalty: "POG — Technical foul penalty",
  pog_unsportsmanlike_penalty: "POG — Unsportsmanlike penalty",
  pog_winning_team_only: "POG — Winning team only",
  mythical_five_count: "Mythical Five — Number of players",
};

function NumField({ label, info, value, onChange, min = 0, max = 20, step = 0.1 }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {info && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-slate-400 hover:text-slate-600 focus:outline-none">
                <Info className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="max-w-xs text-sm text-slate-600 p-3">
              {info}
            </PopoverContent>
          </Popover>
        )}
      </div>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
      />
    </div>
  );
}

function SectionCard({ icon: Icon, iconColor, title, description, children, insight, onExample }) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <span className="flex-1">{title}</span>
          {onExample && (
            <Button size="sm" onClick={onExample} className="bg-orange-500 hover:bg-orange-600 text-white font-medium">
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              See Example
            </Button>
          )}
        </CardTitle>
        <p className="text-sm text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        {insight && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700 flex gap-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{insight}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FieldGrid({ children }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{children}</div>;
}

export default function LeagueAwardSettings() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [settings, setSettings] = useState(null);
  const [savedSettingsId, setSavedSettingsId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [resetPending, setResetPending] = useState(false);
  const [showMvpExample, setShowMvpExample] = useState(false);
  const [showDpoyExample, setShowDpoyExample] = useState(false);
  const [showPogExample, setShowPogExample] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");
  const [logLeagueId, setLogLeagueId] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
    staleTime: 60000,
  });

  const { data: myLeagueIdentities = [], isLoading: identitiesLoading } = useQuery({
    queryKey: ["myLeagueIdentities", currentUser?.id],
    queryFn: () => base44.entities.UserLeagueIdentity.filter({ user_id: currentUser.id }),
    enabled: !!currentUser?.id && currentUser?.user_type !== "app_admin",
    staleTime: 60000,
  });

  const visibleLeagues = (() => {
    if (currentUser?.user_type === "app_admin") return leagues;
    if (identitiesLoading) return [];
    const nonAdminLeagueIds = myLeagueIdentities
      .filter(i => i.role !== "league_admin")
      .map(i => i.league_id);
    const assignedIds = currentUser?.assigned_league_ids || [];
    const adminIds = assignedIds.filter(id => !nonAdminLeagueIds.includes(id));
    return leagues.filter(l => adminIds.includes(l.id));
  })();

  const { data: existingSettings = [] } = useQuery({
    queryKey: ["awardSettings"],
    queryFn: () => base44.entities.AwardSettings.list(),
    staleTime: 0,
  });

  const effectiveLogLeagueId = logLeagueId || selectedLeagueId;
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["awardSettingsLog", effectiveLogLeagueId],
    queryFn: () => base44.entities.AwardSettingsLog.filter(
      { league_id: effectiveLogLeagueId },
      "-changed_at",
      100
    ),
    enabled: !!effectiveLogLeagueId,
    staleTime: 0,
  });

  const selectedLeague = leagues.find(l => l.id === selectedLeagueId);

  // Load settings when league changes
  useEffect(() => {
    if (!selectedLeagueId) return;
    const existing = existingSettings.find(s => s.league_id === selectedLeagueId);
    if (existing) {
      setSavedSettingsId(existing.id);
      setSettings(resolveSettings(existing));
    } else {
      setSavedSettingsId(null);
      setSettings({ ...DEFAULT_AWARD_SETTINGS });
    }
    setIsDirty(false);
    setSuccessMsg("");
  }, [selectedLeagueId, existingSettings]);

  const set = useCallback((key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }));
    setIsDirty(true);
    setSuccessMsg("");
  }, []);

  const handleSave = async () => {
    if (!selectedLeagueId || !settings) return;
    setSaving(true);
    try {
      const payload = {
        ...settings,
        league_id: selectedLeagueId,
        league_name: selectedLeague?.name || "",
        updated_by: currentUser?.email || "",
        updated_by_role: currentUser?.user_type || "",
        updated_at: new Date().toISOString(),
      };
      if (savedSettingsId) {
        await base44.entities.AwardSettings.update(savedSettingsId, payload);
      } else {
        const created = await base44.entities.AwardSettings.create(payload);
        setSavedSettingsId(created.id);
      }
      queryClient.invalidateQueries({ queryKey: ["awardSettings"] });

      // Build audit log
      const changes = Object.keys(FIELD_LABELS)
        .filter(key => {
          const oldVal = savedRecord ? savedRecord[key] : DEFAULT_AWARD_SETTINGS[key];
          return String(settings[key]) !== String(oldVal ?? "");
        })
        .map(key => ({
          field_key: key,
          field_label: FIELD_LABELS[key],
          old_value: String(savedRecord ? (savedRecord[key] ?? DEFAULT_AWARD_SETTINGS[key]) : DEFAULT_AWARD_SETTINGS[key]),
          new_value: String(settings[key]),
        }));
      if (changes.length > 0) {
        await base44.entities.AwardSettingsLog.create({
          league_id: selectedLeagueId,
          league_name: selectedLeague?.name || "",
          changed_by: currentUser?.email || "",
          changed_at: new Date().toISOString(),
          changes,
        });
        queryClient.invalidateQueries({ queryKey: ["awardSettingsLog", selectedLeagueId] });
      }

      setIsDirty(false);
      setSuccessMsg(`Award settings saved for ${selectedLeague?.name}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!resetPending) { setResetPending(true); return; }
    setSettings({ ...DEFAULT_AWARD_SETTINGS });
    setIsDirty(true);
    setResetPending(false);
  };

  const handleCancel = () => {
    if (!selectedLeagueId) return;
    const existing = existingSettings.find(s => s.league_id === selectedLeagueId);
    setSettings(existing ? resolveSettings(existing) : { ...DEFAULT_AWARD_SETTINGS });
    setIsDirty(false);
    setResetPending(false);
    setSuccessMsg("");
  };

  const savedRecord = existingSettings.find(s => s.league_id === selectedLeagueId);

  if (currentUser && currentUser.user_type !== "app_admin" && currentUser.user_type !== "league_admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Access restricted to league administrators and above.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Award Settings</h1>
              <p className="text-slate-500 text-sm mt-0.5">Adjust how awards are calculated for the selected league. These settings only affect this league.</p>
            </div>
          </div>
        </div>

        {/* League Selector */}
        <Card className="border-slate-200 mb-6">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-semibold text-slate-700 block mb-1">Select League</label>
                <Select value={selectedLeagueId || ""} onValueChange={v => {
                  if (isDirty && !window.confirm("You have unsaved changes. Switch league anyway?")) return;
                  setSelectedLeagueId(v);
                }}>
                  <SelectTrigger className="w-full max-w-sm">
                    <SelectValue placeholder="Choose a league..." />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleLeagues.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name} ({l.season})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {savedRecord && currentUser && (
                currentUser.user_type === "app_admin" ||
                (currentUser.user_type === "league_admin" && 
                 savedRecord.updated_by_role === "league_admin")
              ) && (
                <div className="text-right text-xs text-slate-400 flex-shrink-0">
                  <p>Last saved by <span className="font-medium text-slate-600">
                    {savedRecord.updated_by || "—"}
                  </span></p>
                  <p>{savedRecord.updated_at ? 
                    format(new Date(savedRecord.updated_at), "MMM d, yyyy HH:mm") 
                    : "—"}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {!selectedLeagueId && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <Trophy className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p>Select a league above to view and edit its award settings.</p>
          </div>
        )}

        {selectedLeagueId && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="history">
                <History className="w-4 h-4 mr-1.5" />
                Change History
              </TabsTrigger>
            </TabsList>

            {/* ── CHANGE HISTORY TAB ── */}
            <TabsContent value="history">
              {currentUser?.user_type === "app_admin" && (
                <div className="mb-4">
                  <label className="text-sm font-semibold text-slate-700 block mb-1">View history for league</label>
                  <Select value={logLeagueId || selectedLeagueId} onValueChange={setLogLeagueId}>
                    <SelectTrigger className="w-full max-w-sm">
                      <SelectValue placeholder="Choose a league..." />
                    </SelectTrigger>
                    <SelectContent>
                      {leagues.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.name} ({l.season})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {auditLogs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
                  <History className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                  <p>No changes recorded yet for this league.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map(log => (
                    <AuditLogRow key={log.id} log={log} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── SETTINGS TAB ── */}
            <TabsContent value="settings">
              {settings && (
          <>
            {/* Summary card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: "MVP Eligibility", value: `≥ ${settings.mvp_min_games_percent}% GP` },
                { label: "DPOY Eligibility", value: `≥ ${settings.dpoy_min_games_percent}% GP` },
                { label: "POG: Winning team only", value: settings.pog_winning_team_only ? "Yes" : "No" },
                { label: "Mythical Five", value: `Top ${settings.mythical_five_count} MVP` },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
                  <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                  <p className="text-sm font-bold text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>

            {successMsg && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 mb-5 text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {successMsg}
              </div>
            )}

            <div className="space-y-6">
              {/* MVP */}
              <SectionCard
                icon={Trophy}
                iconColor="text-yellow-500"
                title="MVP Settings"
                description="Controls how the Most Valuable Player ranking is calculated."
                insight="Higher weights increase a stat's influence on the MVP score. Penalty weights reduce the score. The minimum games played % sets who is eligible — raise it to be stricter."
                onExample={() => setShowMvpExample(true)}
              >
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2 text-sm text-blue-700">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
                  <span>How MVP is calculated: For each game, we calculate a player's Game Impact Score (GIS) using the weights you set below — points, rebounds, assists, steals and blocks add to the score, while turnovers and fouls subtract from it. At the end of the season, each player's GIS is averaged across all games they played. The final MVP score is built on top of that average, plus bonuses for showing up consistently and being on a winning team.</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Statistic Weights</p>
                  <FieldGrid>
                    <NumField label="Points weight" value={settings.mvp_pts_weight} onChange={v => set("mvp_pts_weight", v)} info="Multiplier applied to a player's total points in each game when calculating their GIS." />
                    <NumField label="Offensive rebound weight" value={settings.mvp_oreb_weight} onChange={v => set("mvp_oreb_weight", v)} info="Multiplier applied to each offensive rebound when calculating a player's GIS." />
                    <NumField label="Defensive rebound weight" value={settings.mvp_dreb_weight} onChange={v => set("mvp_dreb_weight", v)} info="Multiplier applied to each defensive rebound when calculating a player's GIS." />
                    <NumField label="Assist weight" value={settings.mvp_ast_weight} onChange={v => set("mvp_ast_weight", v)} info="Multiplier applied to each assist when calculating a player's GIS." />
                    <NumField label="Steal weight" value={settings.mvp_stl_weight} onChange={v => set("mvp_stl_weight", v)} info="Multiplier applied to each steal when calculating a player's GIS." />
                    <NumField label="Block weight" value={settings.mvp_blk_weight} onChange={v => set("mvp_blk_weight", v)} info="Multiplier applied to each block when calculating a player's GIS." />
                  </FieldGrid>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3">Penalties (reduce score)</p>
                  <FieldGrid>
                    <NumField label="Turnover penalty" value={settings.mvp_turnover_penalty} onChange={v => set("mvp_turnover_penalty", v)} info="Amount subtracted from a player's GIS for each turnover." />
                    <NumField label="Foul penalty" value={settings.mvp_foul_penalty} onChange={v => set("mvp_foul_penalty", v)} info="Amount subtracted from a player's GIS for each personal foul." />
                    <NumField label="Technical foul penalty" value={settings.mvp_tech_penalty} onChange={v => set("mvp_tech_penalty", v)} info="Amount subtracted from a player's GIS for each technical foul." />
                    <NumField label="Unsportsmanlike penalty" value={settings.mvp_unsportsmanlike_penalty} onChange={v => set("mvp_unsportsmanlike_penalty", v)} info="Amount subtracted from a player's GIS for each unsportsmanlike foul." />
                  </FieldGrid>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Final Score Contributions</p>
                  <FieldGrid>
                    <NumField label="Avg GIS contribution" value={settings.mvp_avg_gis_weight} onChange={v => set("mvp_avg_gis_weight", v)} min={0} max={5} step={0.05} info="Multiplier applied to the player's average GIS across all games played. This is the main driver of the final MVP score." />
                    <NumField label="Games played % contribution" value={settings.mvp_gp_percent_weight} onChange={v => set("mvp_gp_percent_weight", v)} min={0} max={50} step={1} info="Points added to the final MVP score based on the percentage of games the player appeared in." />
                    <NumField label="Team win % contribution" value={settings.mvp_team_win_percent_weight} onChange={v => set("mvp_team_win_percent_weight", v)} min={0} max={50} step={1} info="Points added to the final MVP score based on the win percentage of the player's team." />
                    <NumField label="Season tech foul penalty" value={settings.mvp_tech_final_penalty} onChange={v => set("mvp_tech_final_penalty", v)} min={0} max={20} step={0.5} info="Amount subtracted from the final MVP score for each technical foul accumulated across the season." />
                    <NumField label="Season unsports. penalty" value={settings.mvp_unsp_final_penalty} onChange={v => set("mvp_unsp_final_penalty", v)} min={0} max={20} step={0.5} info="Amount subtracted from the final MVP score for each unsportsmanlike foul accumulated across the season." />
                  </FieldGrid>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Eligibility</p>
                  <div className="max-w-xs">
                    <NumField
                      label="Minimum games played %"
                      info="The minimum percentage of season games a player must have appeared in to be eligible for MVP. Enter as a number — e.g. 60 means 60%."
                      value={settings.mvp_min_games_percent}
                      onChange={v => set("mvp_min_games_percent", v)}
                      min={0} max={100} step={5}
                    />
                  </div>
                </div>
              </SectionCard>

              {/* DPOY */}
              <SectionCard
                icon={Shield}
                iconColor="text-blue-500"
                title="Defensive Player of the Year (DPOY) Settings"
                description="Controls how the best defender of the season is chosen. Scoring is not included — this is purely defense."
                insight="Higher steal and block weights reward lockdown defenders. Raise the foul penalty to favor disciplined defenders."
                onExample={() => setShowDpoyExample(true)}
              >
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Defensive Weights</p>
                  <FieldGrid>
                    <NumField label="Steal weight" value={settings.dpoy_stl_weight} onChange={v => set("dpoy_stl_weight", v)} info="Multiplier applied to each steal when calculating a player's defensive GIS." />
                    <NumField label="Block weight" value={settings.dpoy_blk_weight} onChange={v => set("dpoy_blk_weight", v)} info="Multiplier applied to each block when calculating a player's defensive GIS." />
                    <NumField label="Offensive rebound weight" value={settings.dpoy_oreb_weight} onChange={v => set("dpoy_oreb_weight", v)} info="Multiplier applied to each offensive rebound when calculating a player's defensive GIS." />
                    <NumField label="Defensive rebound weight" value={settings.dpoy_dreb_weight} onChange={v => set("dpoy_dreb_weight", v)} info="Multiplier applied to each defensive rebound when calculating a player's defensive GIS." />
                  </FieldGrid>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3">Penalties</p>
                  <FieldGrid>
                    <NumField label="Foul penalty" value={settings.dpoy_foul_penalty} onChange={v => set("dpoy_foul_penalty", v)} info="Amount subtracted from a player's defensive GIS for each personal foul." />
                    <NumField label="Turnover penalty" value={settings.dpoy_turnover_penalty} onChange={v => set("dpoy_turnover_penalty", v)} info="Amount subtracted from a player's defensive GIS for each turnover." />
                    <NumField label="Technical foul penalty" value={settings.dpoy_tech_penalty} onChange={v => set("dpoy_tech_penalty", v)} info="Amount subtracted from the final DPOY score for each technical foul across the season." />
                    <NumField label="Unsportsmanlike penalty" value={settings.dpoy_unsportsmanlike_penalty} onChange={v => set("dpoy_unsportsmanlike_penalty", v)} info="Amount subtracted from the final DPOY score for each unsportsmanlike foul across the season." />
                  </FieldGrid>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Final Score &amp; Eligibility</p>
                  <FieldGrid>
                    <NumField label="Games played % contribution" value={settings.dpoy_gp_percent_weight} onChange={v => set("dpoy_gp_percent_weight", v)} min={0} max={50} step={1} info="Points added to the final DPOY score based on the percentage of games the player appeared in." />
                    <NumField label="Season tech foul penalty" value={settings.dpoy_tech_final_penalty} onChange={v => set("dpoy_tech_final_penalty", v)} min={0} max={20} step={0.5} info="Amount subtracted from the final DPOY score for each technical foul across the season." />
                    <NumField label="Season unsports. penalty" value={settings.dpoy_unsp_final_penalty} onChange={v => set("dpoy_unsp_final_penalty", v)} min={0} max={20} step={0.5} info="Amount subtracted from the final DPOY score for each unsportsmanlike foul across the season." />
                    <NumField label="Minimum games played %" value={settings.dpoy_min_games_percent} onChange={v => set("dpoy_min_games_percent", v)} min={0} max={100} step={5} info="The minimum percentage of season games a player must have appeared in to be eligible for DPOY. Enter as a number — e.g. 60 means 60%." />
                  </FieldGrid>
                </div>
              </SectionCard>

              {/* POG */}
              <SectionCard
                icon={Star}
                iconColor="text-orange-500"
                title="Player of the Game (POG) Settings"
                description="Controls how the best player of each individual game is selected."
                insight="The POG is picked automatically after each completed game based on the highest score from the formulas below."
                onExample={() => setShowPogExample(true)}
              >
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Statistic Weights</p>
                  <FieldGrid>
                    <NumField label="Points weight" value={settings.pog_pts_weight} onChange={v => set("pog_pts_weight", v)} info="Multiplier applied to a player's total points when calculating their POG score for that game." />
                    <NumField label="Offensive rebound weight" value={settings.pog_oreb_weight} onChange={v => set("pog_oreb_weight", v)} info="Multiplier applied to each offensive rebound in the POG calculation." />
                    <NumField label="Defensive rebound weight" value={settings.pog_dreb_weight} onChange={v => set("pog_dreb_weight", v)} info="Multiplier applied to each defensive rebound in the POG calculation." />
                    <NumField label="Assist weight" value={settings.pog_ast_weight} onChange={v => set("pog_ast_weight", v)} info="Multiplier applied to each assist in the POG calculation." />
                    <NumField label="Steal weight" value={settings.pog_stl_weight} onChange={v => set("pog_stl_weight", v)} info="Multiplier applied to each steal in the POG calculation." />
                    <NumField label="Block weight" value={settings.pog_blk_weight} onChange={v => set("pog_blk_weight", v)} info="Multiplier applied to each block in the POG calculation." />
                  </FieldGrid>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3">Penalties</p>
                  <FieldGrid>
                    <NumField label="Turnover penalty" value={settings.pog_turnover_penalty} onChange={v => set("pog_turnover_penalty", v)} info="Amount subtracted from the POG score for each turnover." />
                    <NumField label="Foul penalty" value={settings.pog_foul_penalty} onChange={v => set("pog_foul_penalty", v)} info="Amount subtracted from the POG score for each personal foul." />
                    <NumField label="Technical foul penalty" value={settings.pog_tech_penalty} onChange={v => set("pog_tech_penalty", v)} info="Amount subtracted from the POG score for each technical foul." />
                    <NumField label="Unsportsmanlike penalty" value={settings.pog_unsportsmanlike_penalty} onChange={v => set("pog_unsportsmanlike_penalty", v)} info="Amount subtracted from the POG score for each unsportsmanlike foul." />
                  </FieldGrid>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    id="pog_winning"
                    checked={!!settings.pog_winning_team_only}
                    onChange={e => set("pog_winning_team_only", e.target.checked)}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <div className="flex items-center gap-1">
                    <label htmlFor="pog_winning" className="text-sm font-medium text-slate-700 cursor-pointer">
                      Only choose Player of the Game from the winning team
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="text-slate-400 hover:text-slate-600 focus:outline-none">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="max-w-xs text-sm text-slate-600 p-3">
                        When ON, only players from the winning team are considered for Player of the Game.
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </SectionCard>

              {/* Mythical Five */}
              <SectionCard
                icon={Users}
                iconColor="text-purple-500"
                title="Mythical Five Settings"
                description="The Mythical Five are the top players selected at the end of the season."
                insight="By default, the top players from the MVP rankings form the Mythical Five. The count sets how many players are included."
              >
                <FieldGrid>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-slate-700">Selection source</label>
                    <p className="text-xs text-slate-400">How the Mythical Five are chosen</p>
                    <select
                      value={settings.mythical_five_source}
                      onChange={e => set("mythical_five_source", e.target.value)}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                    >
                      <option value="mvp_rankings">Top MVP Rankings</option>
                    </select>
                  </div>
                  <NumField
                    label="Number of players"
                    info="How many players make the Mythical Five"
                    value={settings.mythical_five_count}
                    onChange={v => set("mythical_five_count", Math.round(v))}
                    min={1} max={10} step={1}
                  />
                </FieldGrid>
              </SectionCard>
            </div>

            {/* MVP Example Dialog */}
            <Dialog open={showMvpExample} onOpenChange={setShowMvpExample}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    How MVP is Calculated — Example
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-slate-600 mt-1">
                  For each game, a player earns a Game Impact Score (GIS) based on their stats multiplied by the weights you set. At the end of the season, their average GIS is combined with bonuses for games played and team wins to produce the final MVP score.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Carlo */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <div>
                      <p className="font-bold text-slate-800">Carlo Santos <span className="font-normal text-slate-500 text-sm">(Pure Scorer)</span></p>
                      <p className="text-xs text-slate-500">Played: 10/10 games · Team wins: 5/10</p>
                      <p className="text-xs text-slate-500">24 pts, 2 ast, 1 oreb, 3 dreb, 1 stl, 0 blk, 3 to, 2 fouls</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">GIS Breakdown (per game)</p>
                      <div className="text-xs text-slate-700 space-y-0.5 font-mono">
                        <div className="flex justify-between"><span>24 pts × 1.0</span><span className="text-green-600">+24.0</span></div>
                        <div className="flex justify-between"><span>2 ast × 1.5</span><span className="text-green-600">+3.0</span></div>
                        <div className="flex justify-between"><span>1 oreb × 1.2</span><span className="text-green-600">+1.2</span></div>
                        <div className="flex justify-between"><span>3 dreb × 1.0</span><span className="text-green-600">+3.0</span></div>
                        <div className="flex justify-between"><span>1 stl × 2.5</span><span className="text-green-600">+2.5</span></div>
                        <div className="flex justify-between"><span>3 to × 2.0</span><span className="text-red-500">−6.0</span></div>
                        <div className="flex justify-between"><span>2 f × 0.5</span><span className="text-red-500">−1.0</span></div>
                        <div className="flex justify-between border-t border-slate-300 pt-1 font-bold"><span>GIS per game</span><span>26.7</span></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Final MVP Score</p>
                      <div className="text-xs text-slate-700 space-y-0.5 font-mono">
                        <div className="flex justify-between"><span>0.6 × 26.7 (avg GIS)</span><span>16.02</span></div>
                        <div className="flex justify-between"><span>20 × 1.0 (games played)</span><span>20.00</span></div>
                        <div className="flex justify-between"><span>20 × 0.5 (team wins)</span><span>10.00</span></div>
                        <div className="flex justify-between border-t border-slate-300 pt-1 font-bold"><span>TOTAL</span><span>46.02</span></div>
                      </div>
                    </div>
                  </div>
                  {/* Marcus */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <div>
                      <p className="font-bold text-slate-800">Marcus Reyes <span className="font-normal text-slate-500 text-sm">(Two-way Player)</span></p>
                      <p className="text-xs text-slate-500">Played: 9/10 games · Team wins: 7/10</p>
                      <p className="text-xs text-slate-500">15 pts, 6 ast, 2 oreb, 5 dreb, 3 stl, 1 blk, 2 to, 2 fouls</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">GIS Breakdown (per game)</p>
                      <div className="text-xs text-slate-700 space-y-0.5 font-mono">
                        <div className="flex justify-between"><span>15 pts × 1.0</span><span className="text-green-600">+15.0</span></div>
                        <div className="flex justify-between"><span>6 ast × 1.5</span><span className="text-green-600">+9.0</span></div>
                        <div className="flex justify-between"><span>2 oreb × 1.2</span><span className="text-green-600">+2.4</span></div>
                        <div className="flex justify-between"><span>5 dreb × 1.0</span><span className="text-green-600">+5.0</span></div>
                        <div className="flex justify-between"><span>3 stl × 2.5</span><span className="text-green-600">+7.5</span></div>
                        <div className="flex justify-between"><span>1 blk × 2.0</span><span className="text-green-600">+2.0</span></div>
                        <div className="flex justify-between"><span>2 to × 2.0</span><span className="text-red-500">−4.0</span></div>
                        <div className="flex justify-between"><span>2 f × 0.5</span><span className="text-red-500">−1.0</span></div>
                        <div className="flex justify-between border-t border-slate-300 pt-1 font-bold"><span>GIS per game</span><span>35.9</span></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Final MVP Score</p>
                      <div className="text-xs text-slate-700 space-y-0.5 font-mono">
                        <div className="flex justify-between"><span>0.6 × 35.9 (avg GIS)</span><span>21.54</span></div>
                        <div className="flex justify-between"><span>20 × 0.9 (games played)</span><span>18.00</span></div>
                        <div className="flex justify-between"><span>20 × 0.7 (team wins)</span><span>14.00</span></div>
                        <div className="flex justify-between border-t border-slate-300 pt-1 font-bold"><span>TOTAL</span><span>53.54</span></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                  <p className="font-bold mb-1">🏆 Marcus Reyes wins MVP — 53.54 vs 46.02</p>
                  <p>Despite scoring less than Carlo, Marcus's assists, steals and blocks gave him a much higher GIS (35.9 vs 26.7). Playing on a winning team added to his bonus as well.</p>
                </div>
              </DialogContent>
            </Dialog>

            {/* DPOY Example Dialog */}
            <Dialog open={showDpoyExample} onOpenChange={setShowDpoyExample}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <Shield className="w-5 h-5 text-blue-500" />
                    How DPOY is Calculated — Example
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-slate-600 mt-1">
                  A player's Defensive GIS is calculated from steals, blocks and rebounds, minus penalties for fouls and turnovers. Points are not included — DPOY is purely defensive. The final score is the average Defensive GIS plus a games played bonus.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Dante */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <div>
                      <p className="font-bold text-slate-800">Dante Cruz <span className="font-normal text-slate-500 text-sm">(Paint Protector)</span></p>
                      <p className="text-xs text-slate-500">Played: 10/10 games</p>
                      <p className="text-xs text-slate-500">1 stl, 4 blk, 3 oreb, 8 dreb, 3 fouls, 1 to</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Defensive GIS (per game)</p>
                      <div className="text-xs text-slate-700 space-y-0.5 font-mono">
                        <div className="flex justify-between"><span>1 stl × 3.0</span><span className="text-green-600">+3.0</span></div>
                        <div className="flex justify-between"><span>4 blk × 2.5</span><span className="text-green-600">+10.0</span></div>
                        <div className="flex justify-between"><span>3 oreb × 1.5</span><span className="text-green-600">+4.5</span></div>
                        <div className="flex justify-between"><span>8 dreb × 1.0</span><span className="text-green-600">+8.0</span></div>
                        <div className="flex justify-between"><span>3 f × 1.5</span><span className="text-red-500">−4.5</span></div>
                        <div className="flex justify-between"><span>1 to × 2.0</span><span className="text-red-500">−2.0</span></div>
                        <div className="flex justify-between border-t border-slate-300 pt-1 font-bold"><span>Def. GIS per game</span><span>19.0</span></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Final DPOY Score</p>
                      <div className="text-xs text-slate-700 space-y-0.5 font-mono">
                        <div className="flex justify-between"><span>19.0 avg Def. GIS</span><span>19.0</span></div>
                        <div className="flex justify-between"><span>10 × 1.0 (games played)</span><span>10.0</span></div>
                        <div className="flex justify-between border-t border-slate-300 pt-1 font-bold"><span>TOTAL</span><span>29.0</span></div>
                      </div>
                    </div>
                  </div>
                  {/* Bryan */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <div>
                      <p className="font-bold text-slate-800">Bryan Santos <span className="font-normal text-slate-500 text-sm">(Perimeter Disruptor)</span></p>
                      <p className="text-xs text-slate-500">Played: 10/10 games</p>
                      <p className="text-xs text-slate-500">4 stl, 1 blk, 1 oreb, 4 dreb, 2 fouls, 2 to</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Defensive GIS (per game)</p>
                      <div className="text-xs text-slate-700 space-y-0.5 font-mono">
                        <div className="flex justify-between"><span>4 stl × 3.0</span><span className="text-green-600">+12.0</span></div>
                        <div className="flex justify-between"><span>1 blk × 2.5</span><span className="text-green-600">+2.5</span></div>
                        <div className="flex justify-between"><span>1 oreb × 1.5</span><span className="text-green-600">+1.5</span></div>
                        <div className="flex justify-between"><span>4 dreb × 1.0</span><span className="text-green-600">+4.0</span></div>
                        <div className="flex justify-between"><span>2 f × 1.5</span><span className="text-red-500">−3.0</span></div>
                        <div className="flex justify-between"><span>2 to × 2.0</span><span className="text-red-500">−4.0</span></div>
                        <div className="flex justify-between border-t border-slate-300 pt-1 font-bold"><span>Def. GIS per game</span><span>13.0</span></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Final DPOY Score</p>
                      <div className="text-xs text-slate-700 space-y-0.5 font-mono">
                        <div className="flex justify-between"><span>13.0 avg Def. GIS</span><span>13.0</span></div>
                        <div className="flex justify-between"><span>10 × 1.0 (games played)</span><span>10.0</span></div>
                        <div className="flex justify-between border-t border-slate-300 pt-1 font-bold"><span>TOTAL</span><span>23.0</span></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                  <p className="font-bold mb-1">🏆 Dante Cruz wins DPOY — 29.0 vs 23.0</p>
                  <p>Despite Bryan averaging 4 steals per game, Dante's 4 blocks (×2.5 = 10 per game) and 8 defensive rebounds gave him a much higher Defensive GIS. Fouls and turnovers cost Bryan 7 points per game.</p>
                </div>
              </DialogContent>
            </Dialog>

            {/* POG Example Dialog */}
            <Dialog open={showPogExample} onOpenChange={setShowPogExample}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <Star className="w-5 h-5 text-orange-500" />
                    How Player of the Game is Calculated — Example
                  </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-slate-600 mt-1">
                  POG uses the same weighted formula as MVP but for a single game only. The player with the highest score wins. If 'Winning team only' is ON, only players from the winning team are considered.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {/* Rico */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <div>
                      <p className="font-bold text-slate-800">Rico Macaraeg <span className="font-normal text-slate-500 text-sm">(Scorer)</span></p>
                      <p className="text-xs text-slate-500">28 pts, 2 ast, 1 oreb, 3 dreb, 1 stl, 1 blk, 3 to, 4 fouls</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">POG Score Breakdown</p>
                      <div className="text-xs text-slate-700 space-y-0.5 font-mono">
                        <div className="flex justify-between"><span>28 pts × 1.0</span><span className="text-green-600">+28.0</span></div>
                        <div className="flex justify-between"><span>2 ast × 1.5</span><span className="text-green-600">+3.0</span></div>
                        <div className="flex justify-between"><span>1 oreb × 1.2</span><span className="text-green-600">+1.2</span></div>
                        <div className="flex justify-between"><span>3 dreb × 1.0</span><span className="text-green-600">+3.0</span></div>
                        <div className="flex justify-between"><span>1 stl × 2.5</span><span className="text-green-600">+2.5</span></div>
                        <div className="flex justify-between"><span>1 blk × 2.0</span><span className="text-green-600">+2.0</span></div>
                        <div className="flex justify-between"><span>3 to × 2.0</span><span className="text-red-500">−6.0</span></div>
                        <div className="flex justify-between"><span>4 f × 0.5</span><span className="text-red-500">−2.0</span></div>
                        <div className="flex justify-between border-t border-slate-300 pt-1 font-bold"><span>POG Score</span><span>31.7</span></div>
                      </div>
                    </div>
                  </div>
                  {/* Jomar */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <div>
                      <p className="font-bold text-slate-800">Jomar dela Cruz <span className="font-normal text-slate-500 text-sm">(Playmaker)</span></p>
                      <p className="text-xs text-slate-500">14 pts, 11 ast, 2 oreb, 4 dreb, 3 stl, 0 blk, 1 to, 2 fouls</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">POG Score Breakdown</p>
                      <div className="text-xs text-slate-700 space-y-0.5 font-mono">
                        <div className="flex justify-between"><span>14 pts × 1.0</span><span className="text-green-600">+14.0</span></div>
                        <div className="flex justify-between"><span>11 ast × 1.5</span><span className="text-green-600">+16.5</span></div>
                        <div className="flex justify-between"><span>2 oreb × 1.2</span><span className="text-green-600">+2.4</span></div>
                        <div className="flex justify-between"><span>4 dreb × 1.0</span><span className="text-green-600">+4.0</span></div>
                        <div className="flex justify-between"><span>3 stl × 2.5</span><span className="text-green-600">+7.5</span></div>
                        <div className="flex justify-between"><span>1 to × 2.0</span><span className="text-red-500">−2.0</span></div>
                        <div className="flex justify-between"><span>2 f × 0.5</span><span className="text-red-500">−1.0</span></div>
                        <div className="flex justify-between border-t border-slate-300 pt-1 font-bold"><span>POG Score</span><span>41.4</span></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                  <p className="font-bold mb-1">🏆 Jomar dela Cruz wins POG — 41.4 vs 31.7</p>
                  <p>Despite scoring only 14 points, Jomar's 11 assists (×1.5 = 16.5) and 3 steals (×2.5 = 7.5) made the difference. Rico's 3 turnovers and 4 fouls cost him 8 points.</p>
                </div>
              </DialogContent>
            </Dialog>

            {/* Action Bar */}
            <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 mt-8 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                {isDirty && <Badge className="bg-orange-100 text-orange-700">Unsaved changes</Badge>}
                {!isDirty && successMsg && <Badge className="bg-green-100 text-green-700">Saved</Badge>}
              </div>
              <div className="flex gap-3 flex-wrap">
                <Button variant="outline" onClick={handleCancel} disabled={!isDirty}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className={resetPending ? "border-red-400 text-red-600 hover:bg-red-50" : ""}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {resetPending ? "Click again to confirm reset" : "Reset to Default"}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!isDirty || saving}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>
          </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function AuditLogRow({ log }) {
  const [open, setOpen] = useState(false);
  const formatVal = (v) => {
    if (v === "true") return "Yes";
    if (v === "false") return "No";
    return v;
  };
  const dateLabel = log.changed_at
    ? format(new Date(log.changed_at), "MMM d, yyyy · h:mm a")
    : "—";
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 hover:bg-slate-50 transition-colors text-left">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <span className="text-sm font-medium text-slate-800">{dateLabel}</span>
            <span className="text-xs text-slate-500">{log.changed_by}</span>
            <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-medium">
              {log.changes?.length ?? 0} field{log.changes?.length !== 1 ? "s" : ""} changed
            </span>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border border-t-0 border-slate-200 rounded-b-xl overflow-hidden mb-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-1/2">Setting</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Previous value</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">New value</th>
              </tr>
            </thead>
            <tbody>
              {(log.changes || []).map((c, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-700">{c.field_label}</td>
                  <td className="px-4 py-2 text-slate-500">{formatVal(c.old_value)}</td>
                  <td className="px-4 py-2 font-medium text-slate-800">{formatVal(c.new_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trophy, Shield, Star, Users, Save, RotateCcw, Info, CheckCircle } from "lucide-react";
import { DEFAULT_AWARD_SETTINGS, resolveSettings } from "@/utils/awardDefaults";
import { format } from "date-fns";

function NumField({ label, hint, value, onChange, min = 0, max = 20, step = 0.1 }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
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

function SectionCard({ icon: Icon, iconColor, title, description, children, insight }) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          {title}
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

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: leagues = [] } = useQuery({
    queryKey: ["leagues"],
    queryFn: () => base44.entities.League.list(),
    staleTime: 60000,
  });

  const { data: existingSettings = [] } = useQuery({
    queryKey: ["awardSettings"],
    queryFn: () => base44.entities.AwardSettings.list(),
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
        updated_at: new Date().toISOString(),
      };
      if (savedSettingsId) {
        await base44.entities.AwardSettings.update(savedSettingsId, payload);
      } else {
        const created = await base44.entities.AwardSettings.create(payload);
        setSavedSettingsId(created.id);
      }
      queryClient.invalidateQueries({ queryKey: ["awardSettings"] });
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

  if (currentUser && currentUser.user_type !== "app_admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Access restricted to app administrators.</p>
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
              <h1 className="text-3xl font-bold text-slate-900">League Award Settings</h1>
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
                    {leagues.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name} ({l.season})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {savedRecord && (
                <div className="text-xs text-slate-400 flex-shrink-0">
                  <p>Last saved by <span className="font-medium text-slate-600">{savedRecord.updated_by || "—"}</span></p>
                  <p>{savedRecord.updated_at ? format(new Date(savedRecord.updated_at), "MMM d, yyyy HH:mm") : "—"}</p>
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

        {selectedLeagueId && settings && (
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
              >
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Statistic Weights</p>
                  <FieldGrid>
                    <NumField label="Points weight" value={settings.mvp_pts_weight} onChange={v => set("mvp_pts_weight", v)} hint="Impact of scoring" />
                    <NumField label="Offensive rebound weight" value={settings.mvp_oreb_weight} onChange={v => set("mvp_oreb_weight", v)} />
                    <NumField label="Defensive rebound weight" value={settings.mvp_dreb_weight} onChange={v => set("mvp_dreb_weight", v)} />
                    <NumField label="Assist weight" value={settings.mvp_ast_weight} onChange={v => set("mvp_ast_weight", v)} hint="Higher = assists matter more" />
                    <NumField label="Steal weight" value={settings.mvp_stl_weight} onChange={v => set("mvp_stl_weight", v)} />
                    <NumField label="Block weight" value={settings.mvp_blk_weight} onChange={v => set("mvp_blk_weight", v)} />
                  </FieldGrid>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3">Penalties (reduce score)</p>
                  <FieldGrid>
                    <NumField label="Turnover penalty" value={settings.mvp_turnover_penalty} onChange={v => set("mvp_turnover_penalty", v)} hint="Per turnover" />
                    <NumField label="Foul penalty" value={settings.mvp_foul_penalty} onChange={v => set("mvp_foul_penalty", v)} hint="Per personal foul" />
                    <NumField label="Technical foul penalty" value={settings.mvp_tech_penalty} onChange={v => set("mvp_tech_penalty", v)} />
                    <NumField label="Unsportsmanlike penalty" value={settings.mvp_unsportsmanlike_penalty} onChange={v => set("mvp_unsportsmanlike_penalty", v)} />
                  </FieldGrid>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Final Score Contributions</p>
                  <FieldGrid>
                    <NumField label="Avg GIS contribution" value={settings.mvp_avg_gis_weight} onChange={v => set("mvp_avg_gis_weight", v)} min={0} max={5} step={0.05} hint="Weight of average game impact" />
                    <NumField label="Games played % contribution" value={settings.mvp_gp_percent_weight} onChange={v => set("mvp_gp_percent_weight", v)} min={0} max={50} step={1} hint="Rewards availability" />
                    <NumField label="Team win % contribution" value={settings.mvp_team_win_percent_weight} onChange={v => set("mvp_team_win_percent_weight", v)} min={0} max={50} step={1} hint="Rewards team success" />
                    <NumField label="Season tech foul penalty" value={settings.mvp_tech_final_penalty} onChange={v => set("mvp_tech_final_penalty", v)} min={0} max={20} step={0.5} hint="Per technical over the season" />
                    <NumField label="Season unsports. penalty" value={settings.mvp_unsp_final_penalty} onChange={v => set("mvp_unsp_final_penalty", v)} min={0} max={20} step={0.5} />
                  </FieldGrid>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Eligibility</p>
                  <div className="max-w-xs">
                    <NumField
                      label="Minimum games played %"
                      hint="Players below this % of team games are excluded. E.g. 60 = must play in 60% of games."
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
              >
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Defensive Weights</p>
                  <FieldGrid>
                    <NumField label="Steal weight" value={settings.dpoy_stl_weight} onChange={v => set("dpoy_stl_weight", v)} hint="Most valued defensive play" />
                    <NumField label="Block weight" value={settings.dpoy_blk_weight} onChange={v => set("dpoy_blk_weight", v)} />
                    <NumField label="Offensive rebound weight" value={settings.dpoy_oreb_weight} onChange={v => set("dpoy_oreb_weight", v)} />
                    <NumField label="Defensive rebound weight" value={settings.dpoy_dreb_weight} onChange={v => set("dpoy_dreb_weight", v)} />
                  </FieldGrid>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3">Penalties</p>
                  <FieldGrid>
                    <NumField label="Foul penalty" value={settings.dpoy_foul_penalty} onChange={v => set("dpoy_foul_penalty", v)} hint="Higher = fouls hurt more" />
                    <NumField label="Turnover penalty" value={settings.dpoy_turnover_penalty} onChange={v => set("dpoy_turnover_penalty", v)} />
                    <NumField label="Technical foul penalty" value={settings.dpoy_tech_penalty} onChange={v => set("dpoy_tech_penalty", v)} />
                    <NumField label="Unsportsmanlike penalty" value={settings.dpoy_unsportsmanlike_penalty} onChange={v => set("dpoy_unsportsmanlike_penalty", v)} />
                  </FieldGrid>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Final Score &amp; Eligibility</p>
                  <FieldGrid>
                    <NumField label="Games played % contribution" value={settings.dpoy_gp_percent_weight} onChange={v => set("dpoy_gp_percent_weight", v)} min={0} max={50} step={1} />
                    <NumField label="Season tech foul penalty" value={settings.dpoy_tech_final_penalty} onChange={v => set("dpoy_tech_final_penalty", v)} min={0} max={20} step={0.5} />
                    <NumField label="Season unsports. penalty" value={settings.dpoy_unsp_final_penalty} onChange={v => set("dpoy_unsp_final_penalty", v)} min={0} max={20} step={0.5} />
                    <NumField label="Minimum games played %" value={settings.dpoy_min_games_percent} onChange={v => set("dpoy_min_games_percent", v)} min={0} max={100} step={5} />
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
              >
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Statistic Weights</p>
                  <FieldGrid>
                    <NumField label="Points weight" value={settings.pog_pts_weight} onChange={v => set("pog_pts_weight", v)} />
                    <NumField label="Offensive rebound weight" value={settings.pog_oreb_weight} onChange={v => set("pog_oreb_weight", v)} />
                    <NumField label="Defensive rebound weight" value={settings.pog_dreb_weight} onChange={v => set("pog_dreb_weight", v)} />
                    <NumField label="Assist weight" value={settings.pog_ast_weight} onChange={v => set("pog_ast_weight", v)} />
                    <NumField label="Steal weight" value={settings.pog_stl_weight} onChange={v => set("pog_stl_weight", v)} />
                    <NumField label="Block weight" value={settings.pog_blk_weight} onChange={v => set("pog_blk_weight", v)} />
                  </FieldGrid>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3">Penalties</p>
                  <FieldGrid>
                    <NumField label="Turnover penalty" value={settings.pog_turnover_penalty} onChange={v => set("pog_turnover_penalty", v)} />
                    <NumField label="Foul penalty" value={settings.pog_foul_penalty} onChange={v => set("pog_foul_penalty", v)} />
                    <NumField label="Technical foul penalty" value={settings.pog_tech_penalty} onChange={v => set("pog_tech_penalty", v)} />
                    <NumField label="Unsportsmanlike penalty" value={settings.pog_unsportsmanlike_penalty} onChange={v => set("pog_unsportsmanlike_penalty", v)} />
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
                  <label htmlFor="pog_winning" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Only choose Player of the Game from the winning team
                  </label>
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
                    hint="How many players make the Mythical Five"
                    value={settings.mythical_five_count}
                    onChange={v => set("mythical_five_count", Math.round(v))}
                    min={1} max={10} step={1}
                  />
                </FieldGrid>
              </SectionCard>
            </div>

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
      </div>
    </div>
  );
}
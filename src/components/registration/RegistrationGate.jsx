import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Users, Eye, User, Clock, XCircle, ChevronLeft } from "lucide-react";
import PrivacyConsentStep from "./PrivacyConsentStep";

const ROLE_OPTIONS = [
  {
    id: "league_admin",
    label: "League Admin",
    icon: Trophy,
    color: "from-yellow-500 to-orange-500",
    description: "Create and manage a basketball league, teams, and statistics"
  },
  {
    id: "coach",
    label: "Coach",
    icon: Users,
    color: "from-blue-500 to-blue-600",
    description: "Access coaching insights and team analytics"
  },
  {
    id: "player",
    label: "Player",
    icon: User,
    color: "from-green-500 to-emerald-600",
    description: "View your personal stats and follow your team"
  },
  {
    id: "viewer",
    label: "Viewer",
    icon: Eye,
    color: "from-purple-500 to-purple-600",
    description: "Follow league stats, standings, and game results"
  },
];

const AppLogo = () => (
  <div className="flex items-center justify-center mb-2">
    <img
      src="https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/a6f36183f_CourtSidebyAILOGOTransparent.png"
      alt="Courtside by AI"
      className="h-24 w-auto"
    />
  </div>
);

export default function RegistrationGate({ user }) {
  const getInitialStep = () => {
    if (user.application_status === "Pending") return "pending";
    if (user.application_status === "Rejected") return "rejected";
    return "select_role";
  };

  const [step, setStep] = useState(getInitialStep);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({});
  const [selectedLeagues, setSelectedLeagues] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [leagueTeamMap, setLeagueTeamMap] = useState({}); // { league_id: team_id }
  const [consentData, setConsentData] = useState(null);
  const [adminLeagueMode, setAdminLeagueMode] = useState("new");
  const [selectedAdminLeagueId, setSelectedAdminLeagueId] = useState("");

  const { data: leagues = [] } = useQuery({
    queryKey: ['publicLeagues'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getPublicLeagues', {});
      return res.data.leagues || [];
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
    enabled: selectedRole === "player" || selectedRole === "coach",
  });

  const selectedLeague = selectedLeagues[0] || ""; // kept for backwards compat reference

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setFormData({});
    setSelectedLeagues([]);
    setSelectedTeam("");
    setLeagueTeamMap({});
    setSelectedAdminLeagueId("");
    setStep("privacy_consent");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedRole === "league_admin") {
      if (adminLeagueMode === "new" && !formData.league_name?.trim()) {
        alert("Please enter a league name."); return;
      }
      if (adminLeagueMode === "existing" && !selectedAdminLeagueId) {
        alert("Please select an existing league."); return;
      }
      if (!formData.country?.trim()) { alert("Please enter your country."); return; }
    } else {
      if (selectedLeagues.length === 0) { alert("Please select at least one league."); return; }
      if (selectedRole === "player" || selectedRole === "coach") {
        const missingTeam = selectedLeagues.some(lid => !leagueTeamMap[lid]);
        if (missingTeam) { alert("Please select a team for each selected league."); return; }
      }
    }

    setIsSubmitting(true);
    try {
      const applicationData = {
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name,
        requested_role: selectedRole,
        status: "Pending",
        applied_at: new Date().toISOString(),
      };

      if (selectedRole === "league_admin") {
        if (formData.full_name) applicationData.user_name = formData.full_name;
        applicationData.country = formData.country;
        if (formData.phone) applicationData.phone = formData.phone;
        if (adminLeagueMode === "existing") {
          applicationData.league_id = selectedAdminLeagueId;
          applicationData.league_ids = [selectedAdminLeagueId];
          if (formData.role_in_league) applicationData.role_in_league = formData.role_in_league;
        } else {
          Object.assign(applicationData, {
            league_name: formData.league_name,
            season_start_date: formData.season_start_date,
            number_of_teams: parseInt(formData.number_of_teams),
            avg_players_per_team: parseInt(formData.avg_players_per_team),
          });
          if (formData.preferred_channel) applicationData.preferred_channel = formData.preferred_channel;
          if (formData.league_type) applicationData.league_type = formData.league_type;
          if (formData.heard_from) applicationData.heard_from = formData.heard_from;
          if (formData.league_fb_page) applicationData.league_fb_page = formData.league_fb_page;
        }
      } else {
        applicationData.country = formData.country;
        applicationData.league_id = selectedLeagues[0];
        applicationData.league_ids = selectedLeagues;
        if (selectedRole === "coach" || selectedRole === "viewer") {
          if (formData.full_name) applicationData.user_name = formData.full_name;
        }
        if (selectedRole === "coach") {
          applicationData.team_id = leagueTeamMap[selectedLeagues[0]] || "";
          applicationData.league_team_pairs = selectedLeagues.map(lid => ({
            league_id: lid,
            team_id: leagueTeamMap[lid] || "",
          }));
        }
        if (selectedRole === "player") {
          // Only submit for leagues where a team was actually chosen (teamless leagues are dropped — see the signup note).
          const chosenLeagues = selectedLeagues.filter(lid => leagueTeamMap[lid]);
          applicationData.display_name = formData.display_name;
          applicationData.handle = formData.handle || "";
          applicationData.jersey_number = (formData.jersey_number || "").trim();
          applicationData.player_name_status = formData.display_name ? "completed" : "missing";
          applicationData.league_id = chosenLeagues[0] || selectedLeagues[0];
          applicationData.league_ids = chosenLeagues.length ? chosenLeagues : selectedLeagues;
          applicationData.team_id = leagueTeamMap[chosenLeagues[0]] || "";
          applicationData.league_team_pairs = chosenLeagues.map(lid => ({
            league_id: lid,
            team_id: leagueTeamMap[lid],
          }));
        }
      }

      const createdApp = await base44.entities.UserApplication.create(applicationData);
      // SUGGEST_PLAYER_MATCH_CALL — best-effort; never block signup if it fails
      if (selectedRole === "player" && createdApp?.id) {
        try { await base44.functions.invoke("suggestPlayerMatch", { applicationId: createdApp.id }); }
        catch (e) { console.error("suggestPlayerMatch failed (non-blocking):", e?.message); }
      }
      await base44.auth.updateMe({
        application_status: "Pending",
        ...(formData.full_name?.trim() ? { full_name: formData.full_name.trim() } : {}),
        ...(consentData || {}),
      });
      setStep("pending");
    } catch (error) {
      alert("Failed to submit application: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "pending") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <AppLogo />
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mt-6 mb-4">
            <Clock className="w-10 h-10 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Application Under Review</h2>
          <p className="text-slate-600 mb-6">
            Your application has been submitted. Our admin team will review it shortly and grant you access once approved.
          </p>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 text-left mb-6">
            <p className="text-sm font-medium text-amber-800">What happens next?</p>
            <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
              <li>Admin reviews your application</li>
              <li>You'll get full access once approved</li>
              <li>Refresh this page to check your status</li>
            </ul>
          </div>
          <Button onClick={() => window.location.reload()} variant="outline" className="w-full mb-3">
            Refresh Status
          </Button>
          <Button onClick={() => base44.auth.logout('/')} variant="ghost" className="w-full text-slate-500">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  if (step === "rejected") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <AppLogo />
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mt-6 mb-4">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Application Not Approved</h2>
          <p className="text-slate-600 mb-6">
            Your previous application was not approved. You may submit a new application with updated information.
          </p>
          <Button
            onClick={() => { setSelectedRole(null); setFormData({}); setSelectedLeagues([]); setSelectedTeam(""); setLeagueTeamMap({}); setStep("select_role"); }}
            className="w-full bg-orange-500 hover:bg-orange-600 mb-3"
          >
            Apply Again
          </Button>
          <Button onClick={() => base44.auth.logout('/')} variant="ghost" className="w-full text-slate-500">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  if (step === "privacy_consent") {
    return (
      <PrivacyConsentStep
        onAccept={(data) => { setConsentData(data); setStep("fill_form"); }}
        onBack={() => { setSelectedRole(null); setStep("select_role"); }}
      />
    );
  }

  if (step === "fill_form") {
    const roleInfo = ROLE_OPTIONS.find(r => r.id === selectedRole);
    const RoleIcon = roleInfo?.icon;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
          <button
            onClick={() => setStep("select_role")}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to role selection
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleInfo?.color} flex items-center justify-center`}>
              {RoleIcon && <RoleIcon className="w-5 h-5 text-white" />}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{roleInfo?.label} Application</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {selectedRole === "league_admin" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdminLeagueMode("new")}
                    className={`flex-1 p-3 rounded-lg border-2 text-sm font-semibold transition-colors ${adminLeagueMode === "new" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  >
                    I'm starting a new league
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminLeagueMode("existing")}
                    className={`flex-1 p-3 rounded-lg border-2 text-sm font-semibold transition-colors ${adminLeagueMode === "existing" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  >
                    I help run a league already on Courtside
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <Input value={formData.full_name || ""} onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))} placeholder="Your full name" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                  <Input value={formData.country || ""} onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))} placeholder="e.g., Finland" required />
                </div>
                {adminLeagueMode === "new" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">League Name</label>
                      <Input value={formData.league_name || ""} onChange={e => setFormData(prev => ({ ...prev, league_name: e.target.value }))} placeholder="e.g., Helsinki Basketball League" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Season Start Date</label>
                      <Input type="date" value={formData.season_start_date || ""} onChange={e => setFormData(prev => ({ ...prev, season_start_date: e.target.value }))} required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Number of Teams</label>
                        <Input type="number" min="2" value={formData.number_of_teams || ""} onChange={e => setFormData(prev => ({ ...prev, number_of_teams: e.target.value }))} placeholder="e.g., 8" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Avg Players/Team</label>
                        <Input type="number" min="5" value={formData.avg_players_per_team || ""} onChange={e => setFormData(prev => ({ ...prev, avg_players_per_team: e.target.value }))} placeholder="e.g., 12" required />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
                      <Input value={formData.phone || ""} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="e.g., +63 917 555 0142" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Best way to reach you</label>
                      <div className="flex flex-wrap gap-2">
                        {[["whatsapp","WhatsApp"],["messenger","Messenger"],["email","Email"],["call","Call"]].map(([val,lbl]) => (
                          <button key={val} type="button" onClick={() => setFormData(prev => ({ ...prev, preferred_channel: val }))} className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${formData.preferred_channel === val ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{lbl}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">League type</label>
                      <div className="flex flex-wrap gap-2">
                        {[["recreational","Recreational"],["competitive","Competitive"],["corporate","Corporate"],["school","School"]].map(([val,lbl]) => (
                          <button key={val} type="button" onClick={() => setFormData(prev => ({ ...prev, league_type: val }))} className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${formData.league_type === val ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{lbl}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">How did you hear about us?</label>
                      <div className="flex flex-wrap gap-2">
                        {[["facebook_group","Facebook group"],["referral","Referral"],["search","Search"],["another_league","Another league"],["other","Other"]].map(([val,lbl]) => (
                          <button key={val} type="button" onClick={() => setFormData(prev => ({ ...prev, heard_from: val }))} className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${formData.heard_from === val ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{lbl}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">League Facebook page <span className="text-slate-400 font-normal">(optional)</span></label>
                      <Input value={formData.league_fb_page || ""} onChange={e => setFormData(prev => ({ ...prev, league_fb_page: e.target.value }))} placeholder="facebook.com/yourleague" />
                    </div>
                  </>
                )}
                {adminLeagueMode === "existing" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Which league?</label>
                      <Select value={selectedAdminLeagueId} onValueChange={v => setSelectedAdminLeagueId(v)}>
                        <SelectTrigger><SelectValue placeholder="Choose a league…" /></SelectTrigger>
                        <SelectContent>
                          {leagues.map(l => (
                            <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Your role in this league</label>
                      <Input value={formData.role_in_league || ""} onChange={e => setFormData(prev => ({ ...prev, role_in_league: e.target.value }))} placeholder="e.g., Stats keeper, assistant organizer" />
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-sm text-blue-800">We'll send your request to the league's owner to approve.</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {(selectedRole === "coach" || selectedRole === "viewer") && (
              <div className="space-y-4">
                {(selectedRole === "coach" || selectedRole === "viewer") && (
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Full Name *</label>
                    <Input value={formData.full_name || ""} onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))} placeholder="Your full name" required />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Country *</label>
                  <Input value={formData.country || ""} onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))} placeholder="e.g., Finland" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Select League(s) *</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
                    {leagues.map(l => (
                      <label key={l.id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded p-1">
                        <input
                          type="checkbox"
                          checked={selectedLeagues.includes(l.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedLeagues([...selectedLeagues, l.id]);
                            } else {
                              setSelectedLeagues(selectedLeagues.filter(id => id !== l.id));
                              setLeagueTeamMap(prev => { const next = { ...prev }; delete next[l.id]; return next; });
                            }
                          }}
                          className="w-4 h-4 accent-orange-500"
                        />
                        <span className="text-sm text-slate-800">{l.name} <span className="text-slate-400">({l.season})</span></span>
                      </label>
                    ))}
                  </div>
                  {selectedLeagues.length > 0 && (
                    <p className="text-xs text-orange-600 mt-1">{selectedLeagues.length} league(s) selected</p>
                  )}
                </div>
                {selectedRole === "coach" && selectedLeagues.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-700 block">Select Team per League *</label>
                    {selectedLeagues.map(lid => {
                      const league = leagues.find(l => l.id === lid);
                      const leagueTeams = teams.filter(t => t.league_id === lid);
                      return (
                        <div key={lid} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                          <p className="text-xs font-semibold text-slate-600 mb-2">{league?.name} <span className="text-slate-400">({league?.season})</span></p>
                          <Select
                            value={leagueTeamMap[lid] || ""}
                            onValueChange={(val) => setLeagueTeamMap(prev => ({ ...prev, [lid]: val }))}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Choose a team" />
                            </SelectTrigger>
                            <SelectContent>
                              {leagueTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {selectedRole === "player" && (
                <>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Player Display Name *</label>
                    <Input value={formData.display_name || ""} onChange={e => setFormData(prev => ({ ...prev, display_name: e.target.value }))} placeholder="Your name as it appears on the roster" required />
                    <p className="text-xs text-slate-400 mt-1">This is how your name will appear in stats, standings, and awards.</p>
                  </div>
                  {/* JERSEY_FIELD_V1 */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Jersey Number *</label>
                    <Input value={formData.jersey_number || ""} onChange={e => setFormData(prev => ({ ...prev, jersey_number: e.target.value }))} placeholder="e.g., 23" maxLength={3} required />
                    <p className="text-xs text-slate-400 mt-1">Enter your name and jersey number exactly as your team lists them. We'll try to match you to your team's roster automatically. If we can't, a league organizer will review your request — you'll get an email once you're approved.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Nickname / Handle <span className="font-normal text-slate-400">(optional)</span></label>
                    <Input value={formData.handle || ""} onChange={e => setFormData(prev => ({ ...prev, handle: e.target.value }))} placeholder="e.g., The Flash" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Country *</label>
                    <Input value={formData.country || ""} onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))} placeholder="e.g., Finland" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-2 block">Select League(s) *</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
                      {leagues.map(l => (
                        <label key={l.id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded p-1">
                          <input
                            type="checkbox"
                            checked={selectedLeagues.includes(l.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLeagues([...selectedLeagues, l.id]);
                              } else {
                                setSelectedLeagues(selectedLeagues.filter(id => id !== l.id));
                                setLeagueTeamMap(prev => { const next = { ...prev }; delete next[l.id]; return next; });
                              }
                            }}
                            className="w-4 h-4 accent-orange-500"
                          />
                          <span className="text-sm text-slate-800">{l.name} <span className="text-slate-400">({l.season})</span></span>
                        </label>
                      ))}
                    </div>
                    {selectedLeagues.length > 0 && (
                      <p className="text-xs text-orange-600 mt-1">{selectedLeagues.length} league(s) selected</p>
                    )}
                  </div>
                  {selectedLeagues.length > 0 && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-slate-700 block">Select Team per League *</label>
                      {selectedLeagues.map(lid => {
                        const league = leagues.find(l => l.id === lid);
                        const leagueTeams = teams.filter(t => t.league_id === lid);
                        const noTeams = leagueTeams.length === 0;
                        return (
                          <div key={lid} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                            <p className="text-xs font-semibold text-slate-600 mb-2">{league?.name} <span className="text-slate-400">({league?.season})</span></p>
                            {/* TEAMLESS_LEAGUE_V1 */}
                            {noTeams ? (
                              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                                This league hasn't added any teams yet, so there's no roster to join. Ask your league organizer to set up your team, then come back to finish signing up. You can still continue with any other league that has teams.
                              </div>
                            ) : (
                              <Select
                                value={leagueTeamMap[lid] || ""}
                                onValueChange={(val) => setLeagueTeamMap(prev => ({ ...prev, [lid]: val }))}
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue placeholder="Choose a team" />
                                </SelectTrigger>
                                <SelectContent>
                                  {leagueTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

            {(() => {
              let canSubmit = true;
              if (selectedRole === "league_admin") {
                if (!formData.country?.trim()) canSubmit = false;
                if (adminLeagueMode === "new" && !formData.league_name?.trim()) canSubmit = false;
                if (adminLeagueMode === "existing" && !selectedAdminLeagueId) canSubmit = false;
              } else {
                if (selectedLeagues.length === 0) canSubmit = false;
                if (selectedRole === "coach" && selectedLeagues.some(lid => !leagueTeamMap[lid])) canSubmit = false;
                if (selectedRole === "player") {
                  // Leagues that actually have teams must have a team chosen; teamless leagues are excluded (note shown instead).
                  const leaguesWithTeams = selectedLeagues.filter(lid => teams.some(t => t.league_id === lid));
                  if (leaguesWithTeams.some(lid => !leagueTeamMap[lid])) canSubmit = false;
                  if (!leaguesWithTeams.some(lid => leagueTeamMap[lid])) canSubmit = false;
                  if (!formData.display_name?.trim()) canSubmit = false;
                  if (!formData.jersey_number?.trim()) canSubmit = false;
                }
              }
              return (
                <Button type="submit" disabled={isSubmitting || !canSubmit} className="w-full bg-orange-500 hover:bg-orange-600 mt-2 disabled:opacity-50">
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </Button>
              );
            })()}
          </form>
        </div>
      </div>
    );
  }

  // Default: select_role
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <AppLogo />
          <h1 className="text-3xl font-bold text-slate-900 mt-4 mb-2">How will you use Courtside by AI?</h1>
          <p className="text-slate-600">Choose your role below. An admin will review and approve your request.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ROLE_OPTIONS.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role.id)}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all text-left group"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{role.label}</h3>
                <p className="text-sm text-slate-600">{role.description}</p>
              </button>
            );
          })}
        </div>

        <div className="text-center mt-6">
          <button onClick={() => base44.auth.logout('/')} className="text-slate-500 hover:text-slate-700 text-sm transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
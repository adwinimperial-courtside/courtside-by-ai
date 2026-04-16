import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Users, Eye, User, Clock, XCircle, ChevronLeft } from "lucide-react";

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
    setStep("fill_form");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedRole !== "league_admin") {
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
        Object.assign(applicationData, {
          country: formData.country,
          league_name: formData.league_name,
          season_start_date: formData.season_start_date,
          number_of_teams: parseInt(formData.number_of_teams),
          avg_players_per_team: parseInt(formData.avg_players_per_team),
        });
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
          applicationData.display_name = formData.display_name;
          applicationData.handle = formData.handle || "";
          applicationData.player_name_status = formData.display_name ? "completed" : "missing";
          applicationData.team_id = leagueTeamMap[selectedLeagues[0]] || "";
          applicationData.league_team_pairs = selectedLeagues.map(lid => ({
            league_id: lid,
            team_id: leagueTeamMap[lid] || "",
          }));
        }
      }

      await base44.entities.UserApplication.create(applicationData);
      await base44.auth.updateMe({ application_status: "Pending" });
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
              <>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Country *</label>
                  <Input value={formData.country || ""} onChange={e => setFormData({ ...formData, country: e.target.value })} placeholder="e.g., Finland" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">League Name *</label>
                  <Input value={formData.league_name || ""} onChange={e => setFormData({ ...formData, league_name: e.target.value })} placeholder="e.g., Helsinki Basketball League" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Season Start Date *</label>
                  <Input type="date" value={formData.season_start_date || ""} onChange={e => setFormData({ ...formData, season_start_date: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Number of Teams *</label>
                    <Input type="number" min="2" value={formData.number_of_teams || ""} onChange={e => setFormData({ ...formData, number_of_teams: e.target.value })} placeholder="e.g., 8" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Avg Players/Team *</label>
                    <Input type="number" min="5" value={formData.avg_players_per_team || ""} onChange={e => setFormData({ ...formData, avg_players_per_team: e.target.value })} placeholder="e.g., 12" required />
                  </div>
                </div>
              </>
            )}

            {(selectedRole === "coach" || selectedRole === "viewer") && (
              <div className="space-y-4">
                {(selectedRole === "coach" || selectedRole === "viewer") && (
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Full Name *</label>
                    <Input value={formData.full_name || ""} onChange={e => setFormData({ ...formData, full_name: e.target.value })} placeholder="Your full name" required />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Country *</label>
                  <Input value={formData.country || ""} onChange={e => setFormData({ ...formData, country: e.target.value })} placeholder="e.g., Finland" required />
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
                    <Input value={formData.display_name || ""} onChange={e => setFormData({ ...formData, display_name: e.target.value })} placeholder="Your name as it appears on the roster" required />
                    <p className="text-xs text-slate-400 mt-1">This is how your name will appear in stats, standings, and awards.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Nickname / Handle <span className="font-normal text-slate-400">(optional)</span></label>
                    <Input value={formData.handle || ""} onChange={e => setFormData({ ...formData, handle: e.target.value })} placeholder="e.g., The Flash" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Country *</label>
                    <Input value={formData.country || ""} onChange={e => setFormData({ ...formData, country: e.target.value })} placeholder="e.g., Finland" required />
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
                </>
              )}

            <Button type="submit" disabled={isSubmitting} className="w-full bg-orange-500 hover:bg-orange-600 mt-2">
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </Button>
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
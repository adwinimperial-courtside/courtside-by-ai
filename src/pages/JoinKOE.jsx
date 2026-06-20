import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Eye, User, CheckCircle2, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import PrivacyConsentStep from "@/components/registration/PrivacyConsentStep";

// JOIN_KOE_V1 — Dedicated, isolated signup for the Kings of Europe league.
// Renders OUTSIDE the app Layout (registered as a top-level route in App.jsx) so the
// normal RegistrationGate never intercepts brand-new users. Produces the SAME UserApplication
// shape as RegistrationGate so KOE apps drop straight into the existing review/match/email pipeline.
// No edits to RegistrationGate or any approval function. On-page banners only (alert() is blocked in base44).

const KOE_LEAGUE_NAME = "Kings of Europe";
const KOE_CODE_LABEL = "KOE26";
const LOGO_URL = "https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/a6f36183f_CourtSidebyAILOGOTransparent.png";
const KOE_LOGO_URL = "https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/e0e9fdb49_koe_logo.png";

const ROLE_OPTIONS = [
  { id: "player", label: "Player", icon: User, description: "Join your team, own your stats" },
  { id: "coach", label: "Coach", icon: Users, description: "Insights & team analytics" },
  { id: "viewer", label: "Viewer", icon: Eye, description: "Follow standings & results" },
];

function Shell({ children, stepNumber }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* Dark hero header */}
        <div className="relative px-6 pt-6 pb-8 flex flex-col items-center" style={{ backgroundColor: "#0B1F3A" }}>
          {/* Season badge */}
          <div className="mb-4 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest text-white" style={{ backgroundColor: "#F26B1F" }}>
            SEASON 2026 · KOE26
          </div>
          {/* KOE logo in white circle */}
          <div className="w-28 h-28 rounded-full bg-white flex items-center justify-center mb-4 shadow-lg">
            <img src={KOE_LOGO_URL} alt="Kings of Europe" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-white font-extrabold text-2xl text-center leading-tight">
            The biggest &amp; best Filipino<br />basketball league in Europe
          </h1>
        </div>
        {/* Orange divider line */}
        <div className="h-1 w-full" style={{ backgroundColor: "#F26B1F" }} />
        {/* Body */}
        <div className="px-6 py-5">
          {/* Meta line */}
          <p className="text-xs text-slate-500 text-center mb-4">
            <span className="font-semibold text-slate-700">EST. 2013</span> · Filipino hoops · across Europe
          </p>
          {/* Step indicator */}
          {stepNumber && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold tracking-widest" style={{ color: "#F26B1F" }}>STEP {stepNumber} / 3</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ backgroundColor: "#F26B1F", width: `${(stepNumber / 3) * 100}%` }} />
              </div>
            </div>
          )}
          {children}
        </div>
        {/* Footer */}
        <div className="px-6 pb-5 text-center">
          <p className="text-xs text-slate-400">Powered by Courtside by AI · Numbers Don't Lie</p>
          <img src={LOGO_URL} alt="Courtside by AI" className="h-6 w-auto mx-auto mt-1 opacity-50" />
        </div>
      </div>
    </div>
  );
}

function Banner({ message }) {
  if (!message) return null;
  return (
    <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
      <p className="text-sm text-red-600 font-medium">{message}</p>
    </div>
  );
}

function LockedLeagueField() {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">League</label>
      <div className="rounded-xl border-2 px-4 py-3 flex items-center gap-2 bg-orange-50 border-orange-300">
        <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "#F26B1F" }} />
        <div>
          <p className="text-sm font-semibold text-slate-800">Kings of Europe</p>
          <p className="text-xs text-slate-500">Set from your invite code · {KOE_CODE_LABEL}</p>
        </div>
      </div>
    </div>
  );
}

export default function JoinKOE() {
  const [step, setStep] = useState("loading"); // loading | load_error | role | consent | details | already_applied | success
  const [user, setUser] = useState(null);
  const [league, setLeague] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loadError, setLoadError] = useState("");

  const [selectedRole, setSelectedRole] = useState(null);
  const [consentData, setConsentData] = useState(null);

  // Controlled form values (useState, not useRef — refs are unreliable across base44 render cycles)
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [teamId, setTeamId] = useState("");
  const [jersey, setJersey] = useState("");

  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await base44.auth.me();
        if (cancelled) return;
        setUser(me);

        // Resolve the KOE league by name (tolerant match against production naming)
        const res = await base44.functions.invoke("getPublicLeagues", {});
        const leagues = (res && res.data && res.data.leagues) || [];
        const koe =
          leagues.find(l => String(l.name || "").trim().toLowerCase() === KOE_LEAGUE_NAME.toLowerCase()) ||
          leagues.find(l => String(l.name || "").toLowerCase().includes("kings of europe"));
        if (!koe) {
          if (!cancelled) {
            setLoadError("We couldn't find the Kings of Europe league right now. Please try again in a moment, or contact your league organizer.");
            setStep("load_error");
          }
          return;
        }
        if (cancelled) return;
        setLeague(koe);

        // JOIN_KOE_MEMBER_REDIRECT_V1 — if this user is ALREADY a registered KOE member, don't make
        // them sign up again: send them into the app (Courtside home page). Membership is determined
        // by the KOE league id being present in the user's assigned_league_ids — the field that
        // approveUserApplication writes on approval and that the app uses everywhere. This runs BEFORE
        // the teams load and the already-applied check so KOE members are bounced immediately. Users
        // who are NOT KOE members (including registered members of OTHER leagues, and pending KOE
        // applicants) fall through: pending applicants hit the "already applied" screen, everyone else
        // can still apply to KOE.
        const assignedLeagueIds = Array.isArray(me.assigned_league_ids) ? me.assigned_league_ids : [];
        if (assignedLeagueIds.includes(koe.id)) {
          if (!cancelled) window.location.replace("/");
          return;
        }

        // KOE teams for the dropdown
        const allTeams = await base44.entities.Team.list();
        const koeTeams = (allTeams || [])
          .filter(t => t.league_id === koe.id)
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        if (cancelled) return;
        setTeams(koeTeams);

        // Already applied to KOE? Send them to the pending screen instead of allowing a resubmit.
        const apps = await base44.entities.UserApplication.filter({ user_id: me.id });
        const appliedToKOE = (apps || []).some(
          a => a.league_id === koe.id || (Array.isArray(a.league_ids) && a.league_ids.includes(koe.id))
        );
        if (cancelled) return;
        if (appliedToKOE) {
          setStep("already_applied");
          return;
        }

        setFullName(me.full_name || "");
        setStep("role");
      } catch (e) {
        if (!cancelled) {
          setLoadError("Something went wrong loading the signup. Please refresh and try again.");
          setStep("load_error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickRole = (roleId) => {
    setSelectedRole(roleId);
    setFormError("");
    setTeamId("");
    setJersey("");
    setStep("consent");
  };

  const handleConsentAccept = (data) => {
    setConsentData(data);
    setFormError("");
    setStep("details");
  };

  const handleSubmit = async () => {
    setFormError("");
    const name = (fullName || "").trim();
    if (!name) { setFormError("Please enter your full name."); return; }
    if (!country.trim()) { setFormError("Please enter your country."); return; }
    if ((selectedRole === "player" || selectedRole === "coach") && !teamId) {
      setFormError("Please choose your team."); return;
    }
    if (selectedRole === "player" && !jersey.trim()) {
      setFormError("Please enter your jersey number."); return;
    }

    setIsSubmitting(true);
    try {
      // Base shape — identical to RegistrationGate so KOE apps slot into the existing queue.
      const applicationData = {
        user_id: user.id,
        user_email: user.email,
        user_name: user.full_name,
        requested_role: selectedRole,
        status: "Pending",
        applied_at: new Date().toISOString(),
        country: country.trim(),
        league_id: league.id,
        league_ids: [league.id],
      };

      if (selectedRole === "coach") {
        applicationData.user_name = name; // typed name overrides the account name (matches RegistrationGate)
        applicationData.team_id = teamId;
        applicationData.league_team_pairs = [{ league_id: league.id, team_id: teamId }];
      } else if (selectedRole === "viewer") {
        applicationData.user_name = name;
      } else if (selectedRole === "player") {
        applicationData.display_name = name; // the roster name field
        applicationData.handle = "";
        applicationData.jersey_number = jersey.trim();
        applicationData.player_name_status = name ? "completed" : "missing";
        applicationData.team_id = teamId;
        applicationData.league_team_pairs = [{ league_id: league.id, team_id: teamId }];
      }

      const createdApp = await base44.entities.UserApplication.create(applicationData);

      // Suggestion-only auto-match for players — best-effort, never blocks signup.
      if (selectedRole === "player" && createdApp && createdApp.id) {
        try {
          await base44.functions.invoke("suggestPlayerMatch", { applicationId: createdApp.id });
        } catch (e) {
          console.error("suggestPlayerMatch failed (non-blocking):", e && e.message);
        }
      }

      await base44.auth.updateMe({
        application_status: "Pending",
        ...(name ? { full_name: name } : {}),
        ...(consentData || {}),
      });

      setStep("success");
    } catch (e) {
      setFormError("We couldn't submit your application: " + ((e && e.message) || "please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Screens ----

  if (step === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          <p className="text-sm text-slate-500">Loading the Kings of Europe signup…</p>
        </div>
      </Shell>
    );
  }

  if (step === "load_error") {
    return (
      <Shell>
        <Banner message={loadError} />
        <Button onClick={() => window.location.reload()} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold">
          Try again
        </Button>
      </Shell>
    );
  }

  if (step === "already_applied") {
    return (
      <Shell>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7" style={{ color: "#F26B1F" }} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">You've already applied</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Your Kings of Europe application is in and pending review. You'll get an email as soon as a league
            organizer approves it.
          </p>
        </div>
      </Shell>
    );
  }

  if (step === "success") {
    return (
      <Shell>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">You're in — pending approval</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {selectedRole === "player"
              ? "We've sent your details to Kings of Europe and will match you to your team. A league organizer confirms it, then you'll get a welcome email."
              : "We've sent your request to Kings of Europe. A league organizer will review and approve it, then you'll get a welcome email."}
          </p>
        </div>
      </Shell>
    );
  }

  if (step === "consent") {
    return <PrivacyConsentStep onAccept={handleConsentAccept} onBack={() => setStep("role")} />;
  }

  if (step === "role") {
    return (
      <Shell stepNumber={1}>
        <h2 className="text-lg font-bold text-slate-900 text-center mb-4">How are you joining?</h2>
        <div className="space-y-3">
          {ROLE_OPTIONS.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => pickRole(role.id)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-200 hover:border-orange-400 hover:bg-orange-50 transition-colors text-left group"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#0B1F3A" }}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">{role.label}</p>
                  <p className="text-xs text-slate-500">{role.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-400 transition-colors flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </Shell>
    );
  }

  // step === "details"
  const roleLabel = selectedRole === "player" ? "Player" : selectedRole === "coach" ? "Coach" : "Viewer";
  return (
    <Shell stepNumber={3}>
      <button
        type="button"
        onClick={() => setStep("role")}
        className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-4 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to role selection
      </button>

      <Banner message={formError} />

      <div className="space-y-4">
        <LockedLeagueField />

        {(selectedRole === "player" || selectedRole === "coach") && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your team</label>
            <Select value={teamId} onValueChange={(v) => { setTeamId(v); setFormError(""); }}>
              <SelectTrigger>
                <SelectValue placeholder={teams.length ? "Choose your team" : "No teams available yet"} />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
          <Input
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); setFormError(""); }}
            placeholder={selectedRole === "player" ? "Your name as your coach registered it" : "Your full name"}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
          <Input
            value={country}
            onChange={(e) => { setCountry(e.target.value); setFormError(""); }}
            placeholder="e.g., Finland"
          />
        </div>

        {selectedRole === "player" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Jersey number</label>
            <Input
              value={jersey}
              onChange={(e) => { setJersey(e.target.value); setFormError(""); }}
              placeholder="e.g., 23"
              maxLength={3}
            />
          </div>
        )}

        {selectedRole === "player" && (
          <div className="px-4 py-3 rounded-xl border bg-orange-50 border-orange-200">
            <p className="text-sm text-slate-700">
              Use the exact full name your coach registered you under — that's how we match you to your team.
            </p>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-60"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
            </span>
          ) : (
            "Continue"
          )}
        </Button>
      </div>
    </Shell>
  );
}
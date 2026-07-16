import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, AlertCircle, ChevronLeft, Users, Eye, ClipboardList } from "lucide-react";
import PrivacyConsentStep from "@/components/registration/PrivacyConsentStep";

// JOIN_LEAGUE_GENERIC_V1 — generic public signup page for registration campaigns.
// Rendered at /Join/<slug> OUTSIDE the Layout (so the RegistrationGate never
// intercepts brand-new users). Reads campaign display data via the
// manageRegistrationCampaign function ('get_public' — never returns codes).
// Coach flow: role -> code -> consent -> details (same one-time-code redeem via
// validateCoachCode as the 40Up page). Player/viewer flows: role -> consent ->
// details, producing the SAME UserApplication shapes as RegistrationGate so
// submissions drop into the existing review/approval/email pipeline untouched.

const LOGO_URL = "https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/a6f36183f_CourtSidebyAILOGOTransparent.png";
const GENERIC_CODE_ERROR = "That code is not valid or has already been used. Please contact the league admin.";
const DEFAULT_PRIMARY = "#0B1F3A";
const DEFAULT_ACCENT = "#F26B1F";

const ROLE_META = {
  coach: { label: "Coach", badge: "COACH REGISTRATION", icon: ClipboardList, description: "I have a team code from the league admin" },
  player: { label: "Player", badge: "PLAYER REGISTRATION", icon: Users, description: "I play on one of the teams" },
  viewer: { label: "Viewer", badge: "VIEWER REGISTRATION", icon: Eye, description: "I follow the league as a fan or family member" },
};

function darken(hex) {
  try {
    const n = hex.replace("#", "");
    const r = Math.max(0, parseInt(n.slice(0, 2), 16) - 24);
    const g = Math.max(0, parseInt(n.slice(2, 4), 16) - 24);
    const b = Math.max(0, parseInt(n.slice(4, 6), 16) - 24);
    return `rgb(${r},${g},${b})`;
  } catch (e) {
    return hex;
  }
}

function Shell({ campaign, roleKey, children, stepNumber, compact }) {
  const primary = campaign?.color_primary || DEFAULT_PRIMARY;
  const accent = campaign?.color_accent || DEFAULT_ACCENT;
  const crest = campaign?.crest_url || "";
  const title = campaign?.hero_title || "League registration";
  const season = campaign?.season_text || "";
  const badge = (roleKey && ROLE_META[roleKey]?.badge) || "REGISTRATION";

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl overflow-hidden">
        {compact ? (
          <div className="px-5 py-3 flex items-center gap-3" style={{ backgroundColor: primary }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: darken(primary), border: `2px solid ${accent}` }}>
              <img src={crest || LOGO_URL} alt={title} className="w-8 h-8 object-contain" />
            </div>
            <div>
              <p className="text-white text-sm font-bold leading-tight">{title}</p>
              <p className="text-xs text-slate-300">{season || "Registration"}</p>
            </div>
          </div>
        ) : (
          <div className="relative px-6 pt-7 pb-5 flex flex-col items-center text-center" style={{ backgroundColor: primary }}>
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-3 overflow-hidden" style={{ backgroundColor: darken(primary), border: `3px solid ${accent}` }}>
              <img src={crest || LOGO_URL} alt={title} className="w-20 h-20 object-contain" />
            </div>
            <h1 className="text-white font-extrabold text-2xl leading-tight mt-1">{title}</h1>
            <div className="mt-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest text-white" style={{ backgroundColor: accent }}>
              {badge}
            </div>
            {season && <p className="text-xs mt-2 text-slate-300">{season}</p>}
          </div>
        )}
        <div className="h-1 w-full" style={{ backgroundColor: accent }} />
        <div className="px-6 py-5">
          {stepNumber && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold tracking-widest" style={{ color: accent }}>STEP {stepNumber} / 2</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ backgroundColor: accent, width: `${(stepNumber / 2) * 100}%` }} />
              </div>
            </div>
          )}
          {children}
        </div>
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

function LockedTeamField({ teamName, accent }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Your team</label>
      <div className="rounded-xl border-2 px-4 py-3 flex items-center gap-2 bg-orange-50 border-orange-300">
        <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: accent }} />
        <div>
          <p className="text-sm font-semibold text-slate-800">{teamName}</p>
          <p className="text-xs text-slate-500">Set from your team code</p>
        </div>
      </div>
    </div>
  );
}

export default function JoinLeague() {
  const { slug } = useParams();
  const [step, setStep] = useState("loading"); // loading | load_error | invalid | closed | already_applied | role | code | consent | details | success
  const [user, setUser] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [roleKey, setRoleKey] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [codeInfo, setCodeInfo] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const [consentData, setConsentData] = useState(null);
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [country, setCountry] = useState("Finland");

  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const accent = campaign?.color_accent || DEFAULT_ACCENT;
  const enabledRoles = campaign?.roles_enabled || ["coach"];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await base44.auth.me();
        if (cancelled) return;
        setUser(me);
        setFullName(me.full_name || "");
        setDisplayName(me.full_name || "");

        let camp = null;
        try {
          const res = await base44.functions.invoke("manageRegistrationCampaign", {
            action: "get_public",
            slug: String(slug || "").toLowerCase(),
          });
          camp = res?.data?.campaign || null;
        } catch (e) {
          if (!cancelled) setStep("invalid");
          return;
        }
        if (cancelled) return;
        if (!camp) { setStep("invalid"); return; }
        setCampaign(camp);

        if (camp.status !== "open") { setStep("closed"); return; }

        const assignedLeagueIds = Array.isArray(me.assigned_league_ids) ? me.assigned_league_ids : [];
        if (assignedLeagueIds.includes(camp.league_id)) {
          if (!cancelled) window.location.replace("/");
          return;
        }

        const apps = await base44.entities.UserApplication.filter({ user_id: me.id });
        const alreadyApplied = (apps || []).some(
          (a) => a.league_id === camp.league_id || (Array.isArray(a.league_ids) && a.league_ids.includes(camp.league_id))
        );
        if (cancelled) return;
        if (alreadyApplied) { setStep("already_applied"); return; }

        setStep("role");
      } catch (e) {
        if (!cancelled) {
          setLoadError("Something went wrong loading the signup. Please refresh and try again.");
          setStep("load_error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const extractError = (e) =>
    (e && e.response && e.response.data && e.response.data.error) ||
    (e && e.data && e.data.error) ||
    GENERIC_CODE_ERROR;

  const pickRole = async (key) => {
    setRoleKey(key);
    setFormError("");
    if (key === "coach") {
      setStep("code");
      return;
    }
    if (key === "player" && !teams.length && campaign) {
      try {
        const rows = await base44.entities.Team.filter({ league_id: campaign.league_id });
        setTeams((rows || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name))));
      } catch (e) {}
    }
    setStep("consent");
  };

  const handleCheckCode = async () => {
    setFormError("");
    const typed = (codeInput || "").trim();
    if (!typed) { setFormError("Please enter your team code."); return; }
    setIsChecking(true);
    try {
      const res = await base44.functions.invoke("validateCoachCode", { action: "check", code: typed });
      const data = (res && res.data) || {};
      if (!data.valid || !data.team_id) {
        setFormError((data && data.error) || GENERIC_CODE_ERROR);
        return;
      }
      if (data.league_id && campaign && data.league_id !== campaign.league_id) {
        setFormError("That code belongs to a different league. Please check with your league admin.");
        return;
      }
      setCodeInfo(data);
      setStep("consent");
    } catch (e) {
      setFormError(extractError(e));
    } finally {
      setIsChecking(false);
    }
  };

  const handleConsentAccept = (data) => {
    setConsentData(data);
    setFormError("");
    setStep("details");
  };

  const handleSubmit = async () => {
    setFormError("");
    const leagueId = campaign.league_id;

    if (roleKey === "coach" && (!codeInfo || !codeInfo.team_id)) { setFormError(GENERIC_CODE_ERROR); return; }
    if (roleKey === "player") {
      if (!displayName.trim()) { setFormError("Please enter your player name."); return; }
      if (!jerseyNumber.trim()) { setFormError("Please enter your jersey number."); return; }
      if (!selectedTeamId) { setFormError("Please select your team."); return; }
    }
    if ((roleKey === "coach" || roleKey === "viewer") && !fullName.trim()) {
      setFormError("Please enter your full name.");
      return;
    }
    if (!country.trim()) { setFormError("Please enter your country."); return; }

    setIsSubmitting(true);
    try {
      const applicationData = {
        user_id: user.id,
        user_email: user.email,
        user_name: (fullName || displayName || user.full_name || "").trim(),
        requested_role: roleKey,
        status: "Pending",
        applied_at: new Date().toISOString(),
        country: country.trim(),
        league_id: leagueId,
        league_ids: [leagueId],
      };

      if (roleKey === "coach") {
        // Redeem first — burns the one-time code. Idempotent for the same email,
        // so if application creation fails below this user can safely retry.
        await base44.functions.invoke("validateCoachCode", { action: "redeem", code: codeInput });
        applicationData.team_id = codeInfo.team_id;
        applicationData.league_team_pairs = [{ league_id: leagueId, team_id: codeInfo.team_id }];
      }

      if (roleKey === "player") {
        applicationData.display_name = displayName.trim();
        applicationData.handle = "";
        applicationData.jersey_number = jerseyNumber.trim();
        applicationData.player_name_status = displayName.trim() ? "completed" : "missing";
        applicationData.team_id = selectedTeamId;
        applicationData.league_team_pairs = [{ league_id: leagueId, team_id: selectedTeamId }];
      }

      const createdApp = await base44.entities.UserApplication.create(applicationData);

      if (roleKey === "player" && createdApp?.id) {
        try { await base44.functions.invoke("suggestPlayerMatch", { applicationId: createdApp.id }); } catch (e) {}
      }

      await base44.auth.updateMe({
        application_status: "Pending",
        ...(fullName.trim() ? { full_name: fullName.trim() } : {}),
        ...(consentData || {}),
      });

      setStep("success");
    } catch (e) {
      setFormError("We couldn't submit your registration: " + ((e && e.message) || "please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "loading") {
    return (
      <Shell campaign={campaign} compact>
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          <p className="text-sm text-slate-500">Loading registration…</p>
        </div>
      </Shell>
    );
  }

  if (step === "load_error") {
    return (
      <Shell campaign={campaign} compact>
        <Banner message={loadError} />
        <Button onClick={() => window.location.reload()} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold">
          Try again
        </Button>
      </Shell>
    );
  }

  if (step === "invalid") {
    return (
      <Shell campaign={null} compact>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Link not found</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            This registration link doesn't exist or is no longer available. Please double-check the link with your league admin.
          </p>
        </div>
      </Shell>
    );
  }

  if (step === "closed") {
    return (
      <Shell campaign={campaign} compact>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Registration is closed</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            This league isn't accepting new signups right now. Contact the league admin if you think this is a mistake.
          </p>
        </div>
      </Shell>
    );
  }

  if (step === "already_applied") {
    return (
      <Shell campaign={campaign} compact>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7" style={{ color: accent }} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">You've already applied</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Your registration is in and pending review. You'll get an email as soon as the league admin approves it.
          </p>
        </div>
      </Shell>
    );
  }

  if (step === "success") {
    return (
      <Shell campaign={campaign} roleKey={roleKey} compact>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">You're in — pending approval</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {roleKey === "coach" ? (
              <>The league admin will review your registration. Once approved, you'll find <span className="font-semibold text-slate-800">My Roster</span> in your menu to set up your team.</>
            ) : (
              <>The league admin will review your registration. You'll get an email as soon as you're approved.</>
            )}
          </p>
        </div>
      </Shell>
    );
  }

  if (step === "role") {
    return (
      <Shell campaign={campaign}>
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">How are you joining{enabledRoles.length > 1 ? "" : " the league"}?</p>
          {enabledRoles.map((key) => {
            const meta = ROLE_META[key];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => pickRole(key)}
                className="w-full flex items-center gap-3 rounded-xl border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50 px-4 py-3 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{meta.label}</p>
                  <p className="text-xs text-slate-500">{meta.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Shell>
    );
  }

  if (step === "consent") {
    return <PrivacyConsentStep onAccept={handleConsentAccept} onBack={() => setStep(roleKey === "coach" ? "code" : "role")} />;
  }

  if (step === "details") {
    return (
      <Shell campaign={campaign} roleKey={roleKey} stepNumber={2} compact>
        <button
          type="button"
          onClick={() => { setStep(roleKey === "coach" ? "code" : "role"); setFormError(""); }}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <Banner message={formError} />

        <div className="space-y-4">
          {roleKey === "coach" && <LockedTeamField teamName={(codeInfo && codeInfo.team_name) || "Your team"} accent={accent} />}

          {roleKey === "player" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your team</label>
                <Select value={selectedTeamId} onValueChange={(v) => { setSelectedTeamId(v); setFormError(""); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select your team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Player name</label>
                <Input
                  value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); setFormError(""); }}
                  placeholder="Name as listed on your team"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jersey number</label>
                <Input
                  value={jerseyNumber}
                  onChange={(e) => { setJerseyNumber(e.target.value); setFormError(""); }}
                  placeholder="e.g., 23"
                  maxLength={3}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Enter your name and jersey number exactly as your team lists them. We'll try to match you to your team's roster automatically.
                </p>
              </div>
            </>
          )}

          {(roleKey === "coach" || roleKey === "viewer") && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
              <Input
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setFormError(""); }}
                placeholder="Your full name"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
            <Input
              value={country}
              onChange={(e) => { setCountry(e.target.value); setFormError(""); }}
              placeholder="e.g., Finland"
            />
          </div>

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
              "Submit for approval"
            )}
          </Button>

          <p className="text-xs text-slate-500 text-center leading-relaxed">
            You'll get an email once the league admin approves you.
          </p>
        </div>
      </Shell>
    );
  }

  // step === "code"
  return (
    <Shell campaign={campaign} roleKey={roleKey} stepNumber={1}>
      <button
        type="button"
        onClick={() => { setStep("role"); setFormError(""); }}
        className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-4 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>
      <Banner message={formError} />
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Team code</label>
          <Input
            value={codeInput}
            onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setFormError(""); }}
            placeholder="XXX-____"
            className="font-mono tracking-widest text-lg"
            maxLength={12}
          />
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Your code was sent to you by the league admin. One code per team.
          </p>
        </div>
        <Button
          onClick={handleCheckCode}
          disabled={isChecking}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-60"
        >
          {isChecking ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking…
            </span>
          ) : (
            "Continue"
          )}
        </Button>
      </div>
    </Shell>
  );
}
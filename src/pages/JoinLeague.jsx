import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
const COUNTRIES = ["Finland","Norway","Sweden","Denmark","Iceland","Italy","Spain","Germany","France","United Kingdom","Ireland","Netherlands","Belgium","Switzerland","Austria","Poland","Portugal","Estonia","Canada","United States","Philippines","Australia","United Arab Emirates","Qatar","Saudi Arabia","Japan","Singapore","Other"];

const ROLE_META = {
  coach: { label: "Coach", badge: "COACH REGISTRATION", icon: ClipboardList, description: "I have a team code from the league admin" },
  player: { label: "Player", badge: "PLAYER REGISTRATION", icon: Users, description: "I play on one of the teams" },
  viewer: { label: "Fan", badge: "FAN REGISTRATION", icon: Eye, description: "I follow the league as a fan or family member" },
};

// PLAYER_SIGNUP_V1 — D7. The role tiles are always rendered in this order. A role the
// organizer has not ticked in "Who can sign up" is shown greyed out with the reason in
// plain words, not hidden, so a player who lands here early knows to come back.
const ROLE_ORDER = ["coach", "player", "viewer"];
const ROLE_CLOSED_REASON = {
  coach: "Team registration isn't open for this league yet",
  player: "Player signup isn't open yet — the league admin opens it once the teams are set",
  viewer: "Fan signup isn't open for this league yet",
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

  // OPEN_SEASON_COACH_V1 — in an open-registration season the organizer has not
  // created the teams, so a coach has no one-time code. They type the team they
  // want to enter plus an optional note, and approveUserApplication creates the
  // team on approval. coachPath "code" keeps the existing flow byte-for-byte.
  const [coachPath, setCoachPath] = useState("code"); // "code" | "new_team"
  const [requestedTeamName, setRequestedTeamName] = useState("");
  const [organizerNote, setOrganizerNote] = useState("");

  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const [consentData, setConsentData] = useState(null);
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [country, setCountry] = useState("Finland");

  // CODE_AUTO_APPROVE_V1 — what the server said about the coach's redeemed team code, so the
  // success screen can either say they are in or name the one thing that stopped it.
  const [autoApproved, setAutoApproved] = useState(false);
  const [autoPendingReason, setAutoPendingReason] = useState("");

  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const accent = campaign?.color_accent || DEFAULT_ACCENT;
  const enabledRoles = campaign?.roles_enabled || ["coach"];

  // OPEN_SEASON_COACH_V1 — both fields come from the League via get_public.
  // A season with no registration_mode behaves exactly as before.
  const openSeason = campaign?.registration_mode === "open";
  const coachDeadline = String(campaign?.registration_deadline || "").slice(0, 10);
  const todayKey = new Date().toISOString().slice(0, 10);
  const coachClosed = Boolean(coachDeadline) && todayKey > coachDeadline;
  const deadlineLabel = coachDeadline
    ? new Date(coachDeadline + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";
  const coachBackStep = coachPath === "new_team" ? "team" : "code";

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
        // JOIN_REJECTED_REAPPLY_V1 — a Rejected application must not block a fresh /Join attempt
        const alreadyApplied = (apps || []).some(
          (a) => a.status !== "Rejected" &&
            (a.league_id === camp.league_id || (Array.isArray(a.league_ids) && a.league_ids.includes(camp.league_id)))
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
    // PLAYER_SIGNUP_V1 — D7. The tile is disabled, but never trust the tile.
    if (!enabledRoles.includes(key)) return;
    setRoleKey(key);
    setFormError("");
    if (key === "coach") {
      // OPEN_SEASON_COACH_V1 — open season, no code: ask for the team name.
      if (coachClosed) {
        setFormError("Team registration closed on " + deadlineLabel + ". Contact the league admin if you still want to enter a team.");
        setRoleKey("");
        return;
      }
      setCoachPath(openSeason ? "new_team" : "code");
      setStep(openSeason ? "team" : "code");
      return;
    }
    if ((key === "player" || key === "viewer") && !teams.length && campaign) {
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

    // OPEN_SEASON_COACH_V1 — a new-team coach has no code and no team_id yet.
    const newTeamCoach = roleKey === "coach" && coachPath === "new_team";
    if (roleKey === "coach" && !newTeamCoach && (!codeInfo || !codeInfo.team_id)) { setFormError(GENERIC_CODE_ERROR); return; }
    if (newTeamCoach && !requestedTeamName.trim()) { setFormError("Please enter the name of the team you want to enter."); return; }
    if (newTeamCoach && coachClosed) { setFormError("Team registration closed on " + deadlineLabel + "."); return; }
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

      if (newTeamCoach) {
        // OPEN_SEASON_COACH_V1 — nothing to redeem: the team does not exist yet.
        // approveUserApplication creates it from requested_team_name on approval.
        applicationData.requested_team_name = requestedTeamName.trim();
        if (organizerNote.trim()) applicationData.organizer_note = organizerNote.trim().slice(0, 300);
      } else if (roleKey === "coach") {
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

      if (roleKey === "viewer") {
        // FAN_INSTANT_FOLLOW_V1 — this used to write status "Approved" straight from the
        // browser. It is created Pending like every other application now; the server turns it
        // into a follow a few lines below, or leaves it here for the organiser.
        if (selectedTeamId) applicationData.team_id = selectedTeamId;
      }

      const createdApp = await base44.entities.UserApplication.create(applicationData);

      // CODE_AUTO_APPROVE_V1 — D2/D3/D11. A redeemed team code is proof the organiser invited
      // this coach, so the approval happens now instead of sitting in the queue. Everything that
      // stops an ordinary approval still applies, and is checked server-side: consent, the
      // season's registration deadline, a role already held in this season, and the two-coach
      // cap. When one of them applies the application simply stays pending and the coach is told
      // which one it was. A failure here never blocks the registration — it is already in.
      let autoResult = null;
      if (roleKey === "coach" && !newTeamCoach && createdApp?.id) {
        try {
          const res = await base44.functions.invoke("approveUserApplication", {
            action: "code_auto_approve",
            applicationId: createdApp.id,
            code: codeInput,
            consent: consentData || null,
          });
          autoResult = (res && res.data) || null;
        } catch (e) {
          autoResult = null;
        }
      }
      // FAN_INSTANT_FOLLOW_V1 — a fan follows instantly, but the grant is the server's to make.
      // The page no longer raises its own account: it asks, and is told either that it worked or
      // the one thing that stopped it (consent, or a role already held in this season).
      if (roleKey === "viewer" && createdApp?.id) {
        try {
          const res = await base44.functions.invoke("approveUserApplication", {
            action: "fan_instant_follow",
            applicationId: createdApp.id,
            slug: String(slug || "").toLowerCase(),
            consent: consentData || null,
          });
          autoResult = (res && res.data) || null;
        } catch (e) {
          autoResult = null;
        }
      }

      if (autoResult && autoResult.approved) setAutoApproved(true);
      else if (autoResult && autoResult.message) setAutoPendingReason(autoResult.message);

      if (roleKey === "player" && createdApp?.id) {
        try { await base44.functions.invoke("suggestPlayerMatch", { applicationId: createdApp.id }); } catch (e) {}
      }

      // FAN_INSTANT_FOLLOW_V1 — the fan's assigned_league_ids, user_type, favourite team and
      // welcome email are all the server's job now, so the fan falls through to the same tail
      // every other role uses. Only the account's own name and consent are written from here.
      await base44.functions.invoke('updateMyProfile', {
        // CODE_AUTO_APPROVE_V1 — an auto-approved coach is already Approved on their account;
        // writing Pending here would put them straight back in the queue. The same is true of a
        // fan who is now following. The state set above has not landed yet in this render, so
        // the local result is what decides.
        ...(autoResult && autoResult.approved ? {} : { application_status: "Pending" }),
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
    const favTeam = teams.find((t) => t.id === selectedTeamId);
    // CODE_AUTO_APPROVE_V1
    const coachAutoApproved = roleKey === "coach" && autoApproved;
    // FAN_INSTANT_FOLLOW_V1 — a fan is only "following" once the server says so. Held for
    // consent or a role clash, they see the same pending screen as everyone else.
    const isViewer = roleKey === "viewer" && autoApproved;
    return (
      <Shell campaign={campaign} roleKey={roleKey} compact>
        <div className="text-center py-4" data-marker="FAN_INSTANT_FOLLOW_V1">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {isViewer ? "You're in — you're now following!" : coachAutoApproved ? "You're in — your team is set up" : "You're in — pending approval"}
          </h2>
          {isViewer && favTeam && (
            <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1 mb-3">
              {favTeam.logo_url ? (
                <img src={favTeam.logo_url} alt={favTeam.name} className="w-4 h-4 rounded-full object-cover" />
              ) : (
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: favTeam.color || accent }} />
              )}
              <span className="text-xs text-slate-700">Your team · {favTeam.name}</span>
            </div>
          )}
          <p className="text-sm text-slate-600 leading-relaxed">
            {isViewer ? (
              <>You're now following <span className="font-semibold text-slate-800">{campaign?.hero_title || "the league"}</span>. Live scores, standings and stats are all yours — a welcome email is on its way.</>
            ) : autoPendingReason ? (
              // FAN_INSTANT_FOLLOW_V1 / CODE_AUTO_APPROVE_V1 — the server named the one thing
              // that held this registration, so say that instead of the generic wait.
              <>{autoPendingReason}</>
            ) : roleKey === "coach" ? (
              // CODE_AUTO_APPROVE_V1 — approved on the code, or the ordinary wait.
              coachAutoApproved ? (
                <>Your team code is confirmed, so you're approved already. Open <span className="font-semibold text-slate-800">My Roster</span> from your menu to add your players.</>
              ) : (
                <>The league admin will review your registration. Once approved, you'll find <span className="font-semibold text-slate-800">My Roster</span> in your menu to set up your team.</>
              )
            ) : (
              <>The league admin will review your registration. You'll get an email as soon as you're approved.</>
            )}
          </p>
          {coachAutoApproved && (
            <Button onClick={() => window.location.replace("/")} className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold">
              Open my roster
            </Button>
          )}
          {isViewer && (
            <Button onClick={() => window.location.replace("/")} className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold">
              Open the league
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  if (step === "role") {
    return (
      <Shell campaign={campaign}>
        <div className="space-y-3">
          <Banner message={formError} />
          <p className="text-sm font-medium text-slate-700">How are you joining{enabledRoles.length > 1 ? "" : " the league"}?</p>
          {ROLE_ORDER.map((key) => {
            const meta = ROLE_META[key];
            if (!meta) return null;
            const Icon = meta.icon;
            // PLAYER_SIGNUP_V1 — D7. A role the organizer has not opened is shown, disabled.
            const roleOpen = enabledRoles.includes(key);
            // OPEN_SEASON_COACH_V1 — team registration stops at the deadline;
            // players and fans keep signing up after it.
            const locked = !roleOpen || (key === "coach" && coachClosed);
            const lockedReason = roleOpen
              ? "Team registration closed on " + deadlineLabel
              : ROLE_CLOSED_REASON[key];
            const coachDesc = key === "coach" && openSeason
              ? "I'm entering a team in this season"
              : meta.description;
            return (
              <button
                key={key}
                type="button"
                disabled={locked}
                onClick={() => pickRole(key)}
                className={locked
                  ? "w-full flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-left opacity-60 cursor-not-allowed"
                  : "w-full flex items-center gap-3 rounded-xl border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50 px-4 py-3 text-left transition-colors"}
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{meta.label}</p>
                  <p className="text-xs text-slate-500">{locked ? lockedReason : coachDesc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Shell>
    );
  }

  if (step === "consent") {
    // CONSENT_LOG_V1 — the component has always accepted these three and nobody ever passed
    // them, so every row it wrote recorded the league, role and page as blanks.
    return (
      <PrivacyConsentStep
        onAccept={handleConsentAccept}
        onBack={() => setStep(roleKey === "coach" ? coachBackStep : "role")}
        leagueId={campaign?.league_id || ""}
        role={roleKey || ""}
        source="JoinLeague"
      />
    );
  }

  if (step === "details") {
    // PLAYER_SIGNUP_V1 — D6. A player picks from the teams that already exist in this
    // season. If the organizer has not entered any yet there is nothing to pick, so say
    // that plainly instead of showing an empty dropdown.
    const noTeamsYet = roleKey === "player" && teams.length === 0;
    return (
      <Shell campaign={campaign} roleKey={roleKey} stepNumber={2} compact>
        <button
          type="button"
          onClick={() => { setStep(roleKey === "coach" ? coachBackStep : "role"); setFormError(""); }}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <Banner message={formError} />

        <div className="space-y-4">
          {roleKey === "coach" && coachPath === "new_team" && (
            <div data-marker="OPEN_SEASON_COACH_V1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Team you're entering</label>
              <div className="rounded-xl border-2 px-4 py-3 flex items-center gap-2 bg-orange-50 border-orange-300">
                <ClipboardList className="w-5 h-5 flex-shrink-0" style={{ color: accent }} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{requestedTeamName.trim() || "Your team"}</p>
                  <p className="text-xs text-slate-500">The league admin creates this team when they approve you</p>
                </div>
              </div>
            </div>
          )}

          {roleKey === "coach" && coachPath !== "new_team" && <LockedTeamField teamName={(codeInfo && codeInfo.team_name) || "Your team"} accent={accent} />}

          {noTeamsYet && (
            <div data-marker="PLAYER_SIGNUP_V1" className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">No teams yet</p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                The league admin hasn't added the teams for this season yet, so there's nothing to join
                right now. Check back in a few days, or contact them if you already know your team.
              </p>
            </div>
          )}

          {roleKey === "player" && !noTeamsYet && (
            <>
              <div data-marker="PLAYER_SIGNUP_V1">
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

          {roleKey === "viewer" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Favorite team <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {teams.map((t) => {
                  const selected = selectedTeamId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setSelectedTeamId(t.id); setFormError(""); }}
                      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition-colors ${selected ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:border-orange-200"}`}
                    >
                      {t.logo_url ? (
                        <img src={t.logo_url} alt={t.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <span className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || accent }} />
                      )}
                      <span className="text-sm text-slate-800 truncate">{t.name}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => { setSelectedTeamId(""); setFormError(""); }}
                className={`mt-2 w-full rounded-xl border-2 border-dashed px-3 py-2 text-sm transition-colors ${selectedTeamId === "" ? "border-orange-300 bg-orange-50 text-slate-700" : "border-slate-200 text-slate-500 hover:border-orange-200"}`}
              >
                No favorite — follow the whole league
              </button>
            </div>
          )}

          <div className={noTeamsYet ? "hidden" : ""}>
            <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
            <Select value={country} onValueChange={(v) => { setCountry(v); setFormError(""); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            data-marker="FAN_INSTANT_FOLLOW_V1"
            onClick={handleSubmit}
            disabled={isSubmitting || noTeamsYet}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-60"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
              </span>
            ) : (
              roleKey === "viewer" ? "Start following" : "Submit for approval"
            )}
          </Button>

          <p className="text-xs text-slate-500 text-center leading-relaxed">
            {noTeamsYet
              ? "Nothing has been submitted — you can come back to this link any time."
              : roleKey === "viewer"
              ? "Free — you'll start following instantly."
              : "You'll get an email once the league admin approves you."}
          </p>
        </div>
      </Shell>
    );
  }

  // OPEN_SEASON_COACH_V1 — step === "team": open season, no code. The coach names
  // the team they want to enter and can leave the organizer a short note.
  if (step === "team") {
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
        <div className="space-y-4" data-marker="OPEN_SEASON_COACH_V1">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Team name</label>
            <Input
              value={requestedTeamName}
              onChange={(e) => { setRequestedTeamName(e.target.value); setFormError(""); }}
              placeholder="e.g., Espoo Eagles"
              maxLength={60}
            />
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              The name your team will play under. The league admin creates the team when they approve you.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Note to the organizer <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <Textarea
              value={organizerNote}
              onChange={(e) => { setOrganizerNote(e.target.value.slice(0, 300)); setFormError(""); }}
              placeholder="Anything the organizer should know — home venue, age group, roughly how many players."
              rows={3}
              maxLength={300}
            />
            <p className="text-xs text-slate-400 mt-1 text-right">{organizerNote.length} / 300</p>
          </div>

          {deadlineLabel && (
            <p className="text-xs text-slate-500 leading-relaxed">
              Team registration closes on <span className="font-semibold text-slate-700">{deadlineLabel}</span>.
            </p>
          )}

          <Button
            onClick={() => {
              if (!requestedTeamName.trim()) { setFormError("Please enter the name of the team you want to enter."); return; }
              setFormError("");
              setStep("consent");
            }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          >
            Continue
          </Button>

          <button
            type="button"
            onClick={() => { setCoachPath("code"); setStep("code"); setFormError(""); }}
            className="w-full text-xs text-slate-500 hover:text-slate-700 underline"
          >
            I already have a team code
          </button>
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
        {openSeason && !coachClosed && (
          <button
            type="button"
            data-marker="OPEN_SEASON_COACH_V1"
            onClick={() => { setCoachPath("new_team"); setStep("team"); setFormError(""); }}
            className="w-full text-xs text-slate-500 hover:text-slate-700 underline"
          >
            I don't have a code — my team isn't set up yet
          </button>
        )}
      </div>
    </Shell>
  );
}
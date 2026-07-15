import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, AlertCircle, ChevronLeft } from "lucide-react";
import PrivacyConsentStep from "@/components/registration/PrivacyConsentStep";

// JOIN_FINNOY_COACH_V1 — Dedicated coach-only signup for Fin-Noy Ballers 40Up Season 6.
// Modeled on JoinKOE: renders OUTSIDE the app Layout (top-level route in App.jsx) so the
// RegistrationGate never intercepts brand-new users. Produces the SAME UserApplication shape
// as RegistrationGate coach applications, so submissions drop straight into the existing
// review/approval/email pipeline. No role step — this page is coaches only. The team is not
// chosen from a dropdown: it is set by a one-time invite code validated server-side through
// the validateCoachCode function (codes live in the app_admin-only CoachInviteCode entity).
// Flow: code (step 1) -> privacy consent -> details (step 2) -> success.
// On-page banners only (alert() is blocked in base44's sandboxed iframe).

const FINNOY_LEAGUE_ID = "6a4f0b979fd47f6d0bbbc67d";
const CREST_URL = "https://base44.app/api/apps/68fa0e7f8bbf24ed563563de/files/mp/public/68fa0e7f8bbf24ed563563de/cf53a5caa_finnoy_crest_transparent.png";
const LOGO_URL = "https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/a6f36183f_CourtSidebyAILOGOTransparent.png";
const GENERIC_CODE_ERROR = "That code is not valid or has already been used. Please contact the league admin.";

function Shell({ children, stepNumber, compact }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl overflow-hidden">
        {compact ? (
          <div className="px-5 py-3 flex items-center gap-3" style={{ backgroundColor: "#0B1F3A" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#12345E", border: "2px solid #E5C688" }}>
              <img src={CREST_URL} alt="Fin-Noy Sports Club" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <p className="text-white text-sm font-bold leading-tight">Fin-Noy Ballers 40Up</p>
              <p className="text-xs" style={{ color: "#9FB3CE" }}>Coach registration · Season 6</p>
            </div>
          </div>
        ) : (
          <div className="relative px-6 pt-7 pb-5 flex flex-col items-center text-center" style={{ backgroundColor: "#0B1F3A" }}>
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: "#12345E", border: "3px solid #E5C688" }}>
              <img src={CREST_URL} alt="Fin-Noy Sports Club" className="w-20 h-20 object-contain" />
            </div>
            <p className="text-xs font-bold" style={{ color: "#E5C688", letterSpacing: "2px" }}>FIN-NOY SPORTS CLUB</p>
            <h1 className="text-white font-extrabold text-2xl leading-tight mt-1">Fin-Noy Ballers 40Up</h1>
            <div className="mt-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest text-white" style={{ backgroundColor: "#F26B1F" }}>
              SEASON 6 · COACH REGISTRATION
            </div>
            <p className="text-xs mt-2" style={{ color: "#9FB3CE" }}>Season starts August 2026</p>
            <p className="text-xs font-semibold mt-3 pt-3 w-full" style={{ color: "#E5C688", letterSpacing: "1.5px", borderTop: "1px solid #24406B" }}>
              TRUST · RESPECT · SOLIDARITY
            </p>
          </div>
        )}
        <div className="h-1 w-full" style={{ backgroundColor: "#F26B1F" }} />
        <div className="px-6 py-5">
          {stepNumber && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold tracking-widest" style={{ color: "#F26B1F" }}>STEP {stepNumber} / 2</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ backgroundColor: "#F26B1F", width: `${(stepNumber / 2) * 100}%` }} />
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

function LockedTeamField({ teamName }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Your team</label>
      <div className="rounded-xl border-2 px-4 py-3 flex items-center gap-2 bg-orange-50 border-orange-300">
        <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "#F26B1F" }} />
        <div>
          <p className="text-sm font-semibold text-slate-800">{teamName}</p>
          <p className="text-xs text-slate-500">Set from your team code</p>
        </div>
      </div>
    </div>
  );
}

export default function JoinFinNoyCoach() {
  const [step, setStep] = useState("loading"); // loading | load_error | code | consent | details | already_applied | success
  const [user, setUser] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [codeInput, setCodeInput] = useState("");
  const [codeInfo, setCodeInfo] = useState(null); // { team_id, team_name, league_id, league_name }
  const [isChecking, setIsChecking] = useState(false);

  const [consentData, setConsentData] = useState(null);
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("Finland");

  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await base44.auth.me();
        if (cancelled) return;
        setUser(me);

        // Already a registered member of this league? Straight into the app.
        const assignedLeagueIds = Array.isArray(me.assigned_league_ids) ? me.assigned_league_ids : [];
        if (assignedLeagueIds.includes(FINNOY_LEAGUE_ID)) {
          if (!cancelled) window.location.replace("/");
          return;
        }

        // Already applied to this league? Pending screen instead of a resubmit.
        const apps = await base44.entities.UserApplication.filter({ user_id: me.id });
        const alreadyApplied = (apps || []).some(
          a => a.league_id === FINNOY_LEAGUE_ID || (Array.isArray(a.league_ids) && a.league_ids.includes(FINNOY_LEAGUE_ID))
        );
        if (cancelled) return;
        if (alreadyApplied) {
          setStep("already_applied");
          return;
        }

        setFullName(me.full_name || "");
        setStep("code");
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

  const extractError = (e) =>
    (e && e.response && e.response.data && e.response.data.error) ||
    (e && e.data && e.data.error) ||
    GENERIC_CODE_ERROR;

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
    const name = (fullName || "").trim();
    if (!name) { setFormError("Please enter your full name."); return; }
    if (!country.trim()) { setFormError("Please enter your country."); return; }
    if (!codeInfo || !codeInfo.team_id) { setFormError(GENERIC_CODE_ERROR); return; }

    setIsSubmitting(true);
    try {
      // Redeem first — burns the one-time code. The function is idempotent for the same
      // email, so if application creation fails below, this user can safely retry.
      await base44.functions.invoke("validateCoachCode", { action: "redeem", code: codeInput });

      // Same shape as RegistrationGate coach applications, so this drops into the
      // existing review/approval/email pipeline untouched.
      const leagueId = codeInfo.league_id || FINNOY_LEAGUE_ID;
      const applicationData = {
        user_id: user.id,
        user_email: user.email,
        user_name: name,
        requested_role: "coach",
        status: "Pending",
        applied_at: new Date().toISOString(),
        country: country.trim(),
        league_id: leagueId,
        league_ids: [leagueId],
        team_id: codeInfo.team_id,
        league_team_pairs: [{ league_id: leagueId, team_id: codeInfo.team_id }],
      };

      await base44.entities.UserApplication.create(applicationData);

      await base44.auth.updateMe({
        application_status: "Pending",
        ...(name ? { full_name: name } : {}),
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
      <Shell compact>
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          <p className="text-sm text-slate-500">Loading the Fin-Noy coach registration…</p>
        </div>
      </Shell>
    );
  }

  if (step === "load_error") {
    return (
      <Shell compact>
        <Banner message={loadError} />
        <Button onClick={() => window.location.reload()} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold">
          Try again
        </Button>
      </Shell>
    );
  }

  if (step === "already_applied") {
    return (
      <Shell compact>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7" style={{ color: "#F26B1F" }} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">You've already applied</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Your Fin-Noy Ballers 40Up registration is in and pending review. You'll get an email as soon as the
            league admin approves it.
          </p>
        </div>
      </Shell>
    );
  }

  if (step === "success") {
    return (
      <Shell compact>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">You're in — pending approval</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            The league admin will review your registration. Once approved, you'll find{" "}
            <span className="font-semibold text-slate-800">My Roster</span> in your menu to set up your team
            before the season starts.
          </p>
        </div>
      </Shell>
    );
  }

  if (step === "consent") {
    return <PrivacyConsentStep onAccept={handleConsentAccept} onBack={() => setStep("code")} />;
  }

  if (step === "details") {
    return (
      <Shell stepNumber={2} compact>
        <button
          type="button"
          onClick={() => { setStep("code"); setFormError(""); }}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to team code
        </button>

        <Banner message={formError} />

        <div className="space-y-4">
          <LockedTeamField teamName={(codeInfo && codeInfo.team_name) || "Your team"} />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
            <Input
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setFormError(""); }}
              placeholder="Your full name"
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
    <Shell stepNumber={1}>
      <Banner message={formError} />
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Team code</label>
          <Input
            value={codeInput}
            onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setFormError(""); }}
            placeholder="FNB-____"
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
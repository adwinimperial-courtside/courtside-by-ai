import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertCircle, MonitorPlay } from "lucide-react";
import PrivacyConsentStep from "@/components/registration/PrivacyConsentStep";

// ACCEPT_INVITE_V1 - the landing page for the "Accept invitation" button in the
// video admin invitation email.
//
// Renders OUTSIDE the app Layout (top-level route in App.jsx, same as JoinKOE and
// the Fin-Noy coach page) so the RegistrationGate never intercepts a brand-new
// user before they reach it.
//
// The invitation is matched on the signed-in email address, server-side, by the
// manageVideoAdmins function. This page never sees anyone else's invitation.
//
// Flow: loading -> (consent, new users only) -> confirm -> success
// Failure states: no invitation for this email, invitation expired, already holds
// another role in that league.
//
// On-page banners only. alert() is silently swallowed in base44's iframe.

const LOGO_URL = "https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/a6f36183f_CourtSidebyAILOGOTransparent.png";

function Shell({ children, pillText, pillTone }) {
  const tone = pillTone === "muted" ? "bg-slate-600" : "bg-[#F26B1F]";
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-[#0B1F3A] px-6 py-7 text-center">
          <img src={LOGO_URL} alt="Courtside by AI" className="h-8 mx-auto object-contain" />
          {pillText ? (
            <span className={`inline-block mt-4 text-[11px] font-bold uppercase tracking-widest text-white px-3.5 py-1.5 rounded-full ${tone}`}>
              {pillText}
            </span>
          ) : null}
        </div>
        <div className="h-1 bg-[#F26B1F]" />
        <div className="p-6 sm:p-7">{children}</div>
      </div>
    </div>
  );
}

function LockedField({ label, value }) {
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5 mb-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-800">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-[15px] font-bold text-slate-900 mt-1 break-words">{value}</div>
    </div>
  );
}

export default function AcceptInvite() {
  const [step, setStep] = useState("loading");
  const [invite, setInvite] = useState(null);
  const [signedInAs, setSignedInAs] = useState("");
  const [needsConsent, setNeedsConsent] = useState(false);
  const [consentData, setConsentData] = useState(null);
  const [failReason, setFailReason] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await base44.auth.me();
        setSignedInAs((me && me.email) || "");
        setNeedsConsent(!(me && me.privacy_terms_accepted));

        const res = await base44.functions.invoke("manageVideoAdmins", { action: "check" });
        const data = (res && res.data) || {};

        if (!data.found) {
          setFailReason(data.reason === "expired" ? "expired" : "no_invite");
          setSignedInAs(data.signed_in_as || (me && me.email) || "");
          setStep("nomatch");
          return;
        }

        setInvite(data);
        setStep("confirm");
      } catch (e) {
        setFailReason("no_invite");
        setStep("nomatch");
      }
    };
    load();
  }, []);

  const handleConsentAccept = (data) => {
    setConsentData(data);
    setFormError("");
    setStep("confirm");
  };

  const handleAccept = async () => {
    setFormError("");

    // New accounts record consent before the role is granted, so a failure at the
    // grant step never leaves an unconsented account holding a role.
    if (needsConsent && !consentData) {
      setStep("consent");
      return;
    }

    setIsSubmitting(true);
    try {
      if (consentData) {
        await base44.auth.updateMe({
          application_status: "Approved",
          ...consentData,
        });
      }

      const res = await base44.functions.invoke("manageVideoAdmins", { action: "accept" });
      const data = (res && res.data) || {};
      if (data.error) {
        setFormError(data.error);
        return;
      }

      setStep("success");
    } catch (e) {
      const msg = (e && e.response && e.response.data && e.response.data.error) ||
        (e && e.message) ||
        "Please try again.";
      setFormError("We couldn't accept the invitation: " + msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "loading") {
    return (
      <Shell>
        <div className="py-10 text-center">
          <Loader2 className="w-7 h-7 text-slate-300 animate-spin mx-auto" />
          <p className="text-sm text-slate-400 mt-3">Looking for your invitation...</p>
        </div>
      </Shell>
    );
  }

  if (step === "consent") {
    return <PrivacyConsentStep onAccept={handleConsentAccept} onBack={() => setStep("confirm")} />;
  }

  if (step === "nomatch") {
    return (
      <Shell pillText="No invitation found" pillTone="muted">
        <h1 className="text-xl font-bold text-slate-900 text-center">
          {failReason === "expired" ? "That invitation has expired" : "We couldn't find an invitation"}
        </h1>
        <p className="text-[13.5px] text-slate-500 text-center mt-1.5 mb-5 leading-relaxed">
          {failReason === "expired"
            ? "Invitations are valid for 14 days."
            : "Nothing is waiting for the address you signed in with."}
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Signed in as</div>
          <div className="text-[15px] font-bold text-slate-900 mt-1 break-words">{signedInAs || "\u2014"}</div>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-relaxed text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            {failReason === "expired"
              ? "Ask your league admin to send you a new invitation."
              : "Your invitation may have been sent to a different address. Ask your league admin to resend it to this one, or sign out and sign back in with the address they invited."}
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full mt-4"
          onClick={() => base44.auth.logout("/AcceptInvite")}
        >
          Sign out and try another account
        </Button>
        <p className="text-[11.5px] text-slate-400 text-center mt-3.5 leading-relaxed">
          Still stuck? Contact your league admin.
        </p>
      </Shell>
    );
  }

  if (step === "success") {
    return (
      <Shell pillText="You're in">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-4">You're the video admin</h1>
          <p className="text-[13.5px] text-slate-500 mt-1.5 leading-relaxed">
            You now have overlay control for{" "}
            <span className="font-semibold text-slate-700">{(invite && invite.league_name) || "your league"}</span>.
          </p>
        </div>

        <Button
          className="w-full mt-6 bg-[#F26B1F] hover:bg-orange-600 text-white"
          onClick={() => { window.location.replace("/GameOverlaySettings"); }}
        >
          <MonitorPlay className="w-4 h-4 mr-2" />
          Set up the game overlay
        </Button>
        <p className="text-[11.5px] text-slate-400 text-center mt-3.5 leading-relaxed">
          You can get back here any time from Game Overlay in the menu.
        </p>
      </Shell>
    );
  }

  // step === "confirm"
  return (
    <Shell pillText="Video Admin invitation">
      <h1 className="text-xl font-bold text-slate-900 text-center">You're invited to run the stream</h1>
      <p className="text-[13.5px] text-slate-500 text-center mt-1.5 mb-5 leading-relaxed">
        {invite && invite.invited_by_name ? `Invited by ${invite.invited_by_name}. ` : ""}
        Accepting gives you overlay control for this league.
      </p>

      <LockedField label="League" value={(invite && invite.league_name) || "Your league"} />
      <LockedField label="Signed in as" value={signedInAs || "\u2014"} />

      {formError ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-relaxed text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>{formError}</div>
        </div>
      ) : null}

      <Button
        className="w-full mt-5 bg-[#F26B1F] hover:bg-orange-600 text-white"
        onClick={handleAccept}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Accepting...
          </span>
        ) : "Accept and continue"}
      </Button>

      <p className="text-[11.5px] text-slate-400 text-center mt-3.5 leading-relaxed">
        You'll go straight to Game Overlay settings.
        <br />
        No approval needed{" \u2014 "}your league admin already approved you.
      </p>
    </Shell>
  );
}
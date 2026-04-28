import React, { useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const CONSENT_VERSION = "2026-04-privacy-consent-v1";

export default function ConsentReminderModal({ user, onDismiss }) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAccept = async () => {
    if (!termsAccepted) { setShowError(true); return; }
    setIsSaving(true);
    const now = new Date().toISOString();
    try {
      await base44.auth.updateMe({
        privacy_terms_accepted: true,
        privacy_terms_accepted_at: now,
        marketing_email_consent: marketingConsent,
        marketing_email_consent_at: marketingConsent ? now : null,
        consent_version: CONSENT_VERSION,
      });
      onDismiss();
    } catch (e) {
      console.error("Failed to save consent", e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">We've updated our Privacy Policy</h2>
            <p className="text-xs text-slate-500">Courtside by AI</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-5 leading-relaxed">
          We want to make sure you're informed about how Courtside by AI uses your information.
          Please review and accept our updated terms to continue using the platform.
        </p>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4 text-sm text-slate-600 space-y-2 leading-relaxed">
          <p className="font-semibold text-slate-800">What we collect and why:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Your email, role, league, and profile information</li>
            <li>Game statistics, awards, badges, rankings, and activity</li>
            <li>Basic login and usage data to operate and protect the platform</li>
          </ul>
          <p className="text-xs mt-2">
            Some information (player names, stats, standings, awards) may be visible to other users in your league.
            Your email is not publicly displayed.
          </p>
          <p className="text-xs">
            For data requests: <a href="mailto:info@courtside-by-ai.com" className="text-orange-500 hover:underline">info@courtside-by-ai.com</a>
          </p>
        </div>

        {/* Required */}
        <div className={`rounded-xl border-2 p-4 mb-3 transition-colors ${termsAccepted ? "border-orange-400 bg-orange-50" : showError ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={e => { setTermsAccepted(e.target.checked); setShowError(false); }}
              className="w-5 h-5 mt-0.5 accent-orange-500 flex-shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                I agree to the{" "}
                <a href="/terms-of-use" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">Terms of Use</a>
                {" "}and{" "}
                <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">Privacy Policy</a>.
                <span className="text-red-500 ml-1">*</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Required to continue using Courtside by AI.</p>
            </div>
          </label>
        </div>

        {/* Optional marketing */}
        <div className={`rounded-xl border-2 p-4 mb-4 transition-colors ${marketingConsent ? "border-green-300 bg-green-50" : "border-slate-200 bg-slate-50"}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={e => setMarketingConsent(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-orange-500 flex-shrink-0"
            />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                I want to receive product updates and marketing emails.
                <span className="ml-2 text-xs font-normal text-slate-400">(optional)</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">You can unsubscribe at any time.</p>
            </div>
          </label>
        </div>

        {showError && !termsAccepted && (
          <p className="text-sm text-red-600 font-medium mb-3">Please agree to the Terms of Use and Privacy Policy before continuing.</p>
        )}

        <Button onClick={handleAccept} disabled={isSaving} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold">
          {isSaving ? "Saving…" : "Accept & Continue"}
        </Button>
      </div>
    </div>
  );
}
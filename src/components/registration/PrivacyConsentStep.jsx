import React, { useState } from "react";
import { ChevronDown, ChevronUp, Shield, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONSENT_VERSION = "2026-04-privacy-consent-v1";

const Section = ({ title, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 py-3 text-sm text-slate-600 leading-relaxed space-y-2 bg-white">
          {children}
        </div>
      )}
    </div>
  );
};

export default function PrivacyConsentStep({ onAccept, onBack }) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);

  const handleContinue = () => {
    if (!termsAccepted) {
      setShowValidationError(true);
      return;
    }
    const now = new Date().toISOString();
    onAccept({
      privacy_terms_accepted: true,
      privacy_terms_accepted_at: now,
      marketing_email_consent: marketingConsent,
      marketing_email_consent_at: marketingConsent ? now : null,
      consent_version: CONSENT_VERSION,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-6 sm:p-8">

        {/* Back */}
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mb-5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to role selection
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Privacy &amp; Consent</h2>
            <p className="text-xs text-slate-500">Courtside by AI</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-5 leading-relaxed">
          Before creating your Courtside by AI account, please review how your information will be used.
          Courtside by AI is a basketball league platform that helps leagues manage live stats, box scores, player profiles,
          coach insights, automated awards, and game stories. To provide these features, we collect and process some personal information.
        </p>

        {/* Accordion sections */}
        <div className="space-y-2 mb-6">
          <Section title="Information we collect">
            <p>When you register, Courtside by AI may collect:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>Your email address</li>
              <li>Your country</li>
              <li>Your selected role (League Organizer, Coach, Player, or Viewer)</li>
              <li>Your league access information</li>
              <li>Your player profile information, if applicable</li>
              <li>Your game statistics, awards, badges, rankings, and activity inside the platform</li>
              <li>Your profile photo, only if you choose to upload one</li>
              <li>Basic login and usage information needed to operate and protect the platform</li>
            </ul>
          </Section>

          <Section title="How we use your information">
            <p>Courtside by AI uses your information to:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>Create and manage your account</li>
              <li>Give you access to the correct league, team, and role</li>
              <li>Display live stats, box scores, standings, player profiles, badges, awards, and rankings</li>
              <li>Provide coach insights and league analytics</li>
              <li>Generate game stories and recaps based on game data</li>
              <li>Support league organizers in managing their leagues</li>
              <li>Improve the platform and keep it secure</li>
              <li>Contact you about important account, access, or service-related updates</li>
            </ul>
          </Section>

          <Section title="Visibility of league and player information">
            <p>Some information may be visible to other users depending on your role, league access, and league settings. This may include player names, team names, game statistics, box scores, standings, player profiles, badges, awards, rankings, Player of the Game results, and generated game stories or recaps.</p>
            <p className="mt-2 font-medium text-slate-700">Your email address is not intended to be publicly displayed.</p>
          </Section>

          <Section title="Profile photos">
            <p>Uploading a profile photo is optional. If you upload one, it may be displayed inside Courtside by AI as part of your player profile, league profile, or game results.</p>
            <p className="mt-2">League organizers are responsible for ensuring they have proper permission before publishing player photos outside Courtside by AI, including on social media.</p>
          </Section>

          <Section title="Story Builder & AI-generated content">
            <p>Courtside by AI may generate game stories, summaries, recaps, coach insights, and other AI-assisted content based on available league and game data.</p>
            <p className="mt-2">These generated outputs are drafts and should be reviewed before being published. League organizers are responsible for what they publish on their league's social media or other public channels.</p>
          </Section>

          <Section title="Marketing emails">
            <p>Courtside by AI may send important service-related emails about your account, access, league approval, security, or platform updates.</p>
            <p className="mt-2">Marketing emails are optional. You can choose whether to receive product updates, feature news, league growth tips, and promotional messages. You can unsubscribe at any time.</p>
          </Section>

          <Section title="Your data rights">
            <p>You may contact Courtside by AI to request access, correction, or deletion of your personal information.</p>
            <p className="mt-2">If your account is deleted, some historical league records, game results, box scores, standings, awards, or statistics may need to be kept in anonymized or limited form to preserve league records and competition history.</p>
            <p className="mt-2">For privacy or data requests, contact: <a href="mailto:info@courtside-by-ai.com" className="text-orange-500 hover:underline">info@courtside-by-ai.com</a></p>
          </Section>
        </div>

        {/* Checkboxes */}
        <div className="space-y-4 mb-6">
          {/* Required */}
          <div className={`rounded-xl border-2 p-4 transition-colors ${termsAccepted ? "border-orange-400 bg-orange-50" : showValidationError ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => { setTermsAccepted(e.target.checked); setShowValidationError(false); }}
                className="w-5 h-5 mt-0.5 accent-orange-500 flex-shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  I agree to the Courtside by AI{" "}
                  <a href="/terms-of-use" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">Terms of Use</a>
                  {" "}and confirm that I have read the{" "}
                  <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">Privacy Policy</a>.
                  <span className="text-red-500 ml-1">*</span>
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  I understand that Courtside by AI will process my information to create my account, manage league access, support live stats, player profiles, coach insights, automated awards, and game stories.
                </p>
              </div>
            </label>
          </div>

          {/* Optional marketing */}
          <div className={`rounded-xl border-2 p-4 transition-colors ${marketingConsent ? "border-green-300 bg-green-50" : "border-slate-200 bg-slate-50"}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={e => setMarketingConsent(e.target.checked)}
                className="w-5 h-5 mt-0.5 accent-orange-500 flex-shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  I want to receive Courtside by AI product updates, feature news, league tips, announcements, and occasional marketing emails.
                  <span className="ml-2 text-xs font-normal text-slate-400">(optional)</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">I understand that I can unsubscribe at any time.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Validation error */}
        {showValidationError && !termsAccepted && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600 font-medium">Please agree to the Terms of Use and Privacy Policy before continuing.</p>
          </div>
        )}

        <Button
          type="button"
          onClick={handleContinue}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
        >
          Continue to Application
        </Button>

        <p className="text-center text-xs text-slate-400 mt-3">
          Required fields are marked with <span className="text-red-500">*</span>
        </p>
      </div>
    </div>
  );
}
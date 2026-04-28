import React from "react";
import { FileText } from "lucide-react";

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Terms of Use</h1>
            <p className="text-sm text-slate-500">Courtside by AI — Last updated: April 2026</p>
          </div>
        </div>

        <div className="text-sm text-slate-700 space-y-6">
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">1. Acceptance of Terms</h2>
            <p>By registering and using Courtside by AI, you agree to these Terms of Use. If you do not agree, do not use the platform.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">2. Use of the Platform</h2>
            <p>Courtside by AI is a basketball league management platform. You agree to use it only for lawful purposes and in a manner consistent with league management, sports statistics, and related activities.</p>
            <p className="mt-2">You are responsible for the accuracy of the information you provide during registration and while using the platform.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">3. Accounts and Access</h2>
            <p>Access to Courtside by AI is role-based and subject to admin approval. You are responsible for maintaining the confidentiality of your account credentials.</p>
            <p className="mt-2">Courtside by AI reserves the right to suspend or terminate accounts that violate these terms or misuse the platform.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">4. League Organizer Responsibilities</h2>
            <p>League organizers using Courtside by AI are responsible for:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Obtaining proper consent from players before publishing their information or photos outside the platform</li>
              <li>Reviewing AI-generated content (game stories, recaps, coach insights) before publishing</li>
              <li>Managing their league data responsibly and in compliance with applicable laws</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">5. AI-Generated Content</h2>
            <p>Courtside by AI may generate game stories, summaries, insights, and other content using AI. These are drafts and tools to assist league organizers. Courtside by AI does not guarantee the accuracy of AI-generated content and is not responsible for how it is used outside the platform.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">6. Data and Privacy</h2>
            <p>Your use of Courtside by AI is also governed by our <a href="/privacy-policy" className="text-orange-500 hover:underline">Privacy Policy</a>, which is incorporated into these Terms of Use by reference.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">7. Modifications</h2>
            <p>Courtside by AI may update these Terms of Use from time to time. Continued use of the platform after changes are posted constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">8. Contact</h2>
            <p>For questions about these Terms of Use, contact: <a href="mailto:info@courtside-by-ai.com" className="text-orange-500 hover:underline">info@courtside-by-ai.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
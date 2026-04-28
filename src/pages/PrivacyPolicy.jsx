import React from "react";
import { Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Privacy Policy</h1>
            <p className="text-sm text-slate-500">Courtside by AI — Last updated: April 2026</p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none text-sm text-slate-700 space-y-6">
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Information we collect</h2>
            <p>When you register, Courtside by AI may collect:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Your email address</li>
              <li>Your country</li>
              <li>Your selected role (League Organizer, Coach, Player, or Viewer)</li>
              <li>Your league access information</li>
              <li>Your player profile information, if applicable</li>
              <li>Your game statistics, awards, badges, rankings, and activity inside the platform</li>
              <li>Your profile photo, only if you choose to upload one</li>
              <li>Basic login and usage information needed to operate and protect the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">How we use your information</h2>
            <p>Courtside by AI uses your information to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Create and manage your account</li>
              <li>Give you access to the correct league, team, and role</li>
              <li>Display live stats, box scores, standings, player profiles, badges, awards, and rankings</li>
              <li>Provide coach insights and league analytics</li>
              <li>Generate game stories and recaps based on game data</li>
              <li>Support league organizers in managing their leagues</li>
              <li>Improve the platform and keep it secure</li>
              <li>Contact you about important account, access, or service-related updates</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Visibility of league and player information</h2>
            <p>Some information inside Courtside by AI may be visible to other users depending on your role, league access, and league settings. This may include player names, team names, game statistics, box scores, standings, player profiles, badges, awards, rankings, Player of the Game results, and generated game stories or recaps.</p>
            <p className="mt-2 font-medium">Your email address is not intended to be publicly displayed.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Profile photos</h2>
            <p>Uploading a profile photo is optional. If you upload a profile photo, you understand that it may be displayed inside Courtside by AI as part of your player profile, league profile, game results, awards, or related league features.</p>
            <p className="mt-2">League organizers are responsible for making sure they have the proper permission before publishing player photos or player-related content outside Courtside by AI, including on social media.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Story Builder and AI-generated content</h2>
            <p>Courtside by AI may generate game stories, summaries, recaps, coach insights, and other AI-assisted content based on available league and game data. These generated outputs are drafts and should be reviewed before being published or used outside the platform.</p>
            <p className="mt-2">League organizers are responsible for reviewing and deciding what they publish on their league's social media pages or other public channels.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Marketing emails</h2>
            <p>Courtside by AI may send important service-related emails about your account, access, league approval, security, or platform updates.</p>
            <p className="mt-2">Marketing emails are optional. You can choose whether you want to receive product updates, feature news, league growth tips, announcements, and promotional messages from Courtside by AI. You can unsubscribe at any time.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2">Your data rights</h2>
            <p>You may contact Courtside by AI to request access, correction, or deletion of your personal information.</p>
            <p className="mt-2">If your account is deleted, some historical league records, game results, box scores, standings, awards, or statistics may need to be kept in anonymized or limited form to preserve league records and competition history.</p>
            <p className="mt-2">For privacy or data requests, contact: <a href="mailto:info@courtside-by-ai.com" className="text-orange-500 hover:underline">info@courtside-by-ai.com</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
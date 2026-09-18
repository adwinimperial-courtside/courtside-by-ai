import React from "react";
import { UserPlus, ClipboardCheck, BarChart3 } from "lucide-react";

// JOIN_INVITE_WELCOME_V1 - shown to SIGNED-OUT visitors who open a join link
// (/Join/<slug>, /JoinKOE, the Fin-Noy coach link) instead of dropping them
// straight onto the Base44 login screen. Static only: no database or function
// calls, because signed-out visitors cannot load app data. The button sends them
// to the normal login; App.jsx has already stored the join intent, so after
// sign-in they land back on the same join page.

const LOGO_URL = "https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/a6f36183f_CourtSidebyAILOGOTransparent.png";

const STEPS = [
  { icon: UserPlus, title: "Create your account or sign in", text: "Use Google, Microsoft, Facebook, Apple or your email." },
  { icon: ClipboardCheck, title: "Pick your role", text: "Coach, player or fan. You'll land right back on your league's sign-up page." },
  { icon: BarChart3, title: "Follow every game", text: "Live stats, standings and player profiles for your league." },
];

export default function JoinInviteWelcome({ onContinue }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-[#0B1F3A] px-4 pt-8 pb-16 text-center">
        <img src={LOGO_URL} alt="Courtside by AI" className="h-14 mx-auto mb-5 object-contain" />
        <p className="text-xs font-bold tracking-widest text-[#F26B1F] uppercase mb-2">You're invited</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">Join your league on Courtside by AI</h1>
        <p className="text-sm text-slate-300 mt-3 max-w-md mx-auto">
          Your league runs its games, stats and sign-ups on Courtside by AI. It takes about a minute to join.
        </p>
      </div>

      <div className="flex-1 px-4 -mt-10 pb-10">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <ol className="space-y-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={i} className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#F26B1F]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{i + 1}. {s.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <button
            type="button"
            onClick={onContinue}
            className="mt-6 w-full rounded-xl bg-[#F26B1F] hover:bg-[#d95c14] text-white font-semibold py-3 text-sm transition-colors"
          >
            Create account or sign in
          </button>

          <p className="text-xs text-slate-500 text-center mt-4 leading-relaxed">
            Before you join, you can read our{" "}
            <a href="/terms-of-use" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">Terms of Use</a>
            {" "}and{" "}
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">Privacy Policy</a>.
          </p>
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">Courtside by AI · Numbers Don't Lie.</p>
      </div>
    </div>
  );
}
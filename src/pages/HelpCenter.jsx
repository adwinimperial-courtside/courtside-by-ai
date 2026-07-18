// HELP_CENTER_V1 — role-filtered Help Center page.
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";
import {
  HELP_CATEGORIES,
  getTopicsForRole,
} from "../components/help/helpContent";

const ROLE_LABELS = {
  app_admin: "App Admin",
  ops_admin: "Operations Admin",
  league_admin: "League Admin",
  coach: "Coach",
  player: "Player",
  video_admin: "Video Admin",
  viewer: "Viewer",
};

export default function HelpCenter() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error("Failed to fetch user:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const role = currentUser?.user_type || "viewer";
  const topics = getTopicsForRole(role);

  const grouped = HELP_CATEGORIES.map((cat) => ({
    ...cat,
    topics: topics.filter((t) => t.category === cat.key),
  })).filter((cat) => cat.topics.length > 0);

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <HelpCircle className="w-7 h-7 text-[#F26B1F]" />
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
          Help Center
        </h1>
      </div>
      <p className="text-sm text-slate-600 mb-6">
        {loading
          ? "Loading topics…"
          : `Showing topics for your role: ${ROLE_LABELS[role] || "Viewer"}`}
      </p>

      {!loading && grouped.length === 0 && (
        <p className="text-slate-600">No help topics available yet.</p>
      )}

      {grouped.map((cat) => (
        <div key={cat.key} className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">
            {cat.label}
          </h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <Accordion type="single" collapsible className="w-full">
              {cat.topics.map((topic) => (
                <AccordionItem key={topic.key} value={topic.key}>
                  <AccordionTrigger className="px-4 text-left text-[#0B1F3A] font-medium hover:no-underline hover:bg-slate-50">
                    {topic.title}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <p className="text-sm text-slate-700 leading-relaxed mb-3">
                      {topic.summary}
                    </p>
                    {topic.tips && topic.tips.length > 0 && (
                      <ul className="space-y-2">
                        {topic.tips.map((tip, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-sm text-slate-700 leading-relaxed"
                          >
                            <span className="text-[#F26B1F] flex-shrink-0">
                              •
                            </span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      ))}
    </div>
  );
}
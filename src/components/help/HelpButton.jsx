// HELP_CENTER_V1 — per-page "?" button that opens a bottom sheet with that page's help.
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ArrowRight } from "lucide-react";
import { getHelpTopic } from "./helpContent";

export default function HelpButton({ pageKey }) {
  const [open, setOpen] = useState(false);
  const topic = getHelpTopic(pageKey);

  if (!topic) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Help for ${topic.title}`}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-[#F26B1F] text-[#F26B1F] text-sm font-bold leading-none hover:bg-orange-50 transition-colors flex-shrink-0"
      >
        ?
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="text-[#0B1F3A]">
              About this page: {topic.title}
            </SheetTitle>
          </SheetHeader>

          <p className="mt-2 text-sm text-slate-700 leading-relaxed">
            {topic.summary}
          </p>

          {topic.tips && topic.tips.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-[#0B1F3A] mb-2">
                Quick tips
              </p>
              <ul className="space-y-2">
                {topic.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
                    <span className="text-[#F26B1F] flex-shrink-0">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-slate-200">
            <Link
              to={createPageUrl("HelpCenter")}
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#F26B1F] hover:underline"
            >
              Open full Help Center
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
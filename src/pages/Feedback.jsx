import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { MessageSquare, Bug, Lightbulb, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import HelpButton from "../components/help/HelpButton";

const TABS = ["all", "new", "reviewed", "dismissed"];

export default function FeedbackPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: feedbacks = [], isLoading } = useQuery({
    queryKey: ["feedbacks"],
    queryFn: () => base44.entities.Feedback.list("-submitted_at", 200),
    staleTime: 0,
  });

  if (currentUser && currentUser.user_type !== "app_admin" && currentUser.user_type !== "ops_admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Access restricted to app administrators.</p>
        </div>
      </div>
    );
  }

  const filtered = activeTab === "all" ? feedbacks : feedbacks.filter(f => f.status === activeTab);

  const updateStatus = async (id, status) => {
    await base44.entities.Feedback.update(id, { status });
    queryClient.invalidateQueries({ queryKey: ["feedbacks"] });
  };

  const counts = {
    all: feedbacks.length,
    new: feedbacks.filter(f => f.status === "new").length,
    reviewed: feedbacks.filter(f => f.status === "reviewed").length,
    dismissed: feedbacks.filter(f => f.status === "dismissed").length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2"><h1 className="text-3xl font-bold text-slate-900">Feedback</h1><HelpButton pageKey="feedback" /></div>
            <p className="text-slate-500 text-sm mt-0.5">Bug reports and suggestions from users.</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-colors ${
                activeTab === tab
                  ? "bg-orange-500 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-orange-300"
              }`}
            >
              {tab} <span className="opacity-70">({counts[tab]})</span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center text-slate-400 py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p>No feedback in this category yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(item => (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.type === "bug" ? (
                      <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                        <Bug className="w-3.5 h-3.5" /> Bug Report
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                        <Lightbulb className="w-3.5 h-3.5" /> Suggestion
                      </span>
                    )}
                    {item.status === "new" && (
                      <Badge className="bg-orange-100 text-orange-700 border-0">New</Badge>
                    )}
                    {item.status === "reviewed" && (
                      <Badge className="bg-green-100 text-green-700 border-0">Reviewed</Badge>
                    )}
                    {item.status === "dismissed" && (
                      <Badge className="bg-slate-100 text-slate-500 border-0">Dismissed</Badge>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {item.status !== "reviewed" && (
                      <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => updateStatus(item.id, "reviewed")}>
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Mark Reviewed
                      </Button>
                    )}
                    {item.status !== "dismissed" && (
                      <Button size="sm" variant="outline" className="text-slate-500 hover:bg-slate-50" onClick={() => updateStatus(item.id, "dismissed")}>
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Dismiss
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-slate-800 text-sm mb-4 leading-relaxed">{item.description}</p>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 border-t border-slate-100 pt-3">
                  <span><span className="font-medium text-slate-600">{item.submitted_by_name}</span> · {item.submitted_by}</span>
                  <span className="capitalize">{item.user_type?.replace("_", " ")}</span>
                  {item.page_url && <span>Page: <span className="font-mono text-slate-500">{item.page_url}</span></span>}
                  {item.submitted_at && <span>{format(new Date(item.submitted_at), "MMM d, yyyy · h:mm a")}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
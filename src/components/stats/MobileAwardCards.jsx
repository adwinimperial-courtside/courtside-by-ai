import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Trophy, Shield, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MobileAwardCards({ candidates, awardType = "mvp", isExpanded, onToggle }) {
  const [showAll, setShowAll] = useState(false);
  
  const displayedCandidates = showAll ? candidates : candidates.slice(0, 5);
  const isMvp = awardType === "mvp";
  const scoreKey = isMvp ? "mvpScore" : "dpoyScore";
  const avgKey = isMvp ? "avgGis" : "avgDefGis";

  const getAwardBadge = (index) => {
    if (index === 0) {
      return isMvp ? (
        <Badge className="bg-yellow-500 text-white">MVP</Badge>
      ) : (
        <Badge className="bg-blue-500 text-white">DPOY</Badge>
      );
    }
    if (isMvp && index < 5) {
      return <Badge className="bg-purple-500 text-white">Mythical {index}</Badge>;
    }
    return null;
  };

  return (
    <div className="space-y-3">
      {displayedCandidates.map((candidate, index) => (
        <div
          key={candidate.playerId}
          className={`p-4 rounded-xl border transition-all ${
            index === 0
              ? "bg-gradient-to-br from-yellow-50 to-yellow-100/50 border-yellow-200 shadow-md"
              : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          {/* Rank and Award Badge */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-xl font-bold ${index === 0 ? "text-yellow-600" : "text-slate-400"}`}>
                #{index + 1}
              </span>
            </div>
            {getAwardBadge(index)}
          </div>

          {/* Player Name and Team */}
          <div className="mb-3">
            <h3 className={`font-bold ${index === 0 ? "text-lg text-slate-900" : "text-base text-slate-900"}`}>
              {candidate.player.name}
            </h3>
            <p className="text-sm text-slate-600">{candidate.team.name} • {candidate.gp} GP</p>
          </div>

          {/* Score and Stats */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-600">
                {isMvp ? "MVP Score" : "DPOY Score"}:
              </span>
              <span className={`font-bold ${index === 0 ? "text-2xl text-yellow-600" : "text-xl text-slate-900"}`}>
                {candidate[scoreKey]}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-600">
                {isMvp ? "Avg GIS" : "Avg DEF_GIS"}:
              </span>
              <span className="text-sm font-semibold text-slate-700">{candidate[avgKey]}</span>
            </div>
          </div>
        </div>
      ))}

      {/* View Full Ranking Toggle */}
      {candidates.length > 5 && (
        <Button
          onClick={() => setShowAll(!showAll)}
          variant="outline"
          className="w-full mt-4 border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          {showAll ? "Show Top 5" : "View Full Ranking"}
          <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showAll ? "rotate-180" : ""}`} />
        </Button>
      )}
    </div>
  );
}
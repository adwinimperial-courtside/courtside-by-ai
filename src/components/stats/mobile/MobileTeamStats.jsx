import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";
import TeamLogo from "../../teams/TeamLogo";
import { buildTeamAggregates } from "../statEngine";

// MOBILE_TEAMSTATS_ENGINE_V1 — all calculations come from statEngine (single source of truth)
export default function MobileTeamStats({ teams, games, stats }) {
  const teamStatistics = React.useMemo(() => {
    return buildTeamAggregates({ teams, games, stats })
      .filter(t => t.gamesPlayed > 0)
      .map(t => ({
        ...t,
        gp: t.gamesPlayed,
        ppg: t.ppg.toFixed(1),
        rpg: t.rpg.toFixed(1),
        apg: t.apg.toFixed(1),
        orebpg: t.orebpg.toFixed(1),
        drebpg: t.drebpg.toFixed(1),
        stlpg: t.stlpg.toFixed(1),
        blkpg: t.blkpg.toFixed(1),
        topg: t.topg.toFixed(1),
      }))
      .sort((a, b) => parseFloat(b.ppg) - parseFloat(a.ppg));
  }, [teams, games, stats]);

  if (teamStatistics.length === 0) {
    return <p className="text-slate-500 text-center py-8">No team stats yet</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-4 h-4 text-purple-600" />
        <h2 className="text-base font-semibold text-slate-900">Team Statistics (Per Game)</h2>
      </div>
      {teamStatistics.map(team => (
        <Card key={team.id} className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <TeamLogo team={team} size="sm" />
              <div>
                <p className="font-bold text-slate-900 text-sm">{team.name}</p>
                <p className="text-xs text-slate-500">{team.gp} GP</p>
              </div>
            </div>
            <div className="mb-2">
              <span className="text-2xl font-extrabold text-purple-600">{team.ppg}</span>
              <span className="text-sm text-slate-500 ml-1">PTS</span>
            </div>
            <div className="flex gap-4 mb-3 text-sm">
              <span><span className="font-semibold text-slate-800">{team.rpg}</span> <span className="text-slate-500">REB</span></span>
              <span className="text-slate-300">•</span>
              <span><span className="font-semibold text-slate-800">{team.apg}</span> <span className="text-slate-500">AST</span></span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
              <span>OREB <span className="font-semibold text-slate-700">{team.orebpg}</span></span>
              <span>•</span>
              <span>DREB <span className="font-semibold text-slate-700">{team.drebpg}</span></span>
              <span>•</span>
              <span>STL <span className="font-semibold text-slate-700">{team.stlpg}</span></span>
              <span>•</span>
              <span>BLK <span className="font-semibold text-slate-700">{team.blkpg}</span></span>
              <span>•</span>
              <span>TO <span className="font-semibold text-slate-700">{team.topg}</span></span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
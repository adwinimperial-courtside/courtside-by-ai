import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";

function StatCard({ label, value }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-3 md:p-4 text-center">
        <p className="text-xl md:text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

export default function PlayerQuickStats({ stats }) {
  const computed = useMemo(() => {
    const gp = stats.length;
    if (gp === 0) return { gp: 0, ppg: "—", rpg: "—", apg: "—", spg: "—", bpg: "—" };

    let pts = 0, reb = 0, ast = 0, stl = 0, blk = 0;
    stats.forEach(s => {
      pts += (s.points_2 || 0) * 2 + (s.points_3 || 0) * 3 + (s.free_throws || 0);
      reb += (s.offensive_rebounds || 0) + (s.defensive_rebounds || 0);
      ast += s.assists || 0;
      stl += s.steals || 0;
      blk += s.blocks || 0;
    });

    const fmt = (n) => (n / gp).toFixed(1);
    return { gp, ppg: fmt(pts), rpg: fmt(reb), apg: fmt(ast), spg: fmt(stl), bpg: fmt(blk) };
  }, [stats]);

  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Season Stats</h3>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <StatCard label="PTS" value={computed.ppg} />
        <StatCard label="REB" value={computed.rpg} />
        <StatCard label="AST" value={computed.apg} />
        <StatCard label="STL" value={computed.spg} />
        <StatCard label="BLK" value={computed.bpg} />
        <StatCard label="GP" value={computed.gp} />
      </div>
    </div>
  );
}
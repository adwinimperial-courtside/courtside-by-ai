import React, { useMemo } from "react";
import { resolveSettings } from "@/utils/awardDefaults";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { computeMvpRace } from "./statEngine";
import PlayerAvatar from "@/components/shared/PlayerAvatar";

// TOP20_ENGINE_V1 — all calculations come from statEngine (single source of truth)
export default function AwardLeadersTop20({ league, teams, games, players, stats, awardSettings }) {
  const cfg = resolveSettings(awardSettings);

  const mvpCandidates = useMemo(
    () => computeMvpRace({ league, teams, games, players, stats, awardSettings, topN: 20 }),
    [league, teams, games, players, stats, awardSettings]
  );

  const rankBadge = (index) => {
    if (index === 0) return <Badge className="bg-yellow-500 text-white">MVP</Badge>;
    if (index < 5) return <Badge className="bg-purple-500 text-white">Mythical {index + 1}</Badge>;
    return null;
  };

  const rowBg = (index) => {
    if (index === 0) return "bg-yellow-50";
    if (index < 5) return "bg-purple-50/40";
    return "";
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Top 20 MVP Rankings — {league?.name}
        </CardTitle>
        <p className="text-sm text-slate-500">
          {mvpCandidates.length} eligible players · Same formula as Award Leaders · Min {cfg.mvp_min_games_percent}% games played
        </p>
      </CardHeader>
      <CardContent>
        {mvpCandidates.length === 0 ? (
          <p className="text-slate-500 text-center py-10">No eligible MVP candidates yet for this league.</p>
        ) : (
          <>
            {/* Mobile */}
            <div className="block md:hidden space-y-3">
              {mvpCandidates.map((c, index) => (
                <div key={c.playerId} className={`rounded-xl border p-4 ${rowBg(index)}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg font-black text-slate-400 w-7">#{index + 1}</span>
                    {/* PLAYER_AVATAR_V1 */}
                    <PlayerAvatar player={c.player} size={32} teamColor={c.team?.color || '#f97316'} />
                    <div className="flex-1 ml-2">
                      <div className="font-bold text-slate-900">{c.player.name}</div>
                      <div className="text-xs text-slate-500">{c.team.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-purple-600">{c.mvpScore}</div>
                      <div className="text-xs text-slate-400">MVP Score</div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-600 mt-2">
                    <span>GP: <strong>{c.gp}/{c.totalGames}</strong></span>
                    <span>Avg GIS: <strong>{c.avgGis}</strong></span>
                    <span>GP%: <strong>{c.gpPct}%</strong></span>
                  </div>
                  {rankBadge(index) && <div className="mt-2">{rankBadge(index)}</div>}
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">GP</TableHead>
                    <TableHead className="text-center">GP%</TableHead>
                    <TableHead className="text-center">Avg GIS</TableHead>
                    <TableHead className="text-center">MVP Score</TableHead>
                    <TableHead>Award</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mvpCandidates.map((c, index) => (
                    <TableRow key={c.playerId} className={rowBg(index)}>
                      <TableCell className="font-bold text-slate-500">{index + 1}</TableCell>
                      <TableCell className="font-semibold text-slate-900"><div className="flex items-center gap-2"><PlayerAvatar player={c.player} size={28} teamColor={c.team?.color || '#f97316'} /><span>{c.player.name}</span></div></TableCell>
                      <TableCell className="text-slate-600">{c.team.name}</TableCell>
                      <TableCell className="text-center">{c.gp}/{c.totalGames}</TableCell>
                      <TableCell className="text-center">{c.gpPct}%</TableCell>
                      <TableCell className="text-center">{c.avgGis}</TableCell>
                      <TableCell className="text-center font-bold text-purple-600 text-base">{c.mvpScore}</TableCell>
                      <TableCell>{rankBadge(index)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
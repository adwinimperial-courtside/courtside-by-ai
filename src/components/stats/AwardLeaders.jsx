import React, { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Shield } from "lucide-react";
import MobileAwardCards from "./MobileAwardCards";
import { computeMvpRace, computeDpoyRace } from "./statEngine";
import PlayerAvatar from "@/components/shared/PlayerAvatar";

// AWARDS_ENGINE_V1 — all calculations come from statEngine (single source of truth)
export default function AwardLeaders({ league, teams, games, players, stats, awardSettings }) {
  const mvpCandidates = useMemo(
    () => computeMvpRace({ league, teams, games, players, stats, awardSettings, topN: 10 }),
    [league, teams, games, players, stats, awardSettings]
  );

  const dpoyLeaders = useMemo(
    () => computeDpoyRace({ league, teams, games, players, stats, awardSettings, topN: 5 }),
    [league, teams, games, players, stats, awardSettings]
  );

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Season Awards
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="mvp" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mvp">MVP</TabsTrigger>
            <TabsTrigger value="dpoy">DPOY</TabsTrigger>
          </TabsList>

          <TabsContent value="mvp" className="space-y-4">
            {mvpCandidates.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No MVP candidates yet</p>
            ) : (
              <>
                {/* Mobile: Stacked Cards */}
                <div className="block md:hidden">
                  <MobileAwardCards candidates={mvpCandidates} awardType="mvp" />
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Rank</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-center">GP</TableHead>
                        <TableHead className="text-center">Avg GIS</TableHead>
                        <TableHead className="text-center">MVP Score</TableHead>
                        <TableHead>Award</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mvpCandidates.map((candidate, index) => (
                        <TableRow key={candidate.playerId} className={index === 0 ? "bg-yellow-50" : ""}>
                          <TableCell className="font-bold">{index + 1}</TableCell>
                          <TableCell className="font-medium"><div className="flex items-center gap-2">{/* PLAYER_AVATAR_V1 */}<PlayerAvatar player={candidate.player} size={28} teamColor={candidate.team?.color || '#f97316'} /><span>{candidate.player.name}</span></div></TableCell>
                          <TableCell>{candidate.team.name}</TableCell>
                          <TableCell className="text-center">{candidate.gp}</TableCell>
                          <TableCell className="text-center">{candidate.avgGis}</TableCell>
                          <TableCell className="text-center font-bold text-purple-600">{candidate.mvpScore}</TableCell>
                          <TableCell>
                            {index === 0 && <Badge className="bg-yellow-500">MVP</Badge>}
                            {index > 0 && index < 5 && <Badge className="bg-purple-500">Mythical {index}</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="space-y-2 text-sm text-slate-700">
                    <p className="font-semibold flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      Most Valuable Player (MVP)
                    </p>
                    <p>The MVP is awarded to the player with the highest overall impact across the season.</p>
                    <p className="font-medium mt-3">The MVP is calculated automatically based on:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>All-around performance (scoring, rebounds, assists, steals, and blocks)</li>
                      <li>Consistency (average impact per game, not just single big games)</li>
                      <li>Availability (games played during the season)</li>
                      <li>Team performance</li>
                      <li>Sportsmanship (technical and unsportsmanlike fouls reduce the score)</li>
                    </ul>
                    <p className="mt-3">To be eligible, a player must play in at least 60% of their team's completed games.</p>
                    <p>All calculations use only completed games and apply the same formula to every player.</p>
                    <p>There are no votes, opinions, or manual adjustments.</p>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="dpoy" className="space-y-4">
            {dpoyLeaders.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No DPOY candidates yet</p>
            ) : (
              <>
                {/* Mobile: Stacked Cards */}
                <div className="block md:hidden">
                  <MobileAwardCards candidates={dpoyLeaders} awardType="dpoy" />
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Rank</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-center">GP</TableHead>
                        <TableHead className="text-center">Avg DEF_GIS</TableHead>
                        <TableHead className="text-center">DPOY Score</TableHead>
                        <TableHead className="text-center">Award</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dpoyLeaders.map((leader, index) => (
                        <TableRow key={leader.playerId} className={index === 0 ? "bg-blue-50" : ""}>
                          <TableCell className="font-bold">{index + 1}</TableCell>
                          <TableCell className="font-medium"><div className="flex items-center gap-2"><PlayerAvatar player={leader.player} size={28} teamColor={leader.team?.color || '#f97316'} /><span>{leader.player.name}</span></div></TableCell>
                          <TableCell>{leader.team.name}</TableCell>
                          <TableCell className="text-center">{leader.gp}</TableCell>
                          <TableCell className="text-center">{leader.avgDefGis}</TableCell>
                          <TableCell className="text-center font-bold text-blue-600">{leader.dpoyScore}</TableCell>
                          <TableCell className="text-center">{index === 0 ? <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">DPOY</span> : "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="space-y-2 text-sm text-slate-700">
                    <p className="font-semibold flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      Defensive Player of the Year (DPOY)
                    </p>
                    <p>The Defensive Player of the Year recognizes the player with the strongest defensive impact across the season.</p>
                    <p className="font-medium mt-3">The DPOY is calculated based on:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Defensive actions (steals, blocks, and rebounds)</li>
                      <li>Defensive discipline (fewer fouls and technicals score higher)</li>
                      <li>Consistency and availability throughout the season</li>
                      <li>Scoring points is not included in the DPOY calculation, making the award fair for all positions</li>
                    </ul>
                    <p className="mt-3">To be eligible, a player must play in at least 60% of their team's completed games.</p>
                    <p>The award is fully data-driven and updates automatically as game stats are recorded.</p>
                    <p className="font-semibold mt-3">⚖️ Fair &amp; Transparent</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Same rules for all players</li>
                      <li>Same formula for the entire season</li>
                      <li>No popularity or reputation bias</li>
                      <li>No manual overrides</li>
                    </ul>
                    <p className="mt-3">Awards are earned on the court and backed by data.</p>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
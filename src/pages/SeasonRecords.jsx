// SEASON_RECORDS_V1 — best single-game performance per category for one league season.
// Reads the shared league data hook (paged, truncation-proof) and the stat engine
// (format-aware points, duplicate-row merging, game eligibility). No new stat math.
import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, Filter, Info } from "lucide-react";
import { useLeagueStatsData } from "@/components/stats/useLeagueStatsData";
import {
  isGameEligible,
  buildGameFormatMap,
  calcPoints,
  groupStatsByGameAndPlayer,
} from "@/components/stats/statEngine";
import HelpButton from "../components/help/HelpButton";

// SEASON_RECORDS_V1 — the seven categories, in display order.
const CATEGORIES = [
  { key: "points", label: "Points" },
  { key: "rebounds", label: "Rebounds" },
  { key: "assists", label: "Assists" },
  { key: "steals", label: "Steals" },
  { key: "blocks", label: "Blocks" },
  { key: "threes", label: "3-Pointers Made" },
  { key: "free_throws", label: "Free Throws Made" },
];

const initialsOf = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatGameDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export default function SeasonRecordsPage() {
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        if (user?.default_league_id) {
          setSelectedLeague(user.default_league_id);
        } else if (user?.assigned_league_ids?.length === 1) {
          setSelectedLeague(user.assigned_league_ids[0]);
        } else {
          setSelectedLeague("all");
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };
    fetchUser();
  }, []);

  const { data: leagues } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => base44.entities.League.list('-created_date', 200),
    initialData: [],
  });

  const isAppAdmin = currentUser?.user_type === 'app_admin';
  const assignedLeagueIds = currentUser?.assigned_league_ids || [];
  const hasAssignedLeagues = assignedLeagueIds.length > 0;
  const visibleLeagues = isAppAdmin
    ? leagues
    : hasAssignedLeagues
      ? leagues.filter(league => assignedLeagueIds.includes(league.id))
      : (currentUser?.user_type === 'league_admin' ? [] : leagues);

  const { teams, players, games, stats, isLoading } = useLeagueStatsData(selectedLeague);

  // SEASON_RECORDS_V1 — one pass over every eligible game's merged stat lines.
  const { records, eligibleGameCount } = useMemo(() => {
    const empty = { records: {}, eligibleGameCount: 0 };
    if (!games || games.length === 0) return empty;

    // Format map is built from the UNFILTERED rows — duplicates included — so each
    // game's stored final score reconciles correctly.
    const formatMap = buildGameFormatMap(games, stats);

    const gameById = new Map();
    const eligible = [];
    games.forEach((g) => {
      gameById.set(g.id, g);
      if (isGameEligible(g, "player_stats")) eligible.push(g);
    });
    if (eligible.length === 0) return empty;

    const playerById = new Map((players || []).map((p) => [p.id, p]));
    const teamById = new Map((teams || []).map((t) => [t.id, t]));

    // Merges any duplicate PlayerStats rows into one line per player per game.
    const byGame = groupStatsByGameAndPlayer(stats);

    const best = {};
    CATEGORIES.forEach((c) => { best[c.key] = { value: 0, holders: [] }; });

    eligible.forEach((game) => {
      const lines = byGame.get(game.id);
      if (!lines) return;
      const format = formatMap.get(game.id);

      lines.forEach((row) => {
        const player = playerById.get(row.player_id);
        if (!player) return;

        const team = teamById.get(row.team_id);
        const opponentId = row.team_id === game.home_team_id ? game.away_team_id : game.home_team_id;
        const opponent = teamById.get(opponentId);

        const values = {
          points: calcPoints(row, game, format),
          rebounds: (row.offensive_rebounds || 0) + (row.defensive_rebounds || 0),
          assists: row.assists || 0,
          steals: row.steals || 0,
          blocks: row.blocks || 0,
          threes: row.points_3 || 0,
          free_throws: row.free_throws || 0,
        };

        CATEGORIES.forEach((c) => {
          const v = values[c.key];
          if (!v || v <= 0) return;
          const slot = best[c.key];
          if (v > slot.value) {
            slot.value = v;
            slot.holders = [];
          }
          if (v === slot.value) {
            slot.holders.push({
              key: `${game.id}-${row.player_id}`,
              playerName: player.name || "Unknown player",
              teamName: team?.name || "",
              opponentName: opponent?.name || "",
              gameDate: formatGameDate(game.game_date),
            });
          }
        });
      });
    });

    return { records: best, eligibleGameCount: eligible.length };
  }, [games, stats, players, teams]);

  const leagueChosen = !!selectedLeague && selectedLeague !== "all";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Season Records</h1>
              <HelpButton pageKey="seasonrecords" />
            </div>
          </div>
          <p className="text-slate-600 ml-15">The biggest single-game performances of the season</p>
        </div>

        {/* League filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-slate-900">Select League</h2>
          </div>
          <div className="max-w-md">
            <Select value={selectedLeague} onValueChange={setSelectedLeague}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select league" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leagues</SelectItem>
                {[...visibleLeagues].sort((a, b) => a.name.localeCompare(b.name)).map(league => (
                  <SelectItem key={league.id} value={league.id}>
                    {league.name} ({league.season})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!leagueChosen ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <p className="text-slate-500 text-center">Please select a league to view season records</p>
          </div>
        ) : isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <p className="text-slate-500 text-center">Loading season records…</p>
          </div>
        ) : eligibleGameCount === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <p className="text-slate-500 text-center">
              No completed games yet in this league. Records appear once games are played.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 bg-slate-100 rounded-xl px-4 py-3 mb-6">
              <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-600">
                From {eligibleGameCount} completed {eligibleGameCount === 1 ? "game" : "games"}.
                Forfeits and default results are not counted.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {CATEGORIES.map((cat) => {
                const rec = records[cat.key] || { value: 0, holders: [] };
                const holders = rec.holders.slice(0, 3);
                const extra = rec.holders.length - holders.length;
                const hasRecord = rec.value > 0 && holders.length > 0;

                return (
                  <div
                    key={cat.key}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col"
                  >
                    <p className="text-sm font-medium text-slate-500 mb-1">{cat.label}</p>
                    <p className="text-4xl font-bold text-slate-900 leading-none mb-4">
                      {hasRecord ? rec.value : "—"}
                    </p>

                    {!hasRecord ? (
                      <p className="text-sm text-slate-400">Not recorded yet</p>
                    ) : (
                      <>
                        <div className="space-y-3 flex-1">
                          {holders.map((h) => (
                            <div key={h.key} className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {initialsOf(h.playerName)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">{h.playerName}</p>
                                <p className="text-xs text-slate-500 truncate">
                                  {h.teamName}
                                  {holders.length > 1 && h.opponentName ? ` · vs ${h.opponentName}` : ""}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
                          {holders.length === 1
                            ? [
                                holders[0].opponentName ? `vs ${holders[0].opponentName}` : "",
                                holders[0].gameDate,
                              ].filter(Boolean).join(" · ")
                            : `${rec.holders.length} players share this record${extra > 0 ? ` (${extra} not shown)` : ""}`}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
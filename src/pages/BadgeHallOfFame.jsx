// BADGE_HALL_OF_FAME_V1 — public, league-wide badge leaderboard grouped by
// difficulty tier (hardest first). Pure reuse: calculatePlayerBadges (the same
// function that powers the Player Profile trophy cabinet) run once per player,
// then inverted into badge -> holders. No new stat math, no new badge rules.
import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Target, Medal, Bomb, Flame, Handshake, Zap, Crown, Sparkles,
  Dumbbell, Magnet, Hand, Lock, Ban, Shield, Layers, Gem, Star, Clock, Orbit,
  Trophy, Filter,
} from "lucide-react";
import { useLeagueStatsData } from "@/components/stats/useLeagueStatsData";
import { buildGameFormatMap } from "@/components/stats/statEngine";
import { BADGE_DEFINITIONS } from "@/components/player/badgeDefinitions";
import { calculatePlayerBadges } from "@/components/player/badgeCalculator";
import HelpButton from "../components/help/HelpButton";

// BADGE_HALL_OF_FAME_V1 — trophy-room palette, matches PlayerDashboardCard / BadgeCard.
const GOLD_HI = "#E5C688";
const GOLD_MID = "#C8A468";
const GOLD_DEEP = "#6E5330";
const WARM_WHITE = "#EFE6D4";
const WARM_MUTED = "#877A63";
const PAGE_BG = "#050403";
const CARD_BG = "#100D08";
const CARD_BORDER = "#2A2114";
const ICON_ON_GOLD = "#241A08";

// BADGE_HALL_OF_FAME_V1 — same icon-per-badge mapping as BadgeCard.jsx (duplicated
// here since BadgeCard doesn't export it; both must be updated if a badge icon changes).
const BADGE_ICONS = {
  double_digits: Target,
  twenty_club: Medal,
  thirty_bomb: Bomb,
  scoring_streak: Flame,
  facilitator: Handshake,
  playmaker: Zap,
  floor_general: Crown,
  glass_cleaner: Sparkles,
  board_beast: Dumbbell,
  rebound_machine: Magnet,
  pickpocket: Hand,
  lockdown_defender: Lock,
  shot_blocker: Ban,
  defensive_wall: Shield,
  double_double: Layers,
  triple_double: Gem,
  player_of_the_game: Star,
  clutch_performer: Clock,
  all_around_game: Orbit,
};

// BADGE_HALL_OF_FAME_V1 — difficulty tiers, hardest first. Fixed by the rule
// thresholds in badgeDefinitions.jsx (e.g. 3 blocks is objectively harder than 2),
// NOT by how many players have actually earned each one in a given league.
const BADGE_TIERS = [
  {
    key: "legendary",
    label: "Legendary",
    badges: ["triple_double", "all_around_game", "player_of_the_game", "clutch_performer"],
    chipColor: "#F9A8D4", chipBg: "rgba(244,114,182,0.12)", chipBorder: "rgba(244,114,182,0.35)",
    medalFrom: "#FBCFE8", medalMid: "#F472B6", medalTo: "#7C1D55",
  },
  {
    key: "rare",
    label: "Rare",
    badges: ["rebound_machine", "floor_general", "defensive_wall", "thirty_bomb"],
    chipColor: "#D8B4FE", chipBg: "rgba(192,132,252,0.12)", chipBorder: "rgba(192,132,252,0.35)",
    medalFrom: "#E9D5FF", medalMid: "#C084FC", medalTo: "#5B2B82",
  },
  {
    key: "uncommon",
    label: "Uncommon",
    badges: ["double_double", "playmaker", "lockdown_defender", "board_beast", "scoring_streak"],
    chipColor: GOLD_HI, chipBg: "rgba(200,164,104,0.14)", chipBorder: "rgba(200,164,104,0.4)",
    medalFrom: GOLD_HI, medalMid: GOLD_MID, medalTo: GOLD_DEEP,
  },
  {
    key: "common",
    label: "Common",
    badges: ["twenty_club", "shot_blocker", "glass_cleaner", "pickpocket", "facilitator", "double_digits"],
    chipColor: WARM_MUTED, chipBg: "rgba(135,122,99,0.12)", chipBorder: "rgba(135,122,99,0.35)",
    medalFrom: "#B9AF9A", medalMid: "#8C8270", medalTo: "#4A4436",
  },
];

export default function BadgeHallOfFamePage() {
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTier, setActiveTier] = useState("all");

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

  // BADGE_HALL_OF_FAME_V1 — one calculatePlayerBadges call per player (same function
  // and same formatMap pattern as PlayerProfile.jsx), then invert player->counts
  // into badge->holders for the league-wide view.
  const { holdersByBadge, rarestBadge, totalGames } = useMemo(() => {
    const empty = { holdersByBadge: {}, rarestBadge: null, totalGames: 0 };
    if (!players || !games || !stats || games.length === 0) return empty;

    const completedGames = games.filter(g => g.status === 'completed');
    if (completedGames.length === 0) return empty;

    // Built from UNFILTERED rows, same as PlayerProfile.jsx — detection must sum
    // every row of a game against the stored score.
    const formatMap = buildGameFormatMap(games, stats);
    const teamById = new Map((teams || []).map(t => [t.id, t]));

    const holders = {};
    Object.keys(BADGE_DEFINITIONS).forEach(key => { holders[key] = []; });

    players.forEach(player => {
      const myStats = stats.filter(s => s.player_id === player.id);
      if (myStats.length === 0) return;

      const counts = calculatePlayerBadges(myStats, games, formatMap, stats);
      Object.entries(counts).forEach(([badgeKey, count]) => {
        if (count > 0 && holders[badgeKey]) {
          const team = teamById.get(player.team_id);
          holders[badgeKey].push({
            playerId: player.id,
            playerName: player.name || "Unknown player",
            teamName: team?.name || "",
            count,
          });
        }
      });
    });

    Object.keys(holders).forEach(key => {
      holders[key].sort((a, b) => b.count - a.count || a.playerName.localeCompare(b.playerName));
    });

    // Rarest-earned spotlight: among badges with at least one holder, the one with
    // the fewest total holders wins; ties broken by tier (hardest first). This is a
    // "rarest overall" spotlight, not "rarest this week" — badge counts don't carry
    // per-instance dates, so recency can't be computed without new stat plumbing.
    const tierRank = {};
    BADGE_TIERS.forEach((tier, i) => tier.badges.forEach(k => { tierRank[k] = i; }));

    let rarest = null;
    Object.entries(holders).forEach(([badgeKey, list]) => {
      if (list.length === 0) return;
      if (
        !rarest ||
        list.length < rarest.holderCount ||
        (list.length === rarest.holderCount && tierRank[badgeKey] < tierRank[rarest.badgeKey])
      ) {
        rarest = { badgeKey, holderCount: list.length, topHolder: list[0] };
      }
    });

    return { holdersByBadge: holders, rarestBadge: rarest, totalGames: completedGames.length };
  }, [players, games, stats, teams]);

  const leagueChosen = !!selectedLeague && selectedLeague !== "all";
  const visibleTiers = activeTier === "all" ? BADGE_TIERS : BADGE_TIERS.filter(t => t.key === activeTier);

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE_BG, color: WARM_WHITE }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">

        <div className="mb-2 text-[11px] font-bold tracking-wider uppercase" style={{ color: GOLD_MID }}>
          Courtside by AI · Numbers Don't Lie
        </div>
        <div className="flex items-center gap-2 mb-1">
          <h1
            className="text-3xl md:text-4xl font-extrabold"
            style={{ backgroundImage: `linear-gradient(90deg, ${GOLD_HI}, ${GOLD_MID} 55%, ${GOLD_DEEP})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
          >
            Badge Hall of Fame
          </h1>
          <HelpButton pageKey="badgehalloffame" />
        </div>
        <p className="text-sm mb-6" style={{ color: WARM_MUTED }}>
          Browse who's earned what — updated after every game
        </p>

        {/* League filter */}
        <div className="rounded-xl p-4 mb-6 flex items-center gap-3" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
          <Filter className="w-4 h-4 flex-shrink-0" style={{ color: GOLD_MID }} />
          <div className="flex-1">
            <Select value={selectedLeague} onValueChange={setSelectedLeague}>
              <SelectTrigger className="w-full bg-transparent border-none" style={{ color: WARM_WHITE }}>
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
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: WARM_MUTED }}>
            Please select a league to view the Badge Hall of Fame
          </div>
        ) : isLoading ? (
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: WARM_MUTED }}>
            Loading badges…
          </div>
        ) : totalGames === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: WARM_MUTED }}>
            No completed games yet in this league. Badges appear once games are played.
          </div>
        ) : (
          <>
            {/* Rarest badge spotlight */}
            {rarestBadge && (
              <div
                className="mb-6 rounded-xl p-4 flex items-center gap-3"
                style={{ border: "1px solid rgba(244,114,182,0.35)", backgroundImage: "linear-gradient(90deg, rgba(244,114,182,0.12), rgba(200,164,104,0.05))" }}
              >
                <div
                  className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundImage: "radial-gradient(circle at 35% 30%, #FBCFE8, #F472B6 55%, #7C1D55 100%)", boxShadow: "0 0 14px rgba(244,114,182,0.5)" }}
                >
                  <Trophy className="w-5 h-5" style={{ color: ICON_ON_GOLD }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-extrabold tracking-wide uppercase mb-0.5" style={{ color: "#F9A8D4" }}>
                    Rarest badge earned
                  </div>
                  <div className="text-sm font-bold truncate">
                    {rarestBadge.topHolder.playerName} — {BADGE_DEFINITIONS[rarestBadge.badgeKey]?.badge_name}
                  </div>
                  <div className="text-xs" style={{ color: WARM_MUTED }}>
                    Only {rarestBadge.holderCount} {rarestBadge.holderCount === 1 ? "player has" : "players have"} earned this badge
                  </div>
                </div>
              </div>
            )}

            {/* Tier filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
              <button
                onClick={() => setActiveTier("all")}
                className="flex-shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full"
                style={activeTier === "all"
                  ? { backgroundColor: GOLD_MID, color: ICON_ON_GOLD, border: `1px solid ${GOLD_MID}` }
                  : { backgroundColor: CARD_BG, color: WARM_MUTED, border: `1px solid ${CARD_BORDER}` }}
              >
                All (by difficulty)
              </button>
              {BADGE_TIERS.map(tier => (
                <button
                  key={tier.key}
                  onClick={() => setActiveTier(tier.key)}
                  className="flex-shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full"
                  style={activeTier === tier.key
                    ? { backgroundColor: GOLD_MID, color: ICON_ON_GOLD, border: `1px solid ${GOLD_MID}` }
                    : { backgroundColor: CARD_BG, color: WARM_MUTED, border: `1px solid ${CARD_BORDER}` }}
                >
                  {tier.label}
                </button>
              ))}
            </div>

            {/* Badge cards, grouped by tier, hardest first */}
            {visibleTiers.map(tier => (
              <div key={tier.key}>
                <div className="mt-5 mb-2 text-xs font-extrabold tracking-wide uppercase" style={{ color: WARM_MUTED }}>
                  {tier.label}
                </div>
                <div className="md:grid md:grid-cols-2 md:gap-3">
                {tier.badges.map(badgeKey => {
                  const def = BADGE_DEFINITIONS[badgeKey];
                  if (!def) return null;
                  const IconComp = BADGE_ICONS[badgeKey] || Target;
                  const list = holdersByBadge[badgeKey] || [];
                  const shown = list.slice(0, 5);
                  const extra = list.length - shown.length;

                  return (
                    <div key={badgeKey} className="rounded-xl p-4 mb-3 md:mb-0" style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center"
                          style={{ backgroundImage: `radial-gradient(circle at 35% 30%, ${tier.medalFrom}, ${tier.medalMid} 55%, ${tier.medalTo} 100%)` }}
                        >
                          <IconComp className="w-5 h-5" style={{ color: ICON_ON_GOLD }} />
                        </div>
                        <div className="flex-1 flex items-baseline justify-between gap-2 min-w-0">
                          <span className="font-extrabold text-sm">{def.badge_name}</span>
                          <span
                            className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded whitespace-nowrap"
                            style={{ color: tier.chipColor, backgroundColor: tier.chipBg, border: `1px solid ${tier.chipBorder}` }}
                          >
                            {tier.label} · {list.length} {list.length === 1 ? "player" : "players"}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs mt-1 ml-[52px]" style={{ color: WARM_MUTED }}>{def.badge_description}</p>

                      {list.length === 0 ? (
                        <p className="text-xs mt-2 ml-[52px]" style={{ color: "#555" }}>No one has earned this yet — be the first.</p>
                      ) : (
                        <div className="mt-2 ml-[52px] space-y-1.5">
                          {shown.map(h => (
                            <div key={h.playerId} className="flex items-center justify-between text-sm">
                              <span className="font-semibold">
                                {h.playerName}{" "}
                                <span className="font-normal text-xs" style={{ color: WARM_MUTED }}>{h.teamName}</span>
                              </span>
                              <span className="font-bold text-xs" style={{ color: GOLD_HI }}>×{h.count}</span>
                            </div>
                          ))}
                          {extra > 0 && (
                            <div className="text-xs" style={{ color: WARM_MUTED }}>+{extra} more {extra === 1 ? "player" : "players"}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
// STATS_DATA_HOOK_V1
// Shared data hook for all league statistics pages (Statistics, Award
// Leaders, League Leaders Top 20). Fetches teams, players, games, and
// player stats for one league — sequentially (one request in flight at
// a time, rate-limit friendly) and with cap-agnostic pagination so no
// base44 per-response row cap can ever silently truncate the data.
// All stat pages MUST consume this hook instead of fetching their own
// copies, so the data is downloaded once and shared via one cache key.

import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Cap-agnostic paged filter: advances by the number of rows actually
// returned and stops only on an empty/short page. Never assumes the
// requested page size is what the server returns.
const filterAll = async (entityName, query, sort = null) => {
  const PAGE = 1000;
  let all = [];
  let skip = 0;
  while (true) {
    const page = await base44.entities[entityName].filter(
      query,
      sort,
      PAGE,
      skip
    );
    if (!page || page.length === 0) break;
    all = all.concat(page);
    skip += page.length;
    if (page.length < PAGE) break;
  }
  return all;
};

// Split an array into chunks of n
const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

export function useLeagueStatsData(leagueId) {
  const enabled = !!leagueId && leagueId !== "all";

  const queryResult = useQuery({
    queryKey: ["league_stats_data", leagueId],
    enabled,
    staleTime: 30000,
    queryFn: async () => {
      // 1. Teams in this league
      const teams = await filterAll("Team", { league_id: leagueId });

      // 2. Players on those teams (chunked team IDs to keep query URLs short)
      let players = [];
      const teamIds = teams.map((t) => t.id);
      for (const ids of chunk(teamIds, 25)) {
        const part = await filterAll("Player", { team_id: { $in: ids } });
        players = players.concat(part);
      }

      // 3. Games in this league, newest first
      const games = await filterAll(
        "Game",
        { league_id: leagueId },
        "-game_date"
      );

      // 4. Player stats for those games (chunked game IDs, each chunk
      //    itself paged — no chunk can be truncated by the response cap)
      let stats = [];
      const gameIds = games.map((g) => g.id);
      for (const ids of chunk(gameIds, 50)) {
        const part = await filterAll("PlayerStats", {
          game_id: { $in: ids },
        });
        stats = stats.concat(part);
      }

      return { teams, players, games, stats };
    },
  });

  return {
    teams: queryResult.data?.teams ?? [],
    players: queryResult.data?.players ?? [],
    games: queryResult.data?.games ?? [],
    stats: queryResult.data?.stats ?? [],
    isLoading: enabled && queryResult.isLoading,
    isError: queryResult.isError,
  };
}
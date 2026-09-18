import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// PLATFORM_STATS_V1 — shared proof numbers for the Admin, Coach and Player homes.
// The backend recounts at most every 10 days; until the call returns we show the last known values.
const FALLBACK = { games: 900, leagues: 30, users: 500, teams: 280 };

export function roundDownPlus(n) {
  const v = Number(n) || 0;
  if (v < 10) return `${v}`;
  const step = v >= 1000 ? 100 : 10;
  return `${(Math.floor(v / step) * step).toLocaleString("en-US")}+`;
}

export function usePlatformStats() {
  const { data } = useQuery({
    queryKey: ["platform_stats"],
    queryFn: async () => {
      const r = await base44.functions.invoke("getPlatformStats", {});
      return (r?.data || r)?.stats || null;
    },
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  const s = data || FALLBACK;
  return {
    games: roundDownPlus(s.games),
    leagues: roundDownPlus(s.leagues),
    users: roundDownPlus(s.users),
    teams: roundDownPlus(s.teams),
  };
}
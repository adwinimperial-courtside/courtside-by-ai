// STAT_ENGINE_V1 — single source of truth for all statistics calculations.
// Every stats surface (Statistics page, Award Leaders, Top 20, mobile views)
// must import from this file instead of defining its own formulas.
// Pure functions only — no React, no data fetching.

import { resolveSettings } from "@/utils/awardDefaults";

// ---------------------------------------------------------------------------
// Game eligibility — ONE rule, with explicit purposes.
// 'player_stats' → leader boards, player/team stat tables
// 'awards'       → MVP / DPOY / Mythical 5
// The two exclusion flags are independent: exclude_from_awards does NOT hide
// a game from stat boards, and exclude_from_player_stats does NOT hide it
// from awards.
// ---------------------------------------------------------------------------
export function isGameEligible(game, purpose) {
  if (!game) return false;
  if (game.status !== "completed") return false;
  if (game.is_default_result) return false;
  if (game.result_type === "default") return false;
  if (purpose === "player_stats" && game.exclude_from_player_stats) return false;
  if (purpose === "awards" && game.exclude_from_awards) return false;
  return true;
}

export function eligibleGameIds(games, purpose) {
  return new Set((games || []).filter((g) => isGameEligible(g, purpose)).map((g) => g.id));
}

// ---------------------------------------------------------------------------
// Points — digital-entry aware.
// Digital, unedited games store points_2 as a COUNT of made 2-pointers (×2).
// Manual / CSV / edited games store points_2 as raw 2-point POINTS (×1).
// ---------------------------------------------------------------------------
export function calcPoints(stat, game) {
  const isDigital = game && game.entry_type === "digital" && !game.edited;
  const two = isDigital ? (stat.points_2 || 0) * 2 : (stat.points_2 || 0);
  return two + (stat.points_3 || 0) * 3 + (stat.free_throws || 0);
}

// ---------------------------------------------------------------------------
// Participation — did this stat line represent real playing time?
// ---------------------------------------------------------------------------
export function didPlayerParticipate(stat) {
  if (!stat) return false;
  if (stat.did_play) return true;
  if ((stat.minutes_played || 0) > 0) return true;
  const hasStats =
    (stat.points_2 || 0) + (stat.points_3 || 0) + (stat.free_throws || 0) +
    (stat.assists || 0) + (stat.steals || 0) + (stat.blocks || 0) +
    (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0) +
    (stat.turnovers || 0) + (stat.fouls || 0) +
    (stat.technical_fouls || 0) + (stat.unsportsmanlike_fouls || 0) > 0;
  return hasStats;
}

// ---------------------------------------------------------------------------
// Duplicate-row safety. Substitution-era bugs left some players with more
// than one PlayerStats row in a game. Stats are SPLIT across those rows, so
// summing rows is correct for totals — but each game must count as ONE game
// played. This groups rows into one merged line per player per game.
// Returns: Map(gameId → Map(playerId → mergedTotals))
// ---------------------------------------------------------------------------
const SUM_FIELDS = [
  "points_2", "points_3", "free_throws", "offensive_rebounds",
  "defensive_rebounds", "assists", "steals", "blocks", "turnovers",
  "fouls", "technical_fouls", "unsportsmanlike_fouls", "minutes_played",
];

export function groupStatsByGameAndPlayer(stats) {
  const byGame = new Map();
  (stats || []).forEach((stat) => {
    if (!didPlayerParticipate(stat)) return;
    let gameMap = byGame.get(stat.game_id);
    if (!gameMap) { gameMap = new Map(); byGame.set(stat.game_id, gameMap); }
    let merged = gameMap.get(stat.player_id);
    if (!merged) {
      merged = { player_id: stat.player_id, team_id: stat.team_id, game_id: stat.game_id, did_play: true };
      SUM_FIELDS.forEach((f) => { merged[f] = 0; });
      gameMap.set(stat.player_id, merged);
    }
    SUM_FIELDS.forEach((f) => { merged[f] += stat[f] || 0; });
  });
  return byGame;
}

// ---------------------------------------------------------------------------
// Team game counts — denominator for GP%, per purpose.
// ---------------------------------------------------------------------------
export function countTeamGames(games, purpose) {
  const counts = {};
  (games || []).forEach((g) => {
    if (!isGameEligible(g, purpose)) return;
    counts[g.home_team_id] = (counts[g.home_team_id] || 0) + 1;
    counts[g.away_team_id] = (counts[g.away_team_id] || 0) + 1;
  });
  return counts;
}

// ---------------------------------------------------------------------------
// Player season aggregates — powers Player Stats tables and League Leaders.
// GP = number of DISTINCT eligible games the player participated in
// (duplicate rows merge into one game), capped by the team's game count.
// Returns one object per player with totals and per-game averages as NUMBERS
// (display components handle .toFixed()).
// ---------------------------------------------------------------------------
export function buildPlayerAggregates({ players, teams, games, stats }) {
  const purpose = "player_stats";
  const gameById = new Map((games || []).map((g) => [g.id, g]));
  const validIds = eligibleGameIds(games, purpose);
  const teamGameCounts = countTeamGames(games, purpose);
  const byGame = groupStatsByGameAndPlayer(
    (stats || []).filter((s) => validIds.has(s.game_id))
  );

  // Re-index: playerId → array of merged per-game lines
  const perPlayer = new Map();
  byGame.forEach((gameMap, gameId) => {
    gameMap.forEach((line, playerId) => {
      if (!perPlayer.has(playerId)) perPlayer.set(playerId, []);
      perPlayer.get(playerId).push({ line, game: gameById.get(gameId) });
    });
  });

  return (players || []).map((player) => {
    const entries = perPlayer.get(player.id) || [];
    const team = (teams || []).find((t) => t.id === player.team_id);
    const teamMaxGames = teamGameCounts[player.team_id] || 0;
    const gp = Math.min(entries.length, teamMaxGames || entries.length);

    const t = {
      points: 0, points_2: 0, points_3: 0, freeThrows: 0,
      offensiveRebounds: 0, defensiveRebounds: 0, rebounds: 0,
      assists: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0,
    };
    entries.forEach(({ line, game }) => {
      t.points += calcPoints(line, game);
      t.points_2 += line.points_2;
      t.points_3 += line.points_3;
      t.freeThrows += line.free_throws;
      t.offensiveRebounds += line.offensive_rebounds;
      t.defensiveRebounds += line.defensive_rebounds;
      t.rebounds += line.offensive_rebounds + line.defensive_rebounds;
      t.assists += line.assists;
      t.steals += line.steals;
      t.blocks += line.blocks;
      t.turnovers += line.turnovers;
      t.fouls += line.fouls;
    });

    const avg = (x) => (gp > 0 ? x / gp : 0);
    return {
      ...player,
      team,
      totals: t,
      gamesPlayed: gp,
      teamGames: teamMaxGames,
      ppg: avg(t.points),
      twopm: avg(t.points_2),
      threepm: avg(t.points_3),
      ftm: avg(t.freeThrows),
      orebpg: avg(t.offensiveRebounds),
      drebpg: avg(t.defensiveRebounds),
      rpg: avg(t.rebounds),
      apg: avg(t.assists),
      spg: avg(t.steals),
      bpg: avg(t.blocks),
      tpg: avg(t.turnovers),
      fpg: avg(t.fouls),
    };
  });
}

// Minimum share of team games to appear on leader boards (40%).
export const LEADER_MIN_GP_PCT = 0.4;

export function buildLeaderBoards({ players, teams, games, stats, topN = 5 }) {
  const aggregates = buildPlayerAggregates({ players, teams, games, stats }).filter(
    (p) => p.teamGames > 0 && p.gamesPlayed / p.teamGames >= LEADER_MIN_GP_PCT
  );
  const top = (key) => [...aggregates].sort((a, b) => b[key] - a[key]).slice(0, topN);
  return {
    points: top("ppg"),
    threes: top("threepm"),
    rebounds: top("rpg"),
    assists: top("apg"),
    steals: top("spg"),
    blocks: top("bpg"),
  };
}

// ---------------------------------------------------------------------------
// Team season aggregates — eligible games only, on BOTH sides of the average:
// GP counts eligible games, and totals only include stats from those games.
// ---------------------------------------------------------------------------
export function buildTeamAggregates({ teams, games, stats }) {
  const purpose = "player_stats";
  const gameById = new Map((games || []).map((g) => [g.id, g]));
  const validIds = eligibleGameIds(games, purpose);

  return (teams || []).map((team) => {
    const gamesPlayed = (games || []).filter(
      (g) => isGameEligible(g, purpose) && (g.home_team_id === team.id || g.away_team_id === team.id)
    ).length;

    const teamStats = (stats || []).filter(
      (s) => s.team_id === team.id && validIds.has(s.game_id)
    );

    const t = {
      points: 0, offensiveRebounds: 0, defensiveRebounds: 0, rebounds: 0,
      assists: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0,
    };
    teamStats.forEach((stat) => {
      t.points += calcPoints(stat, gameById.get(stat.game_id));
      t.offensiveRebounds += stat.offensive_rebounds || 0;
      t.defensiveRebounds += stat.defensive_rebounds || 0;
      t.rebounds += (stat.offensive_rebounds || 0) + (stat.defensive_rebounds || 0);
      t.assists += stat.assists || 0;
      t.steals += stat.steals || 0;
      t.blocks += stat.blocks || 0;
      t.turnovers += stat.turnovers || 0;
      t.fouls += stat.fouls || 0;
    });

    const avg = (x) => (gamesPlayed > 0 ? x / gamesPlayed : 0);
    return {
      ...team,
      gamesPlayed,
      totals: t,
      ppg: avg(t.points),
      rpg: avg(t.rebounds),
      apg: avg(t.assists),
      orebpg: avg(t.offensiveRebounds),
      drebpg: avg(t.defensiveRebounds),
      stlpg: avg(t.steals),
      blkpg: avg(t.blocks),
      topg: avg(t.turnovers),
    };
  });
}

// ---------------------------------------------------------------------------
// MVP race — one implementation for BOTH the Award Leaders page (top 10) and
// the Top 20 page. Duplicate rows are merged per game before scoring, so a
// player's GP and Avg GIS are identical everywhere.
// ---------------------------------------------------------------------------
export function computeMvpRace({ league, teams, games, players, stats, awardSettings, topN = 10 }) {
  const cfg = resolveSettings(awardSettings);
  if (!league || !teams || !games || !players || !stats) return [];

  const purpose = "awards";
  const leagueTeamIds = new Set(teams.filter((t) => t.league_id === league.id).map((t) => t.id));
  const leagueGames = games.filter(
    (g) =>
      (leagueTeamIds.has(g.home_team_id) || leagueTeamIds.has(g.away_team_id)) &&
      isGameEligible(g, purpose)
  );
  if (leagueGames.length === 0) return [];

  // Team win% and game counts from eligible games only
  const teamStats = {};
  leagueTeamIds.forEach((teamId) => {
    const tg = leagueGames.filter((g) => g.home_team_id === teamId || g.away_team_id === teamId);
    const wins = tg.filter((g) =>
      g.home_team_id === teamId ? g.home_score > g.away_score : g.away_score > g.home_score
    ).length;
    teamStats[teamId] = {
      gamesPlayed: tg.length,
      wins,
      winPct: tg.length > 0 ? wins / tg.length : 0,
    };
  });

  const byGame = groupStatsByGameAndPlayer(
    stats.filter((s) => leagueGames.some((g) => g.id === s.game_id))
  );
  const gameById = new Map(leagueGames.map((g) => [g.id, g]));

  const scores = {};
  byGame.forEach((gameMap, gameId) => {
    const game = gameById.get(gameId);
    if (!game) return;
    gameMap.forEach((line, playerId) => {
      if (!scores[playerId]) {
        scores[playerId] = { gp: 0, sumGis: 0, sumTech: 0, sumUnsp: 0, teamId: line.team_id };
      }
      const pts = cfg.mvp_pts_weight * calcPoints(line, game);
      const gis =
        pts +
        cfg.mvp_oreb_weight * line.offensive_rebounds +
        cfg.mvp_dreb_weight * line.defensive_rebounds +
        cfg.mvp_ast_weight * line.assists +
        cfg.mvp_stl_weight * line.steals +
        cfg.mvp_blk_weight * line.blocks -
        cfg.mvp_turnover_penalty * line.turnovers -
        cfg.mvp_foul_penalty * line.fouls -
        cfg.mvp_tech_penalty * line.technical_fouls -
        cfg.mvp_unsportsmanlike_penalty * line.unsportsmanlike_fouls;
      scores[playerId].gp += 1;
      scores[playerId].sumGis += gis;
      scores[playerId].sumTech += line.technical_fouls;
      scores[playerId].sumUnsp += line.unsportsmanlike_fouls;
    });
  });

  return Object.entries(scores)
    .map(([playerId, data]) => {
      const player = players.find((p) => p.id === playerId);
      const team = teams.find((t) => t.id === data.teamId);
      const teamData = teamStats[data.teamId];
      if (!player || !team || !teamData) return null;

      const effectiveGp = Math.min(data.gp, teamData.gamesPlayed);
      const avgGis = effectiveGp > 0 ? data.sumGis / effectiveGp : 0;
      const gpPct = teamData.gamesPlayed > 0 ? effectiveGp / teamData.gamesPlayed : 0;
      if (gpPct < cfg.mvp_min_games_percent / 100) return null;

      const teamBonus = cfg.mvp_team_win_percent_weight * teamData.winPct;
      const mvpScore =
        cfg.mvp_avg_gis_weight * avgGis +
        cfg.mvp_gp_percent_weight * gpPct +
        teamBonus -
        cfg.mvp_tech_final_penalty * data.sumTech -
        cfg.mvp_unsp_final_penalty * data.sumUnsp;

      return {
        playerId,
        player,
        team,
        gp: effectiveGp,
        totalGames: teamData.gamesPlayed,
        avgGisNum: avgGis,
        avgGis: avgGis.toFixed(1),
        gpPct: (gpPct * 100).toFixed(1),
        mvpScoreNum: mvpScore,
        mvpScore: mvpScore.toFixed(2),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const scoreDiff = Math.round(b.mvpScoreNum * 10) - Math.round(a.mvpScoreNum * 10);
      if (scoreDiff !== 0) return scoreDiff;
      return b.avgGisNum - a.avgGisNum;
    })
    .slice(0, topN);
}

// ---------------------------------------------------------------------------
// DPOY race — same dedupe + eligibility treatment.
// ---------------------------------------------------------------------------
export function computeDpoyRace({ league, teams, games, players, stats, awardSettings, topN = 5 }) {
  const cfg = resolveSettings(awardSettings);
  if (!league || !teams || !games || !players || !stats) return [];

  const purpose = "awards";
  const leagueTeamIds = new Set(teams.filter((t) => t.league_id === league.id).map((t) => t.id));
  const leagueGames = games.filter(
    (g) =>
      (leagueTeamIds.has(g.home_team_id) || leagueTeamIds.has(g.away_team_id)) &&
      isGameEligible(g, purpose)
  );
  if (leagueGames.length === 0) return [];

  const teamGames = {};
  leagueTeamIds.forEach((teamId) => {
    teamGames[teamId] = leagueGames.filter(
      (g) => g.home_team_id === teamId || g.away_team_id === teamId
    ).length;
  });

  const byGame = groupStatsByGameAndPlayer(
    stats.filter((s) => leagueGames.some((g) => g.id === s.game_id))
  );

  const scores = {};
  byGame.forEach((gameMap) => {
    gameMap.forEach((line, playerId) => {
      if (!scores[playerId]) {
        scores[playerId] = { gp: 0, sumDefGis: 0, sumTech: 0, sumUnsp: 0, teamId: line.team_id };
      }
      const defGis =
        cfg.dpoy_stl_weight * line.steals +
        cfg.dpoy_blk_weight * line.blocks +
        cfg.dpoy_oreb_weight * line.offensive_rebounds +
        cfg.dpoy_dreb_weight * line.defensive_rebounds -
        cfg.dpoy_foul_penalty * line.fouls -
        cfg.dpoy_turnover_penalty * line.turnovers -
        cfg.dpoy_tech_penalty * line.technical_fouls -
        cfg.dpoy_unsportsmanlike_penalty * line.unsportsmanlike_fouls;
      scores[playerId].gp += 1;
      scores[playerId].sumDefGis += defGis;
      scores[playerId].sumTech += line.technical_fouls;
      scores[playerId].sumUnsp += line.unsportsmanlike_fouls;
    });
  });

  return Object.entries(scores)
    .map(([playerId, data]) => {
      const player = players.find((p) => p.id === playerId);
      const team = teams.find((t) => t.id === data.teamId);
      const tg = teamGames[data.teamId];
      if (!player || !team || tg === undefined || data.gp === 0 || tg === 0) return null;

      const effectiveGp = Math.min(data.gp, tg);
      const gpPct = effectiveGp / tg;
      if (gpPct < cfg.dpoy_min_games_percent / 100) return null;

      const avgDefGis = data.sumDefGis / effectiveGp;
      const dpoyScore =
        avgDefGis +
        cfg.dpoy_gp_percent_weight * gpPct -
        cfg.dpoy_tech_final_penalty * data.sumTech -
        cfg.dpoy_unsp_final_penalty * data.sumUnsp;

      return {
        playerId,
        player,
        team,
        gp: effectiveGp,
        avgDefGisNum: avgDefGis,
        avgDefGis: avgDefGis.toFixed(1),
        gpPct: (gpPct * 100).toFixed(1),
        sumTech: data.sumTech,
        sumUnsp: data.sumUnsp,
        dpoyScoreNum: dpoyScore,
        dpoyScore: dpoyScore.toFixed(2),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const scoreDiff = Math.round(b.dpoyScoreNum * 10) - Math.round(a.dpoyScoreNum * 10);
      if (scoreDiff !== 0) return scoreDiff;
      return b.avgDefGisNum - a.avgDefGisNum;
    })
    .slice(0, topN);
}
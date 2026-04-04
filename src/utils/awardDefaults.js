export const DEFAULT_AWARD_SETTINGS = {
  mvp_pts_weight: 1.0,
  mvp_oreb_weight: 1.2,
  mvp_dreb_weight: 1.0,
  mvp_ast_weight: 1.5,
  mvp_stl_weight: 2.5,
  mvp_blk_weight: 2.0,
  mvp_turnover_penalty: 2.0,
  mvp_foul_penalty: 0.5,
  mvp_tech_penalty: 3.0,
  mvp_unsportsmanlike_penalty: 4.0,
  mvp_avg_gis_weight: 0.6,
  mvp_gp_percent_weight: 20.0,
  mvp_team_win_percent_weight: 20.0,
  mvp_min_games_percent: 60.0,
  mvp_tech_final_penalty: 3.0,
  mvp_unsp_final_penalty: 5.0,

  dpoy_stl_weight: 3.0,
  dpoy_blk_weight: 2.5,
  dpoy_oreb_weight: 1.5,
  dpoy_dreb_weight: 1.0,
  dpoy_foul_penalty: 1.5,
  dpoy_turnover_penalty: 2.0,
  dpoy_tech_penalty: 3.0,
  dpoy_unsportsmanlike_penalty: 4.0,
  dpoy_gp_percent_weight: 10.0,
  dpoy_min_games_percent: 60.0,
  dpoy_tech_final_penalty: 2.0,
  dpoy_unsp_final_penalty: 3.0,

  pog_pts_weight: 1.0,
  pog_oreb_weight: 1.2,
  pog_dreb_weight: 1.0,
  pog_ast_weight: 1.5,
  pog_stl_weight: 2.5,
  pog_blk_weight: 2.0,
  pog_turnover_penalty: 2.0,
  pog_foul_penalty: 0.5,
  pog_tech_penalty: 3.0,
  pog_unsportsmanlike_penalty: 4.0,
  pog_winning_team_only: true,

  mythical_five_source: 'mvp_rankings',
  mythical_five_count: 5,
};

/** Merge saved settings over defaults — guarantees all keys are present */
export function resolveSettings(saved) {
  if (!saved) return DEFAULT_AWARD_SETTINGS;
  return { ...DEFAULT_AWARD_SETTINGS, ...saved };
}
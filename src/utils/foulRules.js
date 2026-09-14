// FOUL_TOTAL_V1 — centralized foul-limit and disqualification logic. Pure functions, no React, no fetching.

export const getFoulLimits = (game) => ({
  personalFoulLimit: game?.game_rules?.personalFoulLimit ?? 5,
  technicalFoulLimit: game?.game_rules?.technicalFoulLimit ?? 2,
  unsportsmanlikeFoulLimit: game?.game_rules?.unsportsmanlikeFoulLimit ?? 2,
  countTechUnspInPlayerFoulTotal: game?.game_rules?.countTechUnspInPlayerFoulTotal ?? true,
});

export const getPlayerFoulTotal = (stat, game) => {
  const limits = getFoulLimits(game);
  const p = stat?.fouls || 0;
  if (!limits.countTechUnspInPlayerFoulTotal) return p;
  return p + (stat?.technical_fouls || 0) + (stat?.unsportsmanlike_fouls || 0);
};

export const getDisqualificationReason = (stat, game) => {
  if (!stat) return null;
  const limits = getFoulLimits(game);
  const tech = stat.technical_fouls || 0;
  const unsp = stat.unsportsmanlike_fouls || 0;
  if (tech >= limits.technicalFoulLimit) return { reason: `${tech} Technical Fouls`, label: 'EJECTION', kind: 'technical' };
  if (unsp >= limits.unsportsmanlikeFoulLimit) return { reason: `${unsp} Unsportsmanlike Fouls`, label: 'EJECTION', kind: 'unsportsmanlike' };
  if (tech >= 1 && unsp >= 1) return { reason: '1 Technical + 1 Unsportsmanlike Foul', label: 'EJECTION', kind: 'combined' };
  const total = getPlayerFoulTotal(stat, game);
  if (total >= limits.personalFoulLimit) return { reason: `${total} Fouls`, label: 'FOUL OUT', kind: 'total' };
  return null;
};

export const isPlayerDisqualified = (stat, game) => !!getDisqualificationReason(stat, game);
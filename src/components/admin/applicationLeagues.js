// APPLICATION_LEAGUES_V1 — the client-side mirror of how getReviewRequests works out
// which leagues an application is still waiting on. Any screen that counts pending
// applications straight from UserApplication rows must go through this, so its number
// can never disagree with the reviewer that makes the decisions (D15).
//
// Two things bite anyone who counts by application.league_id alone:
//   1. An application can target several leagues through league_ids (or, for a player,
//      through league_team_pairs). league_id is only the first of them.
//   2. Decisions are per league. An application stays "Pending" overall until every
//      league is decided, so a league that has already been approved or rejected must
//      not be counted as waiting.

// Every league this application is asking for. Mirrors getTargetLeagueIds on the server.
export function targetLeagueIds(application) {
  if (!application) return [];
  const ids = new Set();
  if (application.requested_role === "player") {
    if (Array.isArray(application.league_team_pairs)) {
      application.league_team_pairs.forEach((p) => { if (p && p.league_id) ids.add(p.league_id); });
    }
    if (application.league_id) ids.add(application.league_id);
  } else if (Array.isArray(application.league_ids) && application.league_ids.length) {
    application.league_ids.forEach((id) => { if (id) ids.add(id); });
  } else if (application.league_id) {
    ids.add(application.league_id);
  }
  return Array.from(ids);
}

// Of those, the ones that still need someone to decide. Mirrors decisionFor on the server.
export function pendingLeagueIds(application) {
  const decisions = Array.isArray(application && application.league_decisions)
    ? application.league_decisions
    : [];
  return targetLeagueIds(application).filter((lid) => {
    const d = decisions.find((x) => x && x.league_id === lid);
    return !d || d.decision === "pending";
  });
}
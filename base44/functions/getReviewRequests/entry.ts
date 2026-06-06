import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// REVIEW_REQUESTS_V1 marker
function getTargetLeagueIds(application) {
  const role = application.requested_role;
  const ids = new Set();
  if (role === 'player') {
    if (Array.isArray(application.league_team_pairs)) application.league_team_pairs.forEach(p => { if (p && p.league_id) ids.add(p.league_id); });
    if (application.league_id) ids.add(application.league_id);
  } else {
    if (Array.isArray(application.league_ids) && application.league_ids.length) application.league_ids.forEach(id => { if (id) ids.add(id); });
    else if (application.league_id) ids.add(application.league_id);
  }
  return Array.from(ids);
}
function decisionFor(application, leagueId) {
  const arr = Array.isArray(application.league_decisions) ? application.league_decisions : [];
  const e = arr.find(d => d.league_id === leagueId);
  return e || { league_id: leagueId, decision: 'pending' };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Forbidden' }, { status: 403 });
    let caller;
    try { caller = await base44.asServiceRole.entities.User.get(me.id); } catch (_e) { caller = me; }
    const callerType = caller && caller.user_type;
    const isAppAdmin = me.role === 'admin' || callerType === 'app_admin';
    const isLeagueAdmin = callerType === 'league_admin';
    if (!isAppAdmin && !isLeagueAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const myLeagueIds = Array.isArray(caller && caller.assigned_league_ids) ? caller.assigned_league_ids : [];

    const pending = await base44.asServiceRole.entities.UserApplication.filter({ status: 'Pending' }, '-created_date');

    const nameCache = {}; const teamCache = {};
    const leagueName = async (lid) => {
      if (lid in nameCache) return nameCache[lid];
      let n = lid;
      try { const lg = await base44.asServiceRole.entities.League.get(lid); if (lg && lg.name) n = lg.name; } catch (_e) {}
      nameCache[lid] = n; return n;
    };
    const teamName = async (tid) => {
      if (!tid) return null;
      if (tid in teamCache) return teamCache[tid];
      let n = tid;
      try { const t = await base44.asServiceRole.entities.Team.get(tid); if (t && t.name) n = t.name; } catch (_e) {}
      teamCache[tid] = n; return n;
    };

    const out = [];
    for (const app of pending) {
      const role = app.requested_role;
      const targets = getTargetLeagueIds(app);

      if (isLeagueAdmin) {
        if (role !== 'coach' && role !== 'viewer') continue;
        const myTargets = targets.filter(lid => myLeagueIds.includes(lid));
        if (myTargets.length === 0) continue;
        const myLeagues = []; let anyPending = false;
        for (const lid of myTargets) {
          const d = decisionFor(app, lid);
          if (d.decision === 'pending') anyPending = true;
          myLeagues.push({ league_id: lid, league_name: await leagueName(lid), decision: d.decision });
        }
        if (!anyPending) continue;
        out.push({
          id: app.id, user_name: app.user_name || '', user_email: app.user_email || '',
          requested_role: role, applied_at: app.applied_at || app.created_date || '', country: app.country || '',
          leagues: myLeagues,
          can_decide: myLeagues.filter(l => l.decision === 'pending').map(l => l.league_id),
        });
      } else {
        const leagues = [];
        for (const lid of targets) {
          const d = decisionFor(app, lid);
          let team = null;
          if (role === 'player') {
            let tid = null;
            if (Array.isArray(app.league_team_pairs)) { const p = app.league_team_pairs.find(pp => pp && pp.league_id === lid); if (p) tid = p.team_id; }
            if (!tid && app.league_id === lid) tid = app.team_id;
            team = tid ? { team_id: tid, team_name: await teamName(tid) } : null;
          }
          leagues.push({
            league_id: lid, league_name: await leagueName(lid), decision: d.decision,
            decided_by_name: d.decided_by_name || '', decided_by_type: d.decided_by_type || '', team,
          });
        }
        out.push({
          id: app.id, user_name: app.user_name || '', user_email: app.user_email || '',
          requested_role: role, applied_at: app.applied_at || app.created_date || '', country: app.country || '',
          user_id: app.user_id || '', team_id: app.team_id || '',
          is_additional_request: !!app.is_additional_request, current_user_type: app.current_user_type || '',
          display_name: app.display_name || '', handle: app.handle || '',
          league_id: app.league_id || '', league_name: app.league_name || '',
          league_ids: app.league_ids || [], league_team_pairs: app.league_team_pairs || [],
          season_start_date: app.season_start_date || '', number_of_teams: app.number_of_teams || null,
          avg_players_per_team: app.avg_players_per_team || null,
          leagues,
          can_decide: leagues.filter(l => l.decision === 'pending').map(l => l.league_id),
        });
      }
    }
    return Response.json({ requests: out, role: isAppAdmin ? 'app_admin' : 'league_admin' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
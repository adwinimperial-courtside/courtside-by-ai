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
    const isOpsAdmin = callerType === 'ops_admin';
    if (!isAppAdmin && !isLeagueAdmin && !isOpsAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const myLeagueIds = Array.isArray(caller && caller.assigned_league_ids) ? caller.assigned_league_ids : [];

    const pending = await base44.asServiceRole.entities.UserApplication.filter({ status: 'Pending' }, '-created_date');

    // Onboarding call requests, keyed by application_id (app_admin view only)
    const bookingByApp = {};
    if (isAppAdmin || isOpsAdmin) {
      try {
        const bookings = await base44.asServiceRole.entities.OnboardingBooking.list('-created_date', 500);
        for (const bk of bookings) { if (bk && bk.application_id && !bookingByApp[bk.application_id]) bookingByApp[bk.application_id] = bk; }
      } catch (_e) { /* non-blocking */ }
    }

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

      // Operations Admins only ever see brand-new-league applications (those that create
      // a league: a league_name is provided and they are not joining an existing league_id).
      if (isOpsAdmin && !isAppAdmin) {
        const isNewLeague = role === 'league_admin' && !!app.league_name && String(app.league_name).trim() && !app.league_id;
        if (!isNewLeague) continue;
      }

      if (isLeagueAdmin) {
        // LA_PLAYER_APPROVAL_V1 — league admins can now also see player requests for their teams
        if (role !== 'coach' && role !== 'viewer' && role !== 'player') continue;
        const myTargets = targets.filter(lid => myLeagueIds.includes(lid));
        if (myTargets.length === 0) continue;
        const myLeagues = []; let anyPending = false;
        for (const lid of myTargets) {
          const d = decisionFor(app, lid);
          if (d.decision === 'pending') anyPending = true;
          let team = null;
          if (role === 'player' || role === 'coach') {
            let tid = null;
            if (Array.isArray(app.league_team_pairs)) { const p = app.league_team_pairs.find(pp => pp && pp.league_id === lid); if (p) tid = p.team_id; }
            if (!tid && app.league_id === lid) tid = app.team_id;
            team = tid ? { team_id: tid, team_name: await teamName(tid) } : null;
          }
          myLeagues.push({ league_id: lid, league_name: await leagueName(lid), decision: d.decision, decided_by_name: d.decided_by_name || '', decided_by_type: d.decided_by_type || '', team });
        }
        if (!anyPending) continue;
        const laOut = {
          id: app.id, user_name: app.user_name || '', user_email: app.user_email || '',
          requested_role: role, applied_at: app.applied_at || app.created_date || '', country: app.country || '',
          leagues: myLeagues,
          can_decide: myLeagues.filter(l => l.decision === 'pending').map(l => l.league_id),
        };
        if (role === 'player') {
          const myTeamIds = myLeagues.map(l => l.team && l.team.team_id).filter(Boolean);
          laOut.user_id = app.user_id || '';
          laOut.display_name = app.display_name || '';
          laOut.handle = app.handle || '';
          laOut.jersey_number = app.jersey_number || '';
          laOut.match_suggestions = (Array.isArray(app.match_suggestions) ? app.match_suggestions : []).filter(s => s && myTeamIds.includes(s.team_id));
          laOut.league_team_pairs = (Array.isArray(app.league_team_pairs) ? app.league_team_pairs : []).filter(p => p && myLeagueIds.includes(p.league_id));
          laOut.league_id = myLeagueIds.includes(app.league_id) ? (app.league_id || '') : '';
          laOut.team_id = myLeagueIds.includes(app.league_id) ? (app.team_id || '') : '';
        }
        out.push(laOut);
      } else {
        const leagues = [];
        for (const lid of targets) {
          const d = decisionFor(app, lid);
          let team = null;
          if (role === 'player' || role === 'coach') {
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
          jersey_number: app.jersey_number || '', match_suggestions: app.match_suggestions || [],
          league_id: app.league_id || '', league_name: app.league_name || '',
          league_ids: app.league_ids || [], league_team_pairs: app.league_team_pairs || [],
          season_start_date: app.season_start_date || '', number_of_teams: app.number_of_teams || null,
          avg_players_per_team: app.avg_players_per_team || null,
          phone: app.phone || '', preferred_channel: app.preferred_channel || '',
          league_type: app.league_type || '', heard_from: app.heard_from || '',
          league_fb_page: app.league_fb_page || '', role_in_league: app.role_in_league || '',
          onboarding_call: bookingByApp[app.id] ? { requested_datetime: bookingByApp[app.id].requested_datetime || '', requested_timezone: bookingByApp[app.id].requested_timezone || '', status: bookingByApp[app.id].status || 'requested' } : null,
          leagues,
          can_decide: leagues.filter(l => l.decision === 'pending').map(l => l.league_id),
        });
      }
    }
    return Response.json({ requests: out, role: (isAppAdmin || isOpsAdmin) ? 'app_admin' : 'league_admin' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
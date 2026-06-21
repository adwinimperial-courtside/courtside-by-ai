import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// APPROVAL_V2_PER_LEAGUE marker
const ROLE_PRIORITY = { app_admin: 5, league_admin: 4, coach: 3, player: 2, viewer: 1 };
function highestRole(a, b) {
  const pa = ROLE_PRIORITY[a] || 0;
  const pb = ROLE_PRIORITY[b] || 0;
  return pa >= pb ? a : b;
}

function getTargetLeagueIds(application) {
  const role = application.requested_role;
  const ids = new Set();
  if (role === 'player') {
    if (Array.isArray(application.league_team_pairs)) {
      application.league_team_pairs.forEach(p => { if (p && p.league_id) ids.add(p.league_id); });
    }
    if (application.league_id) ids.add(application.league_id);
  } else {
    if (Array.isArray(application.league_ids) && application.league_ids.length) {
      application.league_ids.forEach(id => { if (id) ids.add(id); });
    } else if (application.league_id) {
      ids.add(application.league_id);
    }
  }
  return Array.from(ids);
}

async function getLeagueName(base44, leagueId) {
  try {
    const lg = await base44.asServiceRole.entities.League.get(leagueId);
    return (lg && lg.name) ? lg.name : leagueId;
  } catch (_e) { return leagueId; }
}

async function grantLeague(base44, application, applicantUser, leagueId, role) {
  const existing = applicantUser || {};
  const existingLeagueIds = Array.isArray(existing.assigned_league_ids) ? existing.assigned_league_ids : [];
  const mergedLeagueIds = Array.from(new Set([...existingLeagueIds, leagueId]));
  const userUpdate = { assigned_league_ids: mergedLeagueIds, application_status: 'Approved' };
  if (existing.user_type !== 'app_admin') {
    userUpdate.user_type = highestRole(existing.user_type || 'viewer', role);
  }
  // COACH_TEAM_PERSIST_V1 — persist the picked team for coaches too (mirrors the player path).
  // A coach's application carries league_team_pairs / team_id in the same shape as a player's,
  // so resolving and saving the team here lets the coach home auto-detect it (no team picker).
  if (role === 'player' || role === 'coach') {
    const existingPairs = Array.isArray(existing.league_team_pairs) ? existing.league_team_pairs : [];
    let teamId = null;
    if (Array.isArray(application.league_team_pairs)) {
      const p = application.league_team_pairs.find(pp => pp && pp.league_id === leagueId);
      if (p) teamId = p.team_id || null;
    }
    if (!teamId && application.league_id === leagueId) teamId = application.team_id || null;
    const mergedPairs = [...existingPairs];
    if (teamId && !mergedPairs.find(ep => ep.league_id === leagueId)) {
      mergedPairs.push({ league_id: leagueId, team_id: teamId });
    }
    userUpdate.league_team_pairs = mergedPairs;
  }
  try {
    await base44.asServiceRole.entities.User.update(application.user_id, userUpdate);
  } catch (_e) { /* user may not exist yet */ }

  if (role === 'coach' || role === 'viewer') {
    try {
      const found = await base44.asServiceRole.entities.UserLeagueIdentity.filter({
        user_id: application.user_id, league_id: leagueId,
      });
      const identityData = {
        user_id: application.user_id,
        league_id: leagueId,
        role: role,
        identity_status: 'completed',
        matched_by: 'approval',
        matched_at: new Date().toISOString(),
      };
      if (found && found.length > 0) {
        await base44.asServiceRole.entities.UserLeagueIdentity.update(found[0].id, identityData);
      } else {
        await base44.asServiceRole.entities.UserLeagueIdentity.create(identityData);
      }
    } catch (idErr) { console.error('Identity upsert failed:', idErr.message); }
  }
}

// PLAYER_CLAIM_GUARD_V1 — atomically (best-effort on base44) claim a roster player for the applicant
async function claimRosterPlayer(base44, application, leagueId, match) {
  const playerId = match && match.matched_player_id;
  const teamId = (match && match.team_id) || null;
  if (!playerId) return { ok: false, reason: 'no_player_selected' };

  // LA_PLAYER_APPROVAL_V1 — confirm the chosen player belongs to this team in THIS league
  let rosterPlayer = null;
  try { rosterPlayer = await base44.asServiceRole.entities.Player.get(playerId); } catch (_e) {}
  if (!rosterPlayer) return { ok: false, reason: 'player_not_found' };
  if (teamId && rosterPlayer.team_id !== teamId) return { ok: false, reason: 'player_team_mismatch' };
  let rosterTeam = null;
  try { rosterTeam = await base44.asServiceRole.entities.Team.get(rosterPlayer.team_id); } catch (_e) {}
  if (!rosterTeam || rosterTeam.league_id !== leagueId) return { ok: false, reason: 'player_outside_league' };

  let existingClaims = [];
  try {
    existingClaims = await base44.asServiceRole.entities.UserLeagueIdentity.filter({
      league_id: leagueId, matched_player_id: playerId,
    });
  } catch (_e) { existingClaims = []; }
  const conflict = (existingClaims || []).find(r => r.user_id && r.user_id !== application.user_id);
  if (conflict) {
    return { ok: false, reason: 'already_claimed', claimed_by: conflict.matched_player_name || conflict.user_id || '' };
  }

  const identityData = {
    user_id: application.user_id,
    league_id: leagueId,
    team_id: teamId,
    role: 'player',
    matched_player_id: playerId,
    matched_player_name: (match && match.matched_player_name) || null,
    match_status: 'matched',
    match_confidence: 'high',
    match_method: 'manual_admin',
    identity_status: 'completed',
    matched_by: 'approval',
    matched_at: new Date().toISOString(),
  };
  try {
    const found = await base44.asServiceRole.entities.UserLeagueIdentity.filter({
      user_id: application.user_id, league_id: leagueId,
    });
    if (found && found.length > 0) {
      await base44.asServiceRole.entities.UserLeagueIdentity.update(found[0].id, identityData);
    } else {
      await base44.asServiceRole.entities.UserLeagueIdentity.create(identityData);
    }
  } catch (_idErr) {
    return { ok: false, reason: 'identity_write_failed' };
  }
  return { ok: true };
}

async function writeLog(base44, application, leagueId, decision, decider) {
  const leagueName = leagueId ? await getLeagueName(base44, leagueId) : '';
  try {
    await base44.asServiceRole.entities.ApprovalLog.create({
      application_id: application.id,
      applicant_name: application.user_name || '',
      applicant_email: application.user_email || '',
      requested_role: application.requested_role,
      league_id: leagueId || '',
      league_name: leagueName,
      event_type: decision === 'approved' ? 'application_approved' : 'application_rejected',
      decision: decision,
      approved_by_email: decider.email,
      approved_by_name: decider.name,
      approver_type: decider.type,
      decided_at: decider.at,
      notes: '',
    });
  } catch (logErr) { console.error('ApprovalLog write failed:', logErr.message); }
}

async function sendWelcomeOnce(base44, application) {
  if (application.approval_email_sent) return;
  try {
    await base44.asServiceRole.functions.invoke('sendAccessApprovedEmail', {
      application: {
        id: application.id,
        user_email: application.user_email,
        user_name: application.user_name,
        status: 'Approved',
        approval_email_sent: false,
      }
    });
  } catch (emailErr) { console.error('Email failed:', emailErr.message); }
}

// DECLINE_EMAIL_V1 — notify the applicant once when their request is fully declined
async function sendDeclineOnce(base44, application) {
  if (application.decline_email_sent) return;
  try {
    await base44.asServiceRole.functions.invoke('sendDeclinedEmail', {
      application: {
        id: application.id,
        user_email: application.user_email,
        user_name: application.user_name,
        status: 'Rejected',
        decline_email_sent: false,
      }
    });
  } catch (emailErr) { console.error('Decline email failed:', emailErr.message); }
}

async function handleLeagueAdminApplication(base44, application, action, override_league_id, decider) {
  if (action === 'reject') {
    try { await base44.asServiceRole.entities.User.update(application.user_id, { application_status: 'Rejected' }); } catch (_e) {}
    await base44.asServiceRole.entities.UserApplication.update(application.id, { status: 'Rejected', decline_email_sent: true });
    await writeLog(base44, application, override_league_id || application.league_id || null, 'rejected', decider);
    await sendDeclineOnce(base44, application);
    return Response.json({ success: true, action: 'rejected' });
  }
  let assignedLeagueIds = [];
  let createdLeagueId = null;
  if (override_league_id) {
    assignedLeagueIds = [override_league_id];
  } else if (application.league_id && !application.league_name) {
    assignedLeagueIds = [application.league_id];
  } else {
    const teams = Number.parseInt(application.number_of_teams, 10);
    const players = Number.parseInt(application.avg_players_per_team, 10);
    if (
      !application.league_name || !String(application.league_name).trim() ||
      !application.season_start_date ||
      !Number.isInteger(teams) || teams < 2 ||
      !Number.isInteger(players) || players < 5
    ) {
      return Response.json({ error: 'Cannot approve: application is missing required new-league details (league name, season start date, number of teams, players per team).' }, { status: 400 });
    }
    const newLeague = await base44.asServiceRole.entities.League.create({
      name: application.league_name,
      season: application.season_start_date || 'TBD',
      owner_user_id: application.user_id,
      owner_email: application.user_email,
      owner_name: application.user_name,
    });
    assignedLeagueIds = [newLeague.id];
    createdLeagueId = newLeague.id;
  }
  let existing = null;
  try { existing = await base44.asServiceRole.entities.User.get(application.user_id); } catch (_e) {}
  const existingLeagueIds = Array.isArray(existing && existing.assigned_league_ids) ? existing.assigned_league_ids : [];
  const mergedLeagueIds = Array.from(new Set([...existingLeagueIds, ...assignedLeagueIds]));
  const userUpdate = { assigned_league_ids: mergedLeagueIds, application_status: 'Approved' };
  if (!existing || existing.user_type !== 'app_admin') userUpdate.user_type = 'league_admin';
  try { await base44.asServiceRole.entities.User.update(application.user_id, userUpdate); } catch (_e) {}
  await base44.asServiceRole.entities.UserApplication.update(application.id, { status: 'Approved', approval_email_sent: true });
  for (const lid of assignedLeagueIds) {
    await writeLog(base44, application, lid, 'approved', decider);
  }
  await sendWelcomeOnce(base44, application);
  return Response.json({ success: true, action: 'approved' });
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
    const callerLeagueIds = Array.isArray(caller && caller.assigned_league_ids) ? caller.assigned_league_ids : [];

    const body = await req.json();
    const { applicationId, action, override_league_id } = body;
    const requestedLeagueIds = Array.isArray(body.league_ids) ? body.league_ids : null;
    const playerMatches = Array.isArray(body.player_matches) ? body.player_matches : null;
    if (action !== 'approve' && action !== 'reject') return Response.json({ error: 'Invalid action' }, { status: 400 });

    const application = await base44.asServiceRole.entities.UserApplication.get(applicationId);
    if (!application) return Response.json({ error: 'Application not found' }, { status: 404 });

    const decider = {
      email: (caller && caller.email) || me.email || '',
      name: (caller && (caller.full_name || caller.name)) || me.full_name || me.email || '',
      type: isAppAdmin ? 'app_admin' : (isOpsAdmin ? 'ops_admin' : 'league_admin'),
      at: new Date().toISOString(),
    };

    const role = application.requested_role;

    if (role === 'league_admin') {
      // Operations Admins may decide ONLY brand-new-league applications (those that create a
      // league: a league_name is provided and they are not joining an existing league_id).
      const isExistingLeagueJoin = !!application.league_id && !application.league_name;
      const opsMayDecide = isOpsAdmin && !isExistingLeagueJoin;
      if (!isAppAdmin && !opsMayDecide) {
        return Response.json({ error: 'Forbidden: you are not allowed to decide this league admin request' }, { status: 403 });
      }
      return await handleLeagueAdminApplication(base44, application, action, override_league_id, decider);
    }

    // Operations Admins are limited to the new-league applications handled above; they may
    // not decide coach, player, or viewer requests.
    if (isOpsAdmin && !isAppAdmin) {
      return Response.json({ error: 'Forbidden: Operations Admins can only decide new-league applications' }, { status: 403 });
    }

    const targetLeagueIds = getTargetLeagueIds(application);
    if (targetLeagueIds.length === 0) return Response.json({ error: 'Application has no target leagues' }, { status: 400 });

    let decideLeagueIds = (requestedLeagueIds && requestedLeagueIds.length)
      ? requestedLeagueIds.filter(id => targetLeagueIds.includes(id))
      : targetLeagueIds.slice();
    if (decideLeagueIds.length === 0) return Response.json({ error: 'No valid leagues to decide' }, { status: 400 });

    if (isLeagueAdmin) {
      if (role !== 'coach' && role !== 'viewer' && role !== 'player') return Response.json({ error: 'Forbidden: league admins can only decide coach, viewer, or player requests' }, { status: 403 });
      const outside = decideLeagueIds.filter(id => !callerLeagueIds.includes(id));
      if (outside.length > 0) return Response.json({ error: 'Forbidden: you can only decide requests for your own leagues' }, { status: 403 });
    }

    let decisions = Array.isArray(application.league_decisions) ? application.league_decisions.map(d => ({ ...d })) : [];
    targetLeagueIds.forEach(lid => {
      if (!decisions.find(d => d.league_id === lid)) {
        decisions.push({ league_id: lid, decision: 'pending', decided_by_email: '', decided_by_name: '', decided_by_type: '', decided_at: '' });
      }
    });

    let applicantUser = null;
    try { applicantUser = await base44.asServiceRole.entities.User.get(application.user_id); } catch (_e) { applicantUser = null; }

    let anyNewApproval = false;
    const conflicts = [];
    for (const lid of decideLeagueIds) {
      const entry = decisions.find(d => d.league_id === lid);
      if (!entry) continue;
      if (entry.decision === 'approved' || entry.decision === 'rejected') continue;

      // PLAYER_CLAIM_GUARD — confirmed roster match must be claimed before this league is approved
      if (action === 'approve' && role === 'player' && playerMatches) {
        const matchForLeague = playerMatches.find(m => m && m.league_id === lid && m.matched_player_id) || null;
        if (matchForLeague) {
          const claim = await claimRosterPlayer(base44, application, lid, matchForLeague);
          if (!claim.ok) {
            conflicts.push({ league_id: lid, reason: claim.reason, claimed_by: claim.claimed_by || '' });
            continue; // leave this league pending; do not approve
          }
        }
      }

      entry.decision = action === 'approve' ? 'approved' : 'rejected';
      entry.decided_by_email = decider.email;
      entry.decided_by_name = decider.name;
      entry.decided_by_type = decider.type;
      entry.decided_at = decider.at;
      if (action === 'approve') {
        anyNewApproval = true;
        await grantLeague(base44, application, applicantUser, lid, role);
        try { applicantUser = await base44.asServiceRole.entities.User.get(application.user_id); } catch (_e) {}
      }
      await writeLog(base44, application, lid, entry.decision, decider);
    }

    const anyPending = decisions.some(d => d.decision === 'pending');
    const anyApprovedOverall = decisions.some(d => d.decision === 'approved');
    let newStatus = anyPending ? 'Pending' : (anyApprovedOverall ? 'Approved' : 'Rejected');

    const appUpdate = { league_decisions: decisions, status: newStatus };
    if (anyNewApproval && !application.approval_email_sent) appUpdate.approval_email_sent = true;
    if (newStatus === 'Rejected' && !application.decline_email_sent) appUpdate.decline_email_sent = true;
    await base44.asServiceRole.entities.UserApplication.update(application.id, appUpdate);

    if (applicantUser) {
      try {
        if (anyApprovedOverall) await base44.asServiceRole.entities.User.update(application.user_id, { application_status: 'Approved' });
        else if (!anyPending) await base44.asServiceRole.entities.User.update(application.user_id, { application_status: 'Rejected' });
      } catch (_e) {}
    }

    if (anyNewApproval && !application.approval_email_sent) await sendWelcomeOnce(base44, application);
    if (newStatus === 'Rejected' && !application.decline_email_sent) await sendDeclineOnce(base44, application);

    return Response.json({ success: true, status: newStatus, decided: decideLeagueIds.length, conflicts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
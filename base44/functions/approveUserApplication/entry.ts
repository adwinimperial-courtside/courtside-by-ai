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

// COACH_CAP_V1 — how many coaches one team may have. A head coach plus one assistant.
const COACH_CAP = 2;

// COACH_CAP_V1 — which team this application is asking about, for one league.
// Same resolution order the coach grant path already uses.
function teamIdForLeague(application, leagueId) {
  if (Array.isArray(application.league_team_pairs)) {
    const p = application.league_team_pairs.find(pp => pp && pp.league_id === leagueId);
    if (p && p.team_id) return p.team_id;
  }
  if (application.league_id === leagueId && application.team_id) return application.team_id;
  return null;
}

// COACH_CAP_V1 — everyone already coaching this team, excluding the applicant themselves.
// Coach identity rows only started carrying team_id from COACH_CAP_V1 onward, so for older
// rows we fall back to the coach's league_team_pairs, which is where their team has always
// been stored. Returns display names so the admin sees WHO holds the spots.
async function existingTeamCoaches(base44, leagueId, teamId, excludeUserId) {
  if (!teamId) return [];
  let rows = [];
  try {
    rows = await base44.asServiceRole.entities.UserLeagueIdentity.filter({ league_id: leagueId, role: 'coach' });
  } catch (_e) { return []; }
  const names = [];
  for (const row of (rows || [])) {
    if (!row || !row.user_id) continue;
    if (excludeUserId && row.user_id === excludeUserId) continue;
    let rowTeamId = row.team_id || null;
    let coachUser = null;
    if (!rowTeamId) {
      try { coachUser = await base44.asServiceRole.entities.User.get(row.user_id); } catch (_e) { coachUser = null; }
      const pairs = (coachUser && Array.isArray(coachUser.league_team_pairs)) ? coachUser.league_team_pairs : [];
      const p = pairs.find(pp => pp && pp.league_id === leagueId);
      rowTeamId = (p && p.team_id) || null;
    }
    if (rowTeamId !== teamId) continue;
    if (!coachUser) {
      try { coachUser = await base44.asServiceRole.entities.User.get(row.user_id); } catch (_e) { coachUser = null; }
    }
    names.push((coachUser && (coachUser.full_name || coachUser.display_name || coachUser.email)) || row.user_id);
  }
  return names;
}

async function getTeamName(base44, teamId) {
  try {
    const t = await base44.asServiceRole.entities.Team.get(teamId);
    return (t && t.name) ? t.name : teamId;
  } catch (_e) { return teamId; }
}

// ROLE_CONFLICT_GUARD_V1 — the applicant's current effective role in one league, so an
// approval never silently overwrites a role they already hold there. Mirrors useEffectiveRole:
// an explicit UserLeagueIdentity role wins; otherwise app_admin/league_admin membership counts.
async function existingRoleInLeague(base44, userId, applicantUser, leagueId) {
  try {
    const rows = await base44.asServiceRole.entities.UserLeagueIdentity.filter({ user_id: userId, league_id: leagueId });
    if (rows && rows.length > 0 && rows[0].role) return rows[0].role;
  } catch (_e) { /* no identity row */ }
  if (!applicantUser) return null;
  const assigned = Array.isArray(applicantUser.assigned_league_ids) ? applicantUser.assigned_league_ids : [];
  if (applicantUser.user_type === 'app_admin') return 'app_admin';
  if (applicantUser.user_type === 'league_admin' && assigned.includes(leagueId)) return 'league_admin';
  return null;
}

async function grantLeague(base44, application, applicantUser, leagueId, role) {
  const existing = applicantUser || {};
  const existingLeagueIds = Array.isArray(existing.assigned_league_ids) ? existing.assigned_league_ids : [];
  const mergedLeagueIds = Array.from(new Set([...existingLeagueIds, leagueId]));
  const userUpdate = { assigned_league_ids: mergedLeagueIds, application_status: 'Approved' };
  if (existing.user_type !== 'app_admin') {
    userUpdate.user_type = highestRole(existing.user_type || 'viewer', role);
  }
  // ROLE_MAP_PERSIST_V1: record the per-league role for coaches so the app can tell
  // "this user coaches in league X" even when their global type is a higher role
  // (e.g. a league admin who also coaches a team). Entries for other leagues are
  // never touched.
  if (role === 'coach') {
    const existingRoleMap = (existing.league_role_map && typeof existing.league_role_map === 'object') ? existing.league_role_map : {};
    userUpdate.league_role_map = { ...existingRoleMap, [leagueId]: 'coach' };
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
  // APPROVAL_DISPLAYNAME_COPY_V1 - carry the name and handle the applicant typed at signup
  // onto their account. Nothing did this before, so every approved player kept a blank
  // display_name. Only fills blanks; never overwrites a value the user already has.
  if (role === 'player') {
    const appDisplayName = (application.display_name || '').trim();
    const appHandle = (application.handle || '').trim();
    if (!existing.display_name && appDisplayName) {
      userUpdate.display_name = appDisplayName;
    }
    if (!existing.handle && appHandle) {
      userUpdate.handle = appHandle;
    }
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
      // COACH_CAP_V1 — store the coach's team on the identity row. The field already exists
      // on the entity but was never written for coaches, which is why counting coaches per
      // team used to return nothing. Players and viewers are unaffected.
      if (role === 'coach') {
        const coachTeamId = teamIdForLeague(application, leagueId);
        if (coachTeamId) identityData.team_id = coachTeamId;
      }
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
    // CLAIM_OWNER_EMAIL_V1 — include the owning account's email so the admin can see who holds the link
    let ownerLabel = conflict.matched_player_name || '';
    try {
      const owner = await base44.asServiceRole.entities.User.get(conflict.user_id);
      if (owner && owner.email) {
        ownerLabel = ownerLabel ? (ownerLabel + ' — ' + owner.email) : owner.email;
      }
    } catch (_e) {}
    return { ok: false, reason: 'already_claimed', claimed_by: ownerLabel || conflict.user_id || '' };
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

// DECLINE_REASONS_V1 — plain-English labels for the audit log. Keep in sync with the
// reason codes used by the reject dialog and by sendDeclinedEmail.
const REASON_LABELS = {
  player_not_on_roster: "Not on that team's roster",
  player_details_mismatch: 'Name or jersey number did not match',
  invalid_name: 'Not a real name',
  player_slot_claimed: 'Roster spot already claimed',
  coach_not_listed: 'Not listed as a coach for that team',
  coach_staff_full: 'Coaching staff already full',
  wrong_league_team: 'Wrong league or team selected',
  not_recognised: 'Not recognised by the league',
  league_private: 'League is invite only',
  league_already_exists: 'League already on Courtside',
  not_organiser: 'Could not confirm they run this league',
  insufficient_info: 'Not enough information',
  duplicate_request: 'Duplicate request',
  other: 'Other',
};

// DECLINE_REASONS_V1 — one readable line for the ApprovalLog notes column.
function declineLogNote(code, note) {
  if (!code) return '';
  const label = REASON_LABELS[code] || code;
  const clean = (note || '').trim();
  return 'DECLINE_REASONS_V1 reason: ' + label + ' [' + code + ']' + (clean ? ' \u2014 note: ' + clean : '');
}

async function writeLog(base44, application, leagueId, decision, decider, notes) {
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
      notes: notes || '',
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
        requested_role: application.requested_role,
        display_name: application.display_name,
        handle: application.handle,
        jersey_number: application.jersey_number,
        league_name: application.league_name,
        status: 'Approved',
        approval_email_sent: false,
      }
    });
  } catch (emailErr) { console.error('Email failed:', emailErr.message); }
}

// DECLINE_EMAIL_V1 — notify the applicant once when their request is fully declined
async function sendDeclineOnce(base44, application, reasonCode, reasonNote, leagueRejections) {
  if (application.decline_email_sent) return;
  try {
    await base44.asServiceRole.functions.invoke('sendDeclinedEmail', {
      application: {
        id: application.id,
        user_email: application.user_email,
        user_name: application.user_name,
        status: 'Rejected',
        decline_email_sent: false,
        // DECLINE_REASONS_V1 — the picked reason drives which email copy is sent.
        decline_reason_code: reasonCode || '',
        decline_reason_note: reasonNote || '',
        league_rejections: Array.isArray(leagueRejections) ? leagueRejections : [],
      }
    });
  } catch (emailErr) { console.error('Decline email failed:', emailErr.message); }
}

async function handleLeagueAdminApplication(base44, application, action, override_league_id, decider, declineReasonCode, declineReasonNote) {
  if (action === 'reject') {
    try { await base44.asServiceRole.entities.User.update(application.user_id, { application_status: 'Rejected' }); } catch (_e) {}
    await base44.asServiceRole.entities.UserApplication.update(application.id, {
      status: 'Rejected',
      decline_email_sent: true,
      // DECLINE_REASONS_V1
      decline_reason_code: declineReasonCode || '',
      decline_reason_note: declineReasonNote || '',
    });
    await writeLog(base44, application, override_league_id || application.league_id || null, 'rejected', decider, declineLogNote(declineReasonCode, declineReasonNote));
    await sendDeclineOnce(base44, application, declineReasonCode, declineReasonNote, []);
    return Response.json({ success: true, action: 'rejected' });
  }
  let assignedLeagueIds = [];
  let createdGroupId = null;
  if (override_league_id) {
    assignedLeagueIds = [override_league_id];
  } else if (application.league_id && !application.league_name) {
    assignedLeagueIds = [application.league_id];
  } else {
    if (!application.league_name || !String(application.league_name).trim()) {
      return Response.json({ error: 'Cannot approve: application is missing the league name.' }, { status: 400 });
    }
    const newGroup = await base44.asServiceRole.entities.LeagueGroup.create({
      name: String(application.league_name).trim(),
      owner_user_id: application.user_id,
      owner_email: application.user_email,
      owner_name: application.user_name,
    });
    createdGroupId = newGroup.id;
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
  if (createdGroupId && assignedLeagueIds.length === 0) {
    try {
      await base44.asServiceRole.entities.ApprovalLog.create({
        application_id: application.id,
        applicant_name: application.user_name || '',
        applicant_email: application.user_email || '',
        requested_role: application.requested_role,
        league_id: '',
        league_name: application.league_name || '',
        event_type: 'application_approved',
        decision: 'approved',
        approved_by_email: decider.email,
        approved_by_name: decider.name,
        approver_type: decider.type,
        decided_at: decider.at,
      });
    } catch (_e) {}
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
    const forceConflicts = Array.isArray(body.force_conflicts) ? body.force_conflicts : [];
    // DECLINE_REASONS_V1 — why this request is being rejected, picked by the admin in the UI.
    // Both are optional: an older caller that sends neither still behaves exactly as before.
    const declineReasonCode = typeof body.decline_reason_code === 'string' ? body.decline_reason_code.trim() : '';
    const declineReasonNote = typeof body.decline_reason_note === 'string' ? body.decline_reason_note.trim().slice(0, 300) : '';
    // RELEASE_CLAIM_V1 — app_admin frees a roster slot held by a stale UserLeagueIdentity
    if (action === 'release_claim') {
      if (!isAppAdmin) return Response.json({ error: 'Forbidden: only app admins can release a roster link' }, { status: 403 });
      const releaseLeagueId = body.league_id;
      const releasePlayerId = body.player_id;
      if (!releaseLeagueId || !releasePlayerId) return Response.json({ error: 'league_id and player_id are required' }, { status: 400 });
      let rows = [];
      try {
        rows = await base44.asServiceRole.entities.UserLeagueIdentity.filter({
          league_id: releaseLeagueId, matched_player_id: releasePlayerId,
        });
      } catch (_e) { rows = []; }
      let removed = 0;
      const removedEmails = [];
      for (const row of (rows || [])) {
        if (!row || !row.id) continue;
        let ownerEmail = '';
        try {
          const owner = await base44.asServiceRole.entities.User.get(row.user_id);
          if (owner && owner.email) ownerEmail = owner.email;
        } catch (_e) {}
        try {
          await base44.asServiceRole.entities.UserLeagueIdentity.delete(row.id);
          removed += 1;
          if (ownerEmail) removedEmails.push(ownerEmail);
        } catch (_e) {}
      }
      try {
        const releaseLeagueName = await getLeagueName(base44, releaseLeagueId);
        await base44.asServiceRole.entities.ApprovalLog.create({
          application_id: applicationId || '',
          league_id: releaseLeagueId,
          league_name: releaseLeagueName,
          event_type: 'direct_revoke',
          decision: 'rejected',
          approved_by_email: (caller && caller.email) || me.email || '',
          approved_by_name: (caller && (caller.full_name || caller.name)) || me.email || '',
          approver_type: 'app_admin',
          decided_at: new Date().toISOString(),
          notes: 'RELEASE_CLAIM_V1 released roster link for player ' + releasePlayerId + (removedEmails.length ? ' previously held by ' + removedEmails.join(', ') : '') + ' (' + removed + ' identity row(s) removed)',
        });
      } catch (_e) {}
      return Response.json({ success: true, released: removed });
    }

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
      return await handleLeagueAdminApplication(base44, application, action, override_league_id, decider, declineReasonCode, declineReasonNote);
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
      // ROLE_CONFLICT_GUARD_V1 — pause (do not silently overwrite) if the applicant already
      // holds a DIFFERENT role in this league, unless the approver explicitly forced it.
      if (action === 'approve' && !forceConflicts.includes(lid)) {
        const priorRole = await existingRoleInLeague(base44, application.user_id, applicantUser, lid);
        if (priorRole && priorRole !== role) {
          conflicts.push({
            league_id: lid,
            reason: 'role_conflict',
            existing_role: priorRole,
            requested_role: role,
            league_name: await getLeagueName(base44, lid),
          });
          continue; // leave this league pending; approver must confirm the override
        }
      }

      // COACH_CAP_V1 — a team may have at most two coaches. Pause the approval and report
      // who already holds the spots. Either admin type may override by confirming, which
      // re-sends this league in force_conflicts.
      if (action === 'approve' && role === 'coach' && !forceConflicts.includes(lid)) {
        const capTeamId = teamIdForLeague(application, lid);
        if (capTeamId) {
          const current = await existingTeamCoaches(base44, lid, capTeamId, application.user_id);
          if (current.length >= COACH_CAP) {
            conflicts.push({
              league_id: lid,
              reason: 'coach_cap',
              league_name: await getLeagueName(base44, lid),
              team_name: await getTeamName(base44, capTeamId),
              existing_coaches: current,
              cap: COACH_CAP,
            });
            continue; // leave this league pending; approver must confirm the override
          }
        }
      }

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
      // DECLINE_REASONS_V1 — record why THIS league was rejected, so a multi-league
      // application can carry a different reason per league.
      if (entry.decision === 'rejected') {
        entry.decline_reason_code = declineReasonCode;
        entry.decline_reason_note = declineReasonNote;
      }
      // COACH_CAP_V1 — record when an admin waved the cap through, so a team quietly running
      // more than two coaches can be traced back to a decision. Written onto the same audit
      // row as the approval itself, not a second row.
      let logNote = entry.decision === 'rejected' ? declineLogNote(declineReasonCode, declineReasonNote) : '';
      if (action === 'approve' && role === 'coach' && forceConflicts.includes(lid)) {
        const overTeamId = teamIdForLeague(application, lid);
        if (overTeamId) {
          const held = await existingTeamCoaches(base44, lid, overTeamId, application.user_id);
          if (held.length >= COACH_CAP) {
            logNote = 'COACH_CAP_V1 cap override: ' + (await getTeamName(base44, overTeamId))
              + ' already had ' + held.length + ' coach(es) (' + held.join(', ') + ')';
          }
        }
      }
      if (action === 'approve') {
        anyNewApproval = true;
        await grantLeague(base44, application, applicantUser, lid, role);
        try { applicantUser = await base44.asServiceRole.entities.User.get(application.user_id); } catch (_e) {}
      }
      await writeLog(base44, application, lid, entry.decision, decider, logNote);
    }

    // NAME_FALLBACK_V1 — if the account name is an email/relay prefix, adopt the real name we now know
    if (applicantUser) {
      try {
        const looksReal = (s) => !!(s && String(s).trim().includes(' '));
        const matchName = Array.isArray(playerMatches)
          ? ((playerMatches.find(m => m && m.matched_player_name) || {}).matched_player_name || null)
          : null;
        const pool = [matchName, application.display_name, application.user_name];
        const bestName = pool.find(looksReal) || pool.find(c => c && String(c).trim()) || '';
        const current = (applicantUser.full_name || '').trim();
        const localpart = ((applicantUser.email || '').split('@')[0] || '').trim();
        const isRelay = (applicantUser.email || '').toLowerCase().includes('privaterelay.appleid.com');
        const needsFix = !current || current === localpart || (isRelay && !current.includes(' '));
        const bn = String(bestName).trim();
        if (needsFix && bn && bn !== current && bn !== localpart) {
          await base44.asServiceRole.entities.User.update(application.user_id, { full_name: bn });
          applicantUser.full_name = bn;
        }
      } catch (_e) { /* never block approval on a name fix */ }
    }

    const anyPending = decisions.some(d => d.decision === 'pending');
    const anyApprovedOverall = decisions.some(d => d.decision === 'approved');
    let newStatus = anyPending ? 'Pending' : (anyApprovedOverall ? 'Approved' : 'Rejected');

    const appUpdate = { league_decisions: decisions, status: newStatus };
    if (anyNewApproval && !application.approval_email_sent) appUpdate.approval_email_sent = true;
    if (newStatus === 'Rejected' && !application.decline_email_sent) appUpdate.decline_email_sent = true;
    // DECLINE_REASONS_V1 — top-level copy of the reason for the People page and reporting.
    if (newStatus === 'Rejected' && declineReasonCode) {
      appUpdate.decline_reason_code = declineReasonCode;
      appUpdate.decline_reason_note = declineReasonNote;
    }
    await base44.asServiceRole.entities.UserApplication.update(application.id, appUpdate);

    if (applicantUser) {
      try {
        if (anyApprovedOverall) await base44.asServiceRole.entities.User.update(application.user_id, { application_status: 'Approved' });
        else if (!anyPending) await base44.asServiceRole.entities.User.update(application.user_id, { application_status: 'Rejected' });
      } catch (_e) {}
    }

    if (anyNewApproval && !application.approval_email_sent) await sendWelcomeOnce(base44, application);
    // DECLINE_REASONS_V1 — when several leagues were rejected, hand the email one entry per
    // league so it can list each league with the reason that league's admin gave.
    if (newStatus === 'Rejected' && !application.decline_email_sent) {
      const leagueRejections = [];
      for (const d of decisions) {
        if (!d || d.decision !== 'rejected') continue;
        leagueRejections.push({
          league_name: await getLeagueName(base44, d.league_id),
          reason_code: d.decline_reason_code || '',
        });
      }
      const primaryCode = declineReasonCode || (leagueRejections.find(r => r.reason_code) || {}).reason_code || '';
      const primaryNote = declineReasonNote || '';
      await sendDeclineOnce(base44, application, primaryCode, primaryNote, leagueRejections);
    }

    return Response.json({ success: true, status: newStatus, decided: decideLeagueIds.length, conflicts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
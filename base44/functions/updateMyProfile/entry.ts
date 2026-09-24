import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// SECURITY_F8_V1 — the only way a signed-in user changes their OWN User record.
// Plain call (no "action"): the request body is the list of fields to change. Only the
// fields below are accepted; user_type, assigned_league_ids, role, phone_verified and
// everything else are silently ignored.
// action 'apply_pending_assignment': applies an invite an admin queued for this email.
// action 'add_new_season': gives a league admin the season they just created, plus the
// other league admins of the same league group (NEW_SEASON_ADMIN_V1).
const SECURITY_F8_V1 = true;
const PAGE = 1000;

function cleanStr(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function pickProfileFields(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  if ('full_name' in input) {
    const n = cleanStr(input.full_name, 100);
    if (n) out.full_name = n;
  }
  if ('profile_photo_url' in input) {
    const v = input.profile_photo_url;
    if (v === null || v === '') out.profile_photo_url = null;
    else {
      const u = cleanStr(v, 2000);
      if (/^https:\/\//i.test(u)) out.profile_photo_url = u;
    }
  }
  if ('default_league_id' in input) {
    const v = input.default_league_id;
    if (v === null || v === '') out.default_league_id = null;
    else if (typeof v === 'string' && v.length <= 64) out.default_league_id = v;
  }
  if (input.privacy_terms_accepted === true) out.privacy_terms_accepted = true;
  if ('privacy_terms_accepted_at' in input) {
    const v = cleanStr(input.privacy_terms_accepted_at, 40);
    if (v) out.privacy_terms_accepted_at = v;
  }
  if ('marketing_email_consent' in input) out.marketing_email_consent = input.marketing_email_consent === true;
  if ('marketing_email_consent_at' in input) {
    out.marketing_email_consent_at = cleanStr(input.marketing_email_consent_at, 40) || null;
  }
  if ('consent_version' in input) {
    const v = cleanStr(String(input.consent_version ?? ''), 60);
    if (v) out.consent_version = v;
  }
  if (input.application_status === 'Pending') out.application_status = 'Pending';
  return out;
}

async function listAllUsers(svc) {
  const rows = [];
  let skip = 0;
  while (true) {
    const page = await svc.User.list('-created_date', PAGE, skip);
    if (!page || page.length === 0) break;
    rows.push(...page);
    skip += page.length;
  }
  return rows;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me || !me.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body && typeof body.action === 'string' ? body.action : '';
    const svc = base44.asServiceRole.entities;

    if (!action) {
      const patch = pickProfileFields(body);
      if (Object.keys(patch).length === 0) return Response.json({ success: true, updated: [] });
      await svc.User.update(me.id, patch);
      return Response.json({ success: true, updated: Object.keys(patch) });
    }

    if (action === 'apply_pending_assignment') {
      const email = String(me.email || '').trim().toLowerCase();
      if (!email) return Response.json({ applied: false });
      const rows = await svc.PendingUserAssignment.filter({ email, applied: false });
      const a = rows && rows[0];
      if (!a) return Response.json({ applied: false });
      const leagueIds = Array.isArray(a.assigned_league_ids) ? a.assigned_league_ids : [];
      await svc.User.update(me.id, { user_type: a.user_type, assigned_league_ids: leagueIds });
      await svc.PendingUserAssignment.update(a.id, { applied: true });
      return Response.json({
        applied: true,
        assignment: { user_type: a.user_type, assigned_league_ids: leagueIds, created_by: a.created_by || 'system' },
      });
    }

    if (action === 'add_new_season') {
      if (me.user_type !== 'league_admin' && me.user_type !== 'app_admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const leagueId = cleanStr(body.league_id, 64);
      const found = leagueId ? await svc.League.filter({ id: leagueId }) : [];
      const league = found && found[0];
      if (!league) return Response.json({ error: 'League not found' }, { status: 404 });
      const myEmail = String(me.email || '').trim().toLowerCase();
      if (String(league.created_by || '').trim().toLowerCase() !== myEmail) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const mine = Array.isArray(me.assigned_league_ids) ? me.assigned_league_ids : [];
      if (me.user_type === 'league_admin' && !mine.includes(leagueId)) {
        await svc.User.update(me.id, { assigned_league_ids: [...mine, leagueId] });
      }

      let propagated = 0;
      if (league.group_id) {
        const groupSeasons = await svc.League.filter({ group_id: league.group_id });
        const groupIds = (groupSeasons || []).map((l) => l.id).filter((id) => id && id !== leagueId);
        const callerInGroup = me.user_type === 'app_admin' || mine.some((id) => groupIds.includes(id));
        if (groupIds.length && callerInGroup) {
          const users = await listAllUsers(svc);
          for (const u of users) {
            if (u.id === me.id || u.user_type !== 'league_admin') continue;
            const existing = Array.isArray(u.assigned_league_ids) ? u.assigned_league_ids : [];
            if (existing.includes(leagueId)) continue;
            if (!existing.some((id) => groupIds.includes(id))) continue;
            await svc.User.update(u.id, { assigned_league_ids: [...existing, leagueId] });
            propagated++;
          }
        }
      }
      return Response.json({ success: true, league_id: leagueId, propagated });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// VALIDATE_COACH_CODE_V1 — server-side validation and redemption of coach
// invite codes (CoachInviteCode entity) for dedicated coach signup pages.
//
// Why a function: CoachInviteCode is readable only by app_admin. Regular
// signed-in users must never be able to list the codes, so the signup page
// talks to this function instead of the entity.
//
// Actions:
//   'check'  — validates a typed code WITHOUT consuming it. Returns the
//              team/league it unlocks so the page can show a locked team box.
//   'redeem' — re-validates and marks the code as used (status 'used',
//              used_by_email, used_at). Called once, at final submit.
//
// Rules:
//   - Input is normalized: uppercased, spaces and dashes ignored, so
//     "fnb-7k2m", "FNB 7K2M" and "fnb7k2m" all match "FNB-7K2M".
//   - Invalid and already-used codes get ONE generic error message that does
//     not reveal which case it was.
//   - Idempotent redeem: if the code is already 'used' but was used by the
//     SAME email as the caller, redeem succeeds again. This prevents a coach
//     from being locked out when a submit fails halfway and they retry.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Not signed in' }, { status: 401 });
    }

    const { action, code } = await req.json();
    if (!action || !code) {
      return Response.json({ error: 'action and code are required' }, { status: 400 });
    }
    if (action !== 'check' && action !== 'redeem') {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    const GENERIC_ERROR = 'That code is not valid or has already been used. Please contact the league admin.';

    // Normalize: uppercase, strip spaces and dashes
    const normalize = (s) => String(s || '').toUpperCase().replace(/[\s-]/g, '');
    const typed = normalize(code);
    if (!typed) {
      return Response.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    // The codes table is tiny (a handful of records per league), so we list
    // and compare normalized values instead of relying on exact-match filters.
    const allCodes = await base44.asServiceRole.entities.CoachInviteCode.list();
    const match = (allCodes || []).find((r) => normalize(r.code) === typed);

    if (!match) {
      return Response.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const callerEmail = String(user.email || '').toLowerCase();
    const usedByCaller =
      match.status === 'used' &&
      String(match.used_by_email || '').toLowerCase() === callerEmail;

    if (match.status !== 'active' && !usedByCaller) {
      return Response.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    // Resolve the league name for display on the signup page
    let leagueName = '';
    try {
      const leagues = await base44.asServiceRole.entities.League.filter({ id: match.league_id });
      if (leagues && leagues[0] && leagues[0].name) leagueName = leagues[0].name;
    } catch (_e) {
      // League name is display-only; validation does not depend on it
    }

    if (action === 'redeem' && !usedByCaller) {
      await base44.asServiceRole.entities.CoachInviteCode.update(match.id, {
        status: 'used',
        used_by_email: user.email,
        used_at: new Date().toISOString()
      });
    }

    return Response.json({
      valid: true,
      team_id: match.team_id,
      team_name: match.team_name || '',
      league_id: match.league_id,
      league_name: leagueName
    });
  } catch (err) {
    console.error('validateCoachCode error:', err);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
});
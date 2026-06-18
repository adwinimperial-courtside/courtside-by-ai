import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// LOG_ACCESS_EVENT_V1
// Single writer for ApprovalLog. Any path that grants, revokes, approves, or
// rejects access calls this so the log is a complete ledger — including
// league-less grants the old applications-only log could not record.
const ALLOWED_EVENTS = [
  'application_approved',
  'application_rejected',
  'direct_grant',
  'direct_revoke',
  'pending_assignment_applied',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const event_type = body.event_type;
    if (!ALLOWED_EVENTS.includes(event_type)) {
      return Response.json({ error: 'Invalid or missing event_type' }, { status: 400 });
    }

    const decision = body.decision
      || ((event_type === 'application_rejected' || event_type === 'direct_revoke') ? 'rejected' : 'approved');

    const leagueId = body.league_id || '';
    let leagueName = body.league_name || '';
    if (leagueId && !leagueName) {
      try {
        const league = await base44.asServiceRole.entities.League.get(leagueId);
        leagueName = (league && league.name) || '';
      } catch (_e) {}
    }

    await base44.asServiceRole.entities.ApprovalLog.create({
      application_id: body.application_id || '',
      applicant_name: body.applicant_name || '',
      applicant_email: body.applicant_email || '',
      requested_role: body.requested_role || '',
      league_id: leagueId,
      league_name: leagueName,
      event_type: event_type,
      decision: decision,
      approved_by_email: body.approved_by_email || (me.email || ''),
      approved_by_name: body.approved_by_name || (me.full_name || me.email || ''),
      approver_type: body.approver_type || 'app_admin',
      decided_at: body.decided_at || new Date().toISOString(),
      notes: body.notes || '',
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
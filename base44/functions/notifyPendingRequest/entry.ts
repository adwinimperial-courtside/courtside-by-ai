import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// SECURITY_F1_V1 — only runs for a real LeagueAccessRequest created in the last 15 minutes.
// The record is re-read from the database; the posted data is never trusted.
const SECURITY_F1_V1 = true;
const FRESH_MS = 15 * 60 * 1000;

function esc(v) {
    return String(v === null || v === undefined ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function tsMs(v) {
    if (!v) return NaN;
    let s = String(v);
    if (!/(Z|[+-]\d\d:?\d\d)$/i.test(s)) s += 'Z';
    return Date.parse(s);
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json().catch(() => ({}));
        const event = body && body.event;

        if (!event || event.type !== 'create') {
            return Response.json({ message: 'Not a create event' });
        }

        const recordId = event.entity_id || (body.data && body.data.id);
        if (!recordId) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        const found = await base44.asServiceRole.entities.LeagueAccessRequest.filter({ id: recordId });
        const data = found && found[0];
        const age = data ? Date.now() - tsMs(data.created_date) : NaN;
        if (!data || !(age >= -5 * 60 * 1000 && age <= FRESH_MS)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch league names for better email context
        const leagueNames = [];
        if (data.requested_league_ids && data.requested_league_ids.length > 0) {
            const leagues = await base44.asServiceRole.entities.League.list();
            for (const leagueId of data.requested_league_ids) {
                const league = leagues.find(l => l.id === leagueId);
                if (league) {
                    leagueNames.push(league.name);
                }
            }
        }

        // Send email notification
        await base44.asServiceRole.integrations.Core.SendEmail({
            to: 'adwin.imperial@gmail.com',
            subject: 'New League Access Request Pending',
            body: `
                <h2>New League Access Request</h2>
                <p>A new user has requested access to your leagues.</p>
                
                <h3>Request Details:</h3>
                <ul>
                    <li><strong>User Name:</strong> ${esc(data.user_name || 'N/A')}</li>
                    <li><strong>User Email:</strong> ${esc(data.user_email)}</li>
                    <li><strong>Requested Leagues:</strong> ${esc(leagueNames.join(', ') || 'N/A')}</li>
                    <li><strong>Status:</strong> ${esc(data.status)}</li>
                </ul>
                
                <p>Please log in to your admin panel to review and approve this request.</p>
            `
        });

        return Response.json({ success: true, message: 'Notification email sent' });
    } catch (error) {
        console.error('Error sending notification:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});
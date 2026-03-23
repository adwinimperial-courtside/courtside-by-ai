import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { event, data } = await req.json();

        if (event.type !== 'create') {
            return Response.json({ message: 'Not a create event' });
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
                    <li><strong>User Name:</strong> ${data.user_name || 'N/A'}</li>
                    <li><strong>User Email:</strong> ${data.user_email}</li>
                    <li><strong>Requested Leagues:</strong> ${leagueNames.join(', ') || 'N/A'}</li>
                    <li><strong>Status:</strong> ${data.status}</li>
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
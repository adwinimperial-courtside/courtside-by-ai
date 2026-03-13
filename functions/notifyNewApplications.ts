import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event.type !== 'create') {
      return Response.json({ success: true });
    }

    const application = data;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'adwin.imperial@gmail.com',
      subject: `New Role Application: ${application.user_name || application.user_email} (${application.requested_role})`,
      body: `A new user has submitted a role application request.

User: ${application.user_name || 'Unknown'}
Email: ${application.user_email}
Requested Role: ${application.requested_role}
League: ${application.league_name || 'Not specified'}
Country: ${application.country || 'Not specified'}
Number of Teams: ${application.number_of_teams || 'Not specified'}
Applied At: ${new Date().toLocaleString()}

Please review and approve/reject this application in the admin panel.`
    });

    console.log(`Notification email sent for application from ${application.user_email}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error sending notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
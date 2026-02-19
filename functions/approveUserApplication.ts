import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.user_type !== 'app_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { applicationId, action } = await req.json();

    // Fetch the application
    const application = await base44.asServiceRole.entities.UserApplication.get(applicationId);
    if (!application) {
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }

    if (action === 'approve') {
      let assignedLeagueIds = [];

      if (application.requested_role === 'league_admin') {
        const newLeague = await base44.asServiceRole.entities.League.create({
          name: application.league_name,
          season: application.season_start_date || 'TBD',
        });
        assignedLeagueIds = [newLeague.id];
      } else if (application.league_ids && application.league_ids.length > 0) {
        assignedLeagueIds = application.league_ids;
      } else if (application.league_id) {
        assignedLeagueIds = [application.league_id];
      }

      await base44.asServiceRole.entities.User.update(application.user_id, {
        user_type: application.requested_role,
        application_status: 'Approved',
        assigned_league_ids: assignedLeagueIds,
      });

      await base44.asServiceRole.entities.UserApplication.update(applicationId, {
        status: 'Approved',
      });

      return Response.json({ success: true, action: 'approved' });

    } else if (action === 'reject') {
      await base44.asServiceRole.entities.User.update(application.user_id, {
        application_status: 'Rejected',
      });

      await base44.asServiceRole.entities.UserApplication.update(applicationId, {
        status: 'Rejected',
      });

      return Response.json({ success: true, action: 'rejected' });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
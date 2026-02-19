import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
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

      const userUpdate = {
        user_type: application.requested_role,
        application_status: 'Approved',
        assigned_league_ids: assignedLeagueIds,
      };
      if (application.requested_role === 'player' && application.league_team_pairs) {
        userUpdate.league_team_pairs = application.league_team_pairs;
      } else if (application.requested_role === 'player' && application.team_id) {
        userUpdate.league_team_pairs = [{ league_id: assignedLeagueIds[0], team_id: application.team_id }];
      }

      // Get or create the user record
      let targetUser;
      try {
        targetUser = await base44.asServiceRole.entities.User.get(application.user_id);
      } catch (err) {
        // User doesn't exist, need to invite them (inviteUser only accepts 'user' or 'admin')
        await base44.users.inviteUser(application.user_email, 'user');
        // Wait a moment for the user to be created
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Try to get the user again
        targetUser = await base44.asServiceRole.entities.User.get(application.user_id);
      }

      // Update the user with league assignments
      if (targetUser) {
        await base44.asServiceRole.entities.User.update(application.user_id, userUpdate);
      }

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
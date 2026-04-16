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

      if (application.is_additional_request) {
        // ADDITIONAL request: merge league access, do NOT overwrite user_type or application_status
        let newLeagueIds = [];
        if (application.league_ids && application.league_ids.length > 0) {
          newLeagueIds = application.league_ids;
        } else if (application.league_id) {
          newLeagueIds = [application.league_id];
        }

        const currentUserData = await base44.asServiceRole.entities.User.get(application.user_id);
        const existingLeagueIds = currentUserData?.assigned_league_ids || [];
        const mergedLeagueIds = [...new Set([...existingLeagueIds, ...newLeagueIds])];

        const userUpdate = { assigned_league_ids: mergedLeagueIds };

        if (application.requested_role === 'player') {
          const existingPairs = currentUserData?.league_team_pairs || [];
          const newPairs = application.league_team_pairs ||
            (application.team_id && newLeagueIds[0] ? [{ league_id: newLeagueIds[0], team_id: application.team_id }] : []);
          const mergedPairs = [...existingPairs];
          newPairs.forEach(np => {
            if (!mergedPairs.find(ep => ep.league_id === np.league_id)) mergedPairs.push(np);
          });
          userUpdate.league_team_pairs = mergedPairs;
        }

        await base44.asServiceRole.entities.User.update(application.user_id, userUpdate);

      } else {
        // ORIGINAL flow: new user first application
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

        try {
          await base44.asServiceRole.entities.User.update(application.user_id, userUpdate);
        } catch (err) {
          // User doesn't exist yet
        }
      }

      await base44.asServiceRole.entities.UserApplication.update(applicationId, {
        status: 'Approved',
        approval_email_sent: true,
      });

      // Send approval email directly (automation won't fire on service role updates)
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
      } catch (emailErr) {
        // Don't fail the approval if email fails
        console.error('Failed to send approval email:', emailErr.message);
      }

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
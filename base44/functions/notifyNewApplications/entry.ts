import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const NAVY = '#0B1F3A';
const ORANGE = '#F26B1F';
const APP_URL = 'https://courtside-by-ai.com/requestmanagement';

const ROLE_LABELS = {
  league_admin: 'League Admin',
  coach: 'Coach',
  player: 'Player',
  viewer: 'Fan'
};

function esc(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function row(label, value) {
  if (value === null || value === undefined || value === '') return '';
  return '<tr>'
    + '<td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;color:#64748B;font-size:13px;white-space:nowrap;vertical-align:top;">' + esc(label) + '</td>'
    + '<td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;color:#0F172A;font-size:14px;">' + value + '</td>'
    + '</tr>';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event.type !== 'create') {
      return Response.json({ success: true });
    }

    const app = data;
    const svc = base44.asServiceRole.entities;

    const leagueIds = new Set();
    if (app.league_id) leagueIds.add(app.league_id);
    (app.league_ids || []).forEach((id) => { if (id) leagueIds.add(id); });
    (app.league_team_pairs || []).forEach((p) => { if (p && p.league_id) leagueIds.add(p.league_id); });

    const teamIds = new Set();
    if (app.team_id) teamIds.add(app.team_id);
    (app.league_team_pairs || []).forEach((p) => { if (p && p.team_id) teamIds.add(p.team_id); });

    const leagueMap = {};
    const teamMap = {};

    await Promise.all(Array.from(leagueIds).map(async (id) => {
      try {
        const found = await svc.League.filter({ id });
        if (found && found[0]) leagueMap[id] = found[0].name;
      } catch (e) { /* leave unresolved */ }
    }));

    await Promise.all(Array.from(teamIds).map(async (id) => {
      try {
        const found = await svc.Team.filter({ id });
        if (found && found[0]) teamMap[id] = found[0].name;
      } catch (e) { /* leave unresolved */ }
    }));

    const nameForLeague = (id) => leagueMap[id] || ('Unknown league (' + String(id).slice(-6) + ')');
    const nameForTeam = (id) => teamMap[id] || ('Unknown team (' + String(id).slice(-6) + ')');

    let leagueBlock = '';
    const pairs = app.league_team_pairs || [];
    if (pairs.length > 0) {
      leagueBlock = pairs.map((p) => {
        const lg = esc(nameForLeague(p.league_id));
        const tm = p && p.team_id ? esc(nameForTeam(p.team_id)) : 'no team chosen';
        return '<div style="margin-bottom:4px;">' + lg + ' &mdash; <span style="color:#475569;">' + tm + '</span></div>';
      }).join('');
    } else if (leagueIds.size > 0) {
      leagueBlock = Array.from(leagueIds).map((id) => '<div style="margin-bottom:4px;">' + esc(nameForLeague(id)) + '</div>').join('');
      if (app.team_id) {
        leagueBlock += '<div style="color:#475569;">Team: ' + esc(nameForTeam(app.team_id)) + '</div>';
      }
    } else if (app.league_name) {
      leagueBlock = esc(app.league_name)
        + '<div style="color:' + ORANGE + ';font-size:12px;margin-top:2px;">New league &mdash; not on Courtside yet</div>';
    } else {
      leagueBlock = '<span style="color:#94A3B8;">None selected</span>';
    }

    const roleLabel = ROLE_LABELS[app.requested_role] || app.requested_role || 'Unknown';

    let phoneCell = '';
    if (app.phone) {
      phoneCell = esc(app.phone)
        + (app.phone_verified
          ? ' <span style="color:#16A34A;font-size:12px;">verified</span>'
          : ' <span style="color:#94A3B8;font-size:12px;">unverified</span>');
    }

    let rows = '';
    rows += row('Name', esc(app.user_name || 'Unknown'));
    rows += row('Email', '<a href="mailto:' + esc(app.user_email) + '" style="color:' + NAVY + ';">' + esc(app.user_email) + '</a>');
    rows += row('Requested role', '<strong>' + esc(roleLabel) + '</strong>');
    rows += row('League', leagueBlock);
    rows += row('Country', esc(app.country));
    rows += row('Phone', phoneCell);
    rows += row('Preferred contact', esc(app.preferred_channel));

    if (app.requested_role === 'player') {
      rows += row('Player name', esc(app.display_name));
      rows += row('Handle', esc(app.handle));
      rows += row('Jersey', esc(app.jersey_number));
    }

    if (app.requested_role === 'league_admin') {
      rows += row('Role in league', esc(app.role_in_league));
      rows += row('League type', esc(app.league_type));
      rows += row('Season starts', esc(app.season_start_date));
      rows += row('Teams', app.number_of_teams ? esc(app.number_of_teams) : '');
      rows += row('Players per team', app.avg_players_per_team ? esc(app.avg_players_per_team) : '');
      if (app.league_fb_page) {
        rows += row('Facebook page', '<a href="' + esc(app.league_fb_page) + '" style="color:' + NAVY + ';">' + esc(app.league_fb_page) + '</a>');
      }
    }

    rows += row('Heard about us', esc(app.heard_from));

    if (app.is_additional_request) {
      rows += row('Type', 'Additional access request<div style="color:#475569;font-size:12px;">Already approved as: ' + esc(app.current_user_type || 'unknown') + '</div>');
    }

    rows += row('Applied', esc(app.applied_at ? new Date(app.applied_at).toLocaleString() : new Date().toLocaleString()));

    const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#FFFFFF;">'
      + '<div style="background:' + NAVY + ';padding:20px 24px;">'
      + '<div style="color:#FFFFFF;font-size:18px;font-weight:bold;">New ' + esc(roleLabel) + ' request</div>'
      + '<div style="color:#94A3B8;font-size:13px;margin-top:4px;">' + esc(app.user_name || app.user_email) + '</div>'
      + '</div>'
      + '<table style="width:100%;border-collapse:collapse;">' + rows + '</table>'
      + '<div style="padding:20px 24px;">'
      + '<a href="' + APP_URL + '" style="display:inline-block;background:' + ORANGE + ';color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;">Review this request</a>'
      + '</div>'
      + '<div style="padding:0 24px 24px;color:#94A3B8;font-size:12px;">Courtside by AI &mdash; Numbers Don\'t Lie</div>'
      + '</div>';

    const subjectLeague = pairs.length > 0
      ? nameForLeague(pairs[0].league_id)
      : (leagueIds.size > 0 ? nameForLeague(Array.from(leagueIds)[0]) : (app.league_name || 'no league'));

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'adwin.imperial@gmail.com',
      subject: roleLabel + ' request: ' + (app.user_name || app.user_email) + ' — ' + subjectLeague,
      body: html
    });

    console.log('Notification email sent for application from ' + app.user_email);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error sending notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
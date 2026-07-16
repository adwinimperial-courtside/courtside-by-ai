import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// MANAGE_REG_CAMPAIGN_V1 — single server-side entry point for registration
// campaigns (SignupCampaign entity) and their per-team coach invite codes
// (CoachInviteCode entity). Both entities are readable only by app_admin,
// so league admins and the public signup page must go through this function.
//
// Admin actions (app_admin for any league; league_admin only for leagues in
// their assigned_league_ids):
//   'create'      — create the campaign for a league AND auto-generate one
//                   random invite code per team in that league.
//   'get'         — campaign + full code list (code values, status, used_by)
//                   for one league.
//   'list_mine'   — campaigns for all leagues the caller administers.
//   'update'      — edit hero_title / season_text / crest_url / colors /
//                   roles_enabled.
//   'set_status'  — open or close the campaign.
//   'rearm_code'  — flip a used code back to active (rejected applicant).
//   'sync_teams'  — generate codes for teams added after campaign creation.
//
// Public action (any signed-in user):
//   'get_public'  — campaign display fields by slug. NEVER returns codes.
//
// Codes look like XXX-YYYY: prefix from the league name initials, 4 random
// characters from an unambiguous alphabet (no 0/O/1/I). Uniqueness is checked
// against ALL existing CoachInviteCode records.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Not signed in' }, { status: 401 });
    }

    const body = await req.json();
    const action = body?.action;
    if (!action) {
      return Response.json({ error: 'action is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole.entities;

    const isAppAdmin = user.user_type === 'app_admin';
    const myLeagueIds =
      user.user_type === 'league_admin' && Array.isArray(user.assigned_league_ids)
        ? user.assigned_league_ids
        : [];

    const canAdmin = (leagueId) =>
      isAppAdmin || myLeagueIds.includes(leagueId);

    // ---------- code generation helpers ----------
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randomChunk = (n) => {
      let out = '';
      const buf = new Uint8Array(n);
      crypto.getRandomValues(buf);
      for (let i = 0; i < n; i++) out += ALPHABET[buf[i] % ALPHABET.length];
      return out;
    };
    const prefixFromName = (name) => {
      const words = String(name || '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
      let p = words.map((w) => w[0]).join('').slice(0, 3);
      if (p.length < 3 && words[0]) p = (p + words[0].slice(1)).slice(0, 3);
      return p || 'CBA';
    };
    const generateCodesForTeams = async (league, teams) => {
      const existing = await svc.CoachInviteCode.list();
      const taken = new Set((existing || []).map((c) => String(c.code || '').toUpperCase()));
      const prefix = prefixFromName(league.name);
      const created = [];
      for (const team of teams) {
        let code = '';
        do {
          code = prefix + '-' + randomChunk(4);
        } while (taken.has(code));
        taken.add(code);
        const rec = await svc.CoachInviteCode.create({
          code,
          league_id: league.id,
          team_id: team.id,
          team_name: team.name,
          status: 'active'
        });
        created.push(rec);
      }
      return created;
    };

    const campaignFor = async (leagueId) => {
      const rows = await svc.SignupCampaign.filter({ league_id: leagueId });
      return rows && rows.length ? rows[0] : null;
    };

    const codesFor = async (leagueId) => {
      const rows = await svc.CoachInviteCode.filter({ league_id: leagueId });
      return (rows || []).map((c) => ({
        id: c.id,
        code: c.code,
        team_id: c.team_id,
        team_name: c.team_name,
        status: c.status,
        used_by_email: c.used_by_email || null,
        used_at: c.used_at || null
      }));
    };

    const publicShape = (c) => ({
      id: c.id,
      league_id: c.league_id,
      slug: c.slug,
      hero_title: c.hero_title || '',
      season_text: c.season_text || '',
      crest_url: c.crest_url || '',
      color_primary: c.color_primary || '#0B1F3A',
      color_accent: c.color_accent || '#F26B1F',
      roles_enabled: Array.isArray(c.roles_enabled) && c.roles_enabled.length ? c.roles_enabled : ['coach'],
      status: c.status || 'open'
    });

    // ---------- public action ----------
    if (action === 'get_public') {
      const slug = String(body.slug || '').toLowerCase().trim();
      if (!slug) return Response.json({ error: 'slug is required' }, { status: 400 });
      const all = await svc.SignupCampaign.list();
      const match = (all || []).find((c) => String(c.slug || '').toLowerCase() === slug);
      if (!match) return Response.json({ error: 'Not found' }, { status: 404 });
      const league = (await svc.League.filter({ id: match.league_id }))?.[0] || null;
      return Response.json({
        campaign: publicShape(match),
        league_name: league ? league.name : ''
      });
    }

    // ---------- admin actions below ----------
    if (action === 'list_mine') {
      const all = await svc.SignupCampaign.list();
      const mine = (all || []).filter((c) => canAdmin(c.league_id));
      return Response.json({ campaigns: mine.map(publicShape) });
    }

    const leagueId = body.league_id;
    if (!leagueId) {
      return Response.json({ error: 'league_id is required' }, { status: 400 });
    }
    if (!canAdmin(leagueId)) {
      return Response.json({ error: 'Not authorized for this league' }, { status: 403 });
    }

    if (action === 'get') {
      const campaign = await campaignFor(leagueId);
      if (!campaign) return Response.json({ campaign: null, codes: [] });
      return Response.json({
        campaign: publicShape(campaign),
        codes: await codesFor(leagueId)
      });
    }

    if (action === 'create') {
      const existing = await campaignFor(leagueId);
      if (existing) {
        return Response.json({ error: 'A campaign already exists for this league. Edit it instead.' }, { status: 400 });
      }
      const league = (await svc.League.filter({ id: leagueId }))?.[0];
      if (!league) return Response.json({ error: 'League not found' }, { status: 404 });

      const teams = (await svc.Team.filter({ league_id: leagueId })) || [];
      if (!teams.length) {
        return Response.json({ error: 'This league has no teams yet. Add teams first, then create registration.' }, { status: 400 });
      }

      let slug = String(body.slug || '').toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
      if (!slug) {
        slug = String(league.name || 'league').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      }
      const all = await svc.SignupCampaign.list();
      const slugTaken = (s) => (all || []).some((c) => String(c.slug || '').toLowerCase() === s);
      if (slugTaken(slug)) {
        let i = 2;
        while (slugTaken(slug + '-' + i)) i++;
        slug = slug + '-' + i;
      }

      const roles = Array.isArray(body.roles_enabled) && body.roles_enabled.length ? body.roles_enabled : ['coach'];

      const campaign = await svc.SignupCampaign.create({
        league_id: leagueId,
        slug,
        hero_title: body.hero_title || league.name || '',
        season_text: body.season_text || '',
        crest_url: body.crest_url || '',
        color_primary: body.color_primary || '#0B1F3A',
        color_accent: body.color_accent || '#F26B1F',
        roles_enabled: roles,
        status: 'open',
        created_by_email: String(user.email || '').toLowerCase()
      });

      let codes = [];
      if (roles.includes('coach')) {
        const existingCodes = await codesFor(leagueId);
        const teamsNeedingCodes = teams.filter((t) => !existingCodes.some((c) => c.team_id === t.id));
        await generateCodesForTeams(league, teamsNeedingCodes);
        codes = await codesFor(leagueId);
      }

      return Response.json({ campaign: publicShape(campaign), codes });
    }

    const campaign = await campaignFor(leagueId);
    if (!campaign) {
      return Response.json({ error: 'No campaign exists for this league yet.' }, { status: 404 });
    }

    if (action === 'update') {
      const patch = {};
      for (const key of ['hero_title', 'season_text', 'crest_url', 'color_primary', 'color_accent']) {
        if (typeof body[key] === 'string') patch[key] = body[key];
      }
      if (Array.isArray(body.roles_enabled) && body.roles_enabled.length) {
        patch.roles_enabled = body.roles_enabled;
      }
      const updated = await svc.SignupCampaign.update(campaign.id, patch);
      return Response.json({ campaign: publicShape(updated || { ...campaign, ...patch }) });
    }

    if (action === 'set_status') {
      const status = body.status === 'closed' ? 'closed' : 'open';
      const updated = await svc.SignupCampaign.update(campaign.id, { status });
      return Response.json({ campaign: publicShape(updated || { ...campaign, status }) });
    }

    if (action === 'rearm_code') {
      const codeId = body.code_id;
      if (!codeId) return Response.json({ error: 'code_id is required' }, { status: 400 });
      const rec = (await svc.CoachInviteCode.filter({ id: codeId }))?.[0];
      if (!rec || rec.league_id !== leagueId) {
        return Response.json({ error: 'Code not found for this league' }, { status: 404 });
      }
      await svc.CoachInviteCode.update(codeId, { status: 'active' });
      return Response.json({ codes: await codesFor(leagueId) });
    }

    if (action === 'sync_teams') {
      const league = (await svc.League.filter({ id: leagueId }))?.[0];
      if (!league) return Response.json({ error: 'League not found' }, { status: 404 });
      const teams = (await svc.Team.filter({ league_id: leagueId })) || [];
      const existingCodes = await codesFor(leagueId);
      const missing = teams.filter((t) => !existingCodes.some((c) => c.team_id === t.id));
      if (missing.length) await generateCodesForTeams(league, missing);
      return Response.json({ codes: await codesFor(leagueId), created_count: missing.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('manageRegistrationCampaign error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
});
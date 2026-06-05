import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me || me.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    let apply = false;
    try { const body = await req.json(); apply = body?.apply === true; } catch (_) {}

    const leagues = await base44.asServiceRole.entities.League.list('', 1000);
    const users = await base44.asServiceRole.entities.User.list('', 1000);

    const usersByEmail = {};
    for (const u of users) {
      if (u.email) usersByEmail[String(u.email).toLowerCase()] = u;
    }

    const isService = (email) =>
      !email || String(email).includes('no-reply.base44.com') || String(email).startsWith('service+');

    const assigned = [];
    const skipped = [];

    for (const league of leagues) {
      if (league.owner_user_id) {
        skipped.push({ league: league.name, reason: 'already has owner' });
        continue;
      }

      let owner = null;
      let how = '';

      // 1) Direct-created league: created_by is a real user email
      if (!isService(league.created_by)) {
        const u = usersByEmail[String(league.created_by).toLowerCase()];
        if (u) { owner = u; how = 'matched created_by email'; }
      }

      // 2) Otherwise: the league admin(s) assigned to this league
      if (!owner) {
        const admins = users.filter(u =>
          (u.user_type === 'league_admin' || u.user_type === 'app_admin') &&
          Array.isArray(u.assigned_league_ids) &&
          u.assigned_league_ids.includes(league.id)
        );
        const leagueAdmins = admins.filter(u => u.user_type === 'league_admin');
        const pool = leagueAdmins.length > 0 ? leagueAdmins : admins;
        if (pool.length === 1) {
          owner = pool[0];
          how = 'single assigned league admin';
        } else if (pool.length > 1) {
          pool.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
          owner = pool[0];
          how = 'ambiguous (' + pool.length + ' admins) - picked earliest, PLEASE VERIFY';
        }
      }

      if (!owner) {
        skipped.push({ league: league.name, id: league.id, reason: 'no owner found - set manually' });
        continue;
      }

      const update = {
        owner_user_id: owner.id,
        owner_email: owner.email,
        owner_name: owner.full_name || '',
      };

      if (apply) {
        await base44.asServiceRole.entities.League.update(league.id, update);
      }

      assigned.push({ league: league.name, id: league.id, owner: owner.email, name: owner.full_name, how });
    }

    return Response.json({
      mode: apply ? 'APPLIED (changes written)' : 'DRY RUN (no changes written; send { "apply": true } to write)',
      total_leagues: leagues.length,
      would_assign: assigned.length,
      skipped: skipped.length,
      assigned,
      skipped_details: skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
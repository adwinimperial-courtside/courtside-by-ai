import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// SECURITY_F2_V1 — public league list. Returns ONLY the fields the join pages need.
// Never return owner_email, owner_name, owner_user_id or any other private field.
const SECURITY_F2_V1 = true;
const PUBLIC_FIELDS = ['id', 'name', 'season', 'group_id', 'is_archived', 'start_date', 'end_date', 'registration_deadline', 'registration_mode'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let leagues = [];
    try {
      leagues = await base44.entities.League.filter({}, '-created_date', 200);
    } catch (e) {
      leagues = await base44.asServiceRole.entities.League.filter({}, '-created_date', 200);
    }

    const safe = (leagues || []).map((l) => {
      const out = {};
      for (const k of PUBLIC_FIELDS) out[k] = (l && l[k] !== undefined) ? l[k] : null;
      return out;
    });

    return Response.json({ leagues: safe });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
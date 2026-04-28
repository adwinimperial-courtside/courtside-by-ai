import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Try user-scoped first (works for app_admin who can see all leagues via RLS)
  // Fall back to asServiceRole
  let leagues = [];
  try {
    leagues = await base44.entities.League.filter({}, '-created_date', 200);
  } catch (e) {
    leagues = await base44.asServiceRole.entities.League.filter({}, '-created_date', 200);
  }

  return Response.json({ leagues });
});
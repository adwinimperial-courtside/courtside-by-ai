import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const leagues = await base44.asServiceRole.entities.League.list('-created_date', 200);
  return Response.json({ leagues });
});
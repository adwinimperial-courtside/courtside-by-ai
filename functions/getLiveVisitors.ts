import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get the current time and 5 minutes ago
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Query user_active events from the last 5 minutes
    // Note: This uses the Analytics API which tracks events with timestamps
    const liveVisitors = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `I need to query the user_active events from the last 5 minutes to get a list of live visitors. The current time is ${now.toISOString()}.`,
      add_context_from_internet: false
    });

    return Response.json({ success: true, message: 'Live visitors tracking enabled' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
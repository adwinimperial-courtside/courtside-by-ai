import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { userIds } = await req.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return Response.json({ error: 'userIds array is required' }, { status: 400 });
    }

    const results = [];
    for (const userId of userIds) {
      const targetUser = await base44.asServiceRole.entities.User.get(userId);
      if (!targetUser) continue;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: targetUser.email,
        subject: "You're approved — complete your league setup on Courtside by AI",
        body: `Hi ${targetUser.full_name || 'there'},\n\nYour Courtside by AI account has been approved, but you haven't been assigned to a league yet.\n\nPlease log in and complete your league selection to get started:\nhttps://courtside-by-ai.com\n\nIf you believe this is an error or need help, please contact your league administrator.\n\nThe Courtside by AI Team`,
      });
      results.push({ userId, email: targetUser.email, sent: true });
    }

    return Response.json({ success: true, sent: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
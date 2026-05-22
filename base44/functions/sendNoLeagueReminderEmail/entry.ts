import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.user_type !== 'app_admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { userIds } = await req.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return Response.json({ error: 'userIds array is required' }, { status: 400 });
    }

    const results = await Promise.all(
      userIds.map(async (userId) => {
        try {
          const targetUser = await base44.asServiceRole.entities.User.get(userId);
          if (!targetUser) return { userId, sent: false };
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: targetUser.email,
            subject: "Join a league on Courtside by AI 🏀",
            body: `Hi ${targetUser.full_name || 'there'},\n\nYour Courtside by AI account is ready!\n\nYou haven't joined a league yet. Log in now to browse available leagues and request access — it only takes a few seconds:\n\n👉 https://courtside-by-ai.com\n\nOnce you're in, select the leagues you want to join and choose your role. Your request will be reviewed and you'll be notified when approved.\n\nSee you on the court!\nThe Courtside by AI Team`,
          });
          await base44.asServiceRole.entities.ReminderLog.create({
            user_id: targetUser.id,
            user_email: targetUser.email,
            user_name: targetUser.full_name || "",
            sent_at: new Date().toISOString(),
            sent_by: user.email || "app_admin",
          });
          return { userId, email: targetUser.email, sent: true };
        } catch (e) {
          return { userId, sent: false, error: e.message };
        }
      })
    );

    return Response.json({
      success: true,
      sent: results.filter((r) => r.sent).length,
      failed: results.filter((r) => !r.sent).length,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
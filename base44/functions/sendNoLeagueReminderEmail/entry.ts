import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ROLE_NUDGE_EMAIL_V1
function buildRoleNudgeHtml(firstName) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  return `
<div style="margin:0;padding:0;background:#eef1f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0B1F3A;">
  <div style="max-width:640px;margin:0 auto;padding:20px 12px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <tr>
        <td style="background:#0B1F3A;padding:28px 32px 22px;text-align:center;">
          <img src="https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/a6f36183f_CourtSidebyAILOGOTransparent.png" alt="Courtside by AI" width="150" style="display:inline-block;height:auto;max-width:150px;">
        </td>
      </tr>
      <tr>
        <td style="background:#F26B1F;padding:12px 32px;text-align:center;">
          <span style="color:#ffffff;font-size:15px;font-weight:600;letter-spacing:.3px;">One step left — choose your role</span>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 4px;">
          <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">${greeting}</p>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#334155;">You're signed up for Courtside — nice. There's one quick step left: your role. But first, the thing that trips almost everyone up.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#fff4ec;border-left:4px solid #F26B1F;padding:16px 18px;">
                <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:#9a3d12;font-weight:600;">Someone has to set your league up on Courtside and run the live scoring. That person is the League Admin.</p>
                <p style="margin:0;font-size:14px;line-height:1.55;color:#7a4a2f;">If that's you &mdash; or nobody's done it yet &mdash; pick <strong>League Admin</strong>. Player, Coach and Fan are only for leagues that are <strong>already</strong> on Courtside.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 10px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#0B1F3A;font-weight:600;">So — which one are you?</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #F26B1F;border-radius:12px;">
            <tr>
              <td style="padding:16px 18px;">
                <span style="display:inline-block;background:#F26B1F;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:.4px;padding:3px 10px;border-radius:20px;margin-bottom:10px;">START HERE IF YOUR LEAGUE ISN'T ON COURTSIDE YET</span>
                <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#0B1F3A;">🏆 League Admin</p>
                <p style="margin:0 0 8px;font-size:14px;color:#475569;font-style:italic;">I run our league — or I want to bring it onto Courtside.</p>
                <p style="margin:0;font-size:14px;line-height:1.55;color:#334155;">You set it up: create the league, add teams, score games live. <strong>This is the role that tracks the stats</strong> — you, or someone you assign. Standings, stats and award races build automatically.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;">
            <tr>
              <td style="padding:16px 18px;">
                <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#0B1F3A;">🏀 Player</p>
                <p style="margin:0 0 8px;font-size:14px;color:#475569;font-style:italic;">I play in a league that's already on Courtside.</p>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#334155;">Your own stat line every game, a profile card that fills up as the season goes, and your team's schedule, results and standings.</p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#b45309;background:#fef6e7;padding:8px 10px;border-radius:8px;">⚠️ Only works if your league is already on Courtside with an admin running it.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;">
            <tr>
              <td style="padding:16px 18px;">
                <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#0B1F3A;">📋 Coach</p>
                <p style="margin:0 0 8px;font-size:14px;color:#475569;font-style:italic;">I coach a team in a league that's already on Courtside.</p>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#334155;">Build and manage your roster, submit your starting five, and use team and player analytics to plan your games.</p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#b45309;background:#fef6e7;padding:8px 10px;border-radius:8px;">⚠️ Only works if your league is already on Courtside with an admin running it.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;">
            <tr>
              <td style="padding:16px 18px;">
                <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#0B1F3A;">👀 Fan</p>
                <p style="margin:0 0 8px;font-size:14px;color:#475569;font-style:italic;">I just want to follow a league that's on Courtside.</p>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#334155;">Live scores, standings, schedules and the award races. Follow any team, from anywhere.</p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#b45309;background:#fef6e7;padding:8px 10px;border-radius:8px;">⚠️ You're following leagues already on Courtside — you don't run anything.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:26px 32px 6px;text-align:center;">
          <a href="https://courtside-by-ai.com" style="display:inline-block;background:#F26B1F;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:10px;">Choose my role &rarr;</a>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 4px;text-align:center;">
          <p style="margin:0;font-size:13px;color:#64748b;">Not sure? Just log in and we'll walk you through it.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 32px 4px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;border-top:1px solid #eef1f4;padding-top:16px;"><strong style="color:#0B1F3A;">Not sure if your league is on Courtside?</strong> Ask whoever organizes it. If nobody's set it up yet — that person needs to be a League Admin. It might be you.</p>
        </td>
      </tr>
      <tr>
        <td style="background:#0B1F3A;padding:22px 32px;text-align:center;">
          <p style="margin:0 0 4px;font-size:13px;color:#ffffff;font-weight:600;">Powered by Courtside by AI</p>
          <p style="margin:0 0 10px;font-size:12px;color:#F26B1F;font-weight:600;letter-spacing:.5px;">Numbers Don't Lie</p>
          <p style="margin:0;font-size:11px;color:#7c8ba1;">You're receiving this because you created a Courtside account. <a href="https://courtside-by-ai.com" style="color:#9fb0c7;">courtside-by-ai.com</a></p>
        </td>
      </tr>
    </table>
  </div>
</div>`;
}

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
          const firstName = (targetUser.full_name || "").split(' ')[0] || null;
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: targetUser.email,
            subject: "One step left — and here's the part people miss",
            body: buildRoleNudgeHtml(firstName),
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
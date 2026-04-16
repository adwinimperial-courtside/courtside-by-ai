import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const LOGO_URL = "https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/453b424ab_CourtSidebyAILOGO.png";

function buildEmailHtml(firstName) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to Courtside by AI</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px;text-align:center;border-bottom:3px solid #f97316;">
              <img src="${LOGO_URL}" alt="Courtside by AI" width="140" style="display:block;margin:0 auto;" />
            </td>
          </tr>

          <!-- Banner -->
          <tr>
            <td style="background-color:#f97316;padding:18px 40px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">Welcome to Courtside by AI 🏀</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px 40px;">
              <p style="margin:0 0 20px 0;font-size:16px;color:#1a2340;font-weight:600;">${greeting}</p>

              <p style="margin:0 0 16px 0;font-size:15px;color:#444;line-height:1.7;">
                Your access to <strong>Courtside by AI</strong> has been approved, and you can now log in at <a href="https://www.courtside-by-ai.com" style="color:#f97316;font-weight:600;text-decoration:none;">www.courtside-by-ai.com</a> using your approved account.
              </p>

              <p style="margin:0 0 24px 0;font-size:15px;color:#444;line-height:1.7;">
                Welcome to a smarter basketball league experience.
              </p>

              <p style="margin:0 0 20px 0;font-size:15px;color:#444;line-height:1.7;">
                Courtside by AI is built to help leagues run more professionally, make games more engaging, and give every type of user a better experience — from organizers and coaches to players and viewers.
              </p>

              <p style="margin:0 0 16px 0;font-size:15px;color:#1a2340;font-weight:700;">Here's what Courtside by AI brings to the game:</p>

              <!-- Role sections -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:#f8f9fc;border-left:4px solid #f97316;border-radius:6px;padding:16px 20px;margin-bottom:12px;">
                    <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:#1a2340;">🏆 For League Organizers</p>
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">Run your league with more structure through live stats, schedules, standings, game management, and automated awards that help bring more credibility and excitement to the competition.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:#f8f9fc;border-left:4px solid #1a2340;border-radius:6px;padding:16px 20px;">
                    <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:#1a2340;">🧠 For Coaches</p>
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">Use Coach Insights and coaching tools to better understand team performance, study trends, and prepare more effectively for every game.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:#f8f9fc;border-left:4px solid #f97316;border-radius:6px;padding:16px 20px;">
                    <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:#1a2340;">🔥 For Players</p>
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">Build your presence through player profiles, track your performance through live stats, and earn badges and recognition that highlight your impact on the court.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="background-color:#f8f9fc;border-left:4px solid #1a2340;border-radius:6px;padding:16px 20px;">
                    <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:#1a2340;">👀 For Viewers</p>
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">Follow the action more closely with access to schedules, standings, game results, and live stats that make every league feel more connected and professional.</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px 0;font-size:15px;color:#444;line-height:1.7;">
                Courtside by AI is more than a scoreboard. It is a platform designed to elevate the entire basketball experience.
              </p>

              <p style="margin:0 0 28px 0;font-size:15px;color:#444;line-height:1.7;">
                Your access is now ready, and we're excited for you to explore what the platform can do.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
                <tr>
                  <td align="center">
                    <a href="https://www.courtside-by-ai.com" style="display:inline-block;background-color:#f97316;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                      Log In to Courtside by AI →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px 0;font-size:15px;color:#444;line-height:1.7;">Welcome to Courtside by AI.</p>
              <p style="margin:16px 0 0 0;font-size:14px;color:#444;line-height:1.7;">
                Best,<br/>
                <strong>Courtside by AI</strong><br/>
                <span style="color:#888;">Basketball League Intelligence</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f4f6f9;padding:24px 40px;text-align:center;border-top:1px solid #e8eaf0;">
              <p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:#1a2340;">Courtside by AI</p>
              <p style="margin:0 0 12px 0;font-size:12px;color:#888;">Basketball League Intelligence</p>
              <p style="margin:0;font-size:12px;color:#aaa;">
                Questions? Contact us at <a href="mailto:info@courtside-by-ai.com" style="color:#f97316;text-decoration:none;">info@courtside-by-ai.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Support both direct call and entity automation payload
    const application = payload.data || payload.application;
    const eventType = payload.event?.type;

    // On create: send immediately (user was already approved via Base44 dashboard)
    // On update: only send when status transitions TO Approved
    if (eventType === 'update') {
      const newStatus = payload.data?.status;
      const oldStatus = payload.old_data?.status;
      if (newStatus !== 'Approved' || oldStatus === 'Approved') {
        return Response.json({ skipped: true, reason: 'Not a new approval' });
      }
    }

    // Skip if email already sent (prevent double-send)
    if (application?.approval_email_sent) {
      return Response.json({ skipped: true, reason: 'Approval email already sent' });
    }

    if (!application?.user_email) {
      return Response.json({ error: 'No user_email in application' }, { status: 400 });
    }

    const firstName = application.user_name?.split(' ')[0] || null;
    const htmlBody = buildEmailHtml(firstName);

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: application.user_email,
      subject: "Welcome to Courtside by AI — built for everyone in the game 🏀",
      body: htmlBody,
      from_name: "Courtside by AI",
    });

    // Mark email as sent to prevent double-sending
    if (application?.id) {
      await base44.asServiceRole.entities.UserApplication.update(application.id, {
        approval_email_sent: true,
      });
    }

    return Response.json({ success: true, sent_to: application.user_email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
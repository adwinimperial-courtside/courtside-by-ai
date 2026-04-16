import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const LOGO_URL = "https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/453b424ab_CourtSidebyAILOGO.png";

function buildEmailHtml(firstName) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your Courtside by AI Access Has Been Approved</title>
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

          <!-- Green approved banner -->
          <tr>
            <td style="background-color:#f97316;padding:18px 40px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">🎉 Your access has been approved!</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px 40px;">
              <p style="margin:0 0 20px 0;font-size:16px;color:#1a2340;font-weight:600;">${greeting}</p>

              <p style="margin:0 0 16px 0;font-size:15px;color:#444;line-height:1.7;">
                Great news — your access request for <strong>Courtside by AI</strong> has been approved.
              </p>

              <p style="margin:0 0 16px 0;font-size:15px;color:#444;line-height:1.7;">
                Welcome to the platform. We're excited to have you join a growing basketball community that uses Courtside by AI for <strong>live stats</strong>, <strong>league management</strong>, <strong>automated awards</strong>, and a more professional game experience.
              </p>

              <!-- Next step box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="background-color:#f8f9fc;border-left:4px solid #f97316;border-radius:6px;padding:20px 24px;">
                    <p style="margin:0 0 12px 0;font-size:15px;font-weight:700;color:#1a2340;">Your next step</p>
                    <p style="margin:0 0 12px 0;font-size:14px;color:#444;line-height:1.6;">
                      Please log in now at <a href="https://www.courtside-by-ai.com" style="color:#f97316;font-weight:600;text-decoration:none;">www.courtside-by-ai.com</a> and complete your setup by selecting:
                    </p>
                    <ul style="margin:0;padding-left:20px;font-size:14px;color:#444;line-height:2;">
                      <li>Your <strong>role</strong></li>
                      <li>Your <strong>league</strong></li>
                    </ul>
                    <p style="margin:12px 0 0 0;font-size:14px;color:#444;line-height:1.6;">
                      Once that is done, you'll be ready to access the right features for your account.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 28px 0;">
                <tr>
                  <td align="center">
                    <a href="https://www.courtside-by-ai.com" style="display:inline-block;background-color:#f97316;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                      Log In to Courtside by AI →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px 0;font-size:15px;color:#444;line-height:1.7;">
                We're glad to have you on board and can't wait for you to experience what Courtside by AI can do for your league.
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

    // Only proceed on update events where status just became Approved
    if (eventType === 'update') {
      const newStatus = payload.data?.status;
      const oldStatus = payload.old_data?.status;
      if (newStatus !== 'Approved' || oldStatus === 'Approved') {
        return Response.json({ skipped: true, reason: 'Not a new approval' });
      }
    }

    if (!application?.user_email) {
      return Response.json({ error: 'No user_email in application' }, { status: 400 });
    }

    const firstName = application.user_name?.split(' ')[0] || null;
    const htmlBody = buildEmailHtml(firstName);

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: application.user_email,
      subject: "Your Courtside by AI access has been approved 🎉",
      body: htmlBody,
      from_name: "Courtside by AI",
    });

    return Response.json({ success: true, sent_to: application.user_email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
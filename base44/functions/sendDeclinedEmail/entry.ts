import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// DECLINE_EMAIL_V1
const LOGO_URL = "https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/453b424ab_CourtSidebyAILOGO.png";

function buildDeclineHtml(firstName) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Update on your Courtside by AI request</title></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background-color:#ffffff;padding:36px 40px;text-align:center;border-bottom:3px solid #1a2340;">
          <img src="${LOGO_URL}" alt="Courtside by AI" width="140" style="display:block;margin:0 auto;" />
        </td></tr>
        <tr><td style="background-color:#1a2340;padding:18px 40px;text-align:center;">
          <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">Update on your request</p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px 40px;">
          <p style="margin:0 0 20px 0;font-size:16px;color:#1a2340;font-weight:600;">${greeting}</p>
          <p style="margin:0 0 16px 0;font-size:15px;color:#444;line-height:1.7;">Thanks for your interest in <strong>Courtside by AI</strong>. After review, your request to join wasn't approved at this time.</p>
          <p style="margin:0 0 16px 0;font-size:15px;color:#444;line-height:1.7;">This can happen for a few reasons — for example, the name or jersey number on your request didn't match your team's roster, or your league organizer didn't recognize the request.</p>
          <p style="margin:0 0 24px 0;font-size:15px;color:#444;line-height:1.7;">If you think this was a mistake, the best next step is to contact your league organizer directly. You're also welcome to sign up again using your name and jersey number exactly as they appear on your team's roster.</p>
          <p style="margin:0 0 4px 0;font-size:15px;color:#444;line-height:1.7;">Thanks again for your interest.</p>
          <p style="margin:16px 0 0 0;font-size:14px;color:#444;line-height:1.7;">Best,<br/><strong>Courtside by AI</strong><br/><span style="color:#888;">Basketball League Intelligence</span></p>
        </td></tr>
        <tr><td style="background-color:#f4f6f9;padding:24px 40px;text-align:center;border-top:1px solid #e8eaf0;">
          <p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:#1a2340;">Courtside by AI</p>
          <p style="margin:0 0 12px 0;font-size:12px;color:#888;">Basketball League Intelligence</p>
          <p style="margin:0;font-size:12px;color:#aaa;">Questions? Contact us at <a href="mailto:info@courtside-by-ai.com" style="color:#f97316;text-decoration:none;">info@courtside-by-ai.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const application = payload.data || payload.application;
    const eventType = payload.event?.type;

    if (eventType) return Response.json({ skipped: true, reason: 'Sent only by direct approval-page call' });
    if (application?.decline_email_sent) return Response.json({ skipped: true, reason: 'Decline email already sent' });
    if (!application?.user_email) return Response.json({ error: 'No user_email in application' }, { status: 400 });

    const firstName = application.user_name?.split(' ')[0] || null;
    const htmlBody = buildDeclineHtml(firstName);

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: application.user_email,
      subject: "Update on your Courtside by AI request",
      body: htmlBody,
      from_name: "Courtside by AI",
    });

    if (application?.id) {
      await base44.asServiceRole.entities.UserApplication.update(application.id, { decline_email_sent: true });
    }

    return Response.json({ success: true, sent_to: application.user_email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
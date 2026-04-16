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
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px;text-align:center;border-bottom:3px solid #f97316;">
              <img src="${LOGO_URL}" alt="Courtside by AI" width="140" style="display:block;margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td style="background-color:#f97316;padding:18px 40px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">🎉 Your access has been approved!</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px 40px;">
              <p style="margin:0 0 20px 0;font-size:16px;color:#1a2340;font-weight:600;">${greeting}</p>
              <p style="margin:0 0 16px 0;font-size:15px;color:#444;line-height:1.7;">
                Great news — your access request for <strong>Courtside by AI</strong> has been approved.
              </p>
              <p style="margin:0 0 16px 0;font-size:15px;color:#444;line-height:1.7;">
                Welcome to the platform. We're excited to have you join a growing basketball community that uses Courtside by AI for <strong>live stats</strong>, <strong>league management</strong>, <strong>automated awards</strong>, and a more professional game experience.
              </p>
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

    // Find all pending, non-additional applications that haven't had an email sent
    const allPending = await base44.asServiceRole.entities.UserApplication.list();
    const toCheck = allPending.filter(a =>
      a.status === 'Pending' &&
      !a.is_additional_request &&
      !a.approval_email_sent
    );

    if (toCheck.length === 0) {
      return Response.json({ skipped: true, reason: 'No pending applications to process' });
    }

    // Get all registered users indexed by user_id
    const allUsers = await base44.asServiceRole.entities.User.list();
    const usersById = {};
    const usersByEmail = {};
    allUsers.forEach(u => {
      usersById[u.id] = u;
      usersByEmail[u.email] = u;
    });

    const results = [];

    for (const app of toCheck) {
      // Check if this user has been registered (approved via Base44 dashboard)
      // When Base44 approves a pending request, the user gets created/registered in our system
      const user = usersById[app.user_id] || usersByEmail[app.user_email];

      if (!user) {
        // User not registered yet — still truly pending, skip
        continue;
      }

      // User exists = they were approved via the Base44 dashboard. Send email.
      const firstName = app.user_name?.split(' ')[0] || user.full_name?.split(' ')[0] || null;
      const emailTo = app.user_email;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: emailTo,
        subject: "Your Courtside by AI access has been approved 🎉",
        body: buildEmailHtml(firstName),
        from_name: "Courtside by AI",
      });

      // Mark email as sent and update status to Approved
      await base44.asServiceRole.entities.UserApplication.update(app.id, {
        status: 'Approved',
        approval_email_sent: true,
      });

      results.push({ email: emailTo, name: app.user_name, action: 'email_sent' });
      console.log(`[INFO] Approval email sent to ${emailTo}`);
    }

    return Response.json({ success: true, processed: results.length, results });
  } catch (error) {
    console.error('[ERROR]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
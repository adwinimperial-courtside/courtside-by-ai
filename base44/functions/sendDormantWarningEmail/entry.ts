import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// DORMANT_WARNING_EMAIL_V1
const LOGO_URL = "https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/453b424ab_CourtSidebyAILOGO.png";

function buildHtml(firstName, leagueName, daysDormant) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Your Courtside league is about to be removed</title></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <tr><td style="background-color:#0B1F3A;padding:28px 40px;text-align:center;">
          <img src="${LOGO_URL}" alt="Courtside by AI" width="140" style="display:block;margin:0 auto 6px auto;" />
          <p style="margin:0;color:#F5C4B3;font-size:12px;letter-spacing:0.5px;">Numbers don't lie</p>
        </td></tr>

        <tr><td style="background-color:#FAEEDA;padding:14px 40px;text-align:center;border-bottom:1px solid #f0e2c2;">
          <p style="margin:0;color:#854F0B;font-size:14px;font-weight:700;">⏱ Your league is on pause — 3 days to keep it</p>
        </td></tr>

        <tr><td style="padding:36px 40px 32px 40px;">
          <p style="margin:0 0 18px 0;font-size:16px;color:#0B1F3A;font-weight:600;">${greeting}</p>

          <p style="margin:0 0 16px 0;font-size:15px;color:#444;line-height:1.7;">
            Your league <strong>${leagueName}</strong> is set up on Courtside — but it has been sitting empty for ${daysDormant} days with no teams and no games. Right now it is taking up a spot we would love to give an active league.
          </p>

          <p style="margin:0 0 22px 0;font-size:15px;color:#444;line-height:1.7;">Before we clear it out, here is what you would be walking away from:</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0;">
            <tr><td style="background-color:#f8f9fc;border-left:4px solid #F26B1F;border-radius:6px;padding:16px 20px;">
              <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#0B1F3A;">The league runs itself</p>
              <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">Standings, schedules, and awards update on their own — way less admin work for you.</p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0;">
            <tr><td style="background-color:#f8f9fc;border-left:4px solid #0B1F3A;border-radius:6px;padding:16px 20px;">
              <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#0B1F3A;">Live stats that build hype</p>
              <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">Real-time box scores, standings, and player profiles that make your league feel pro.</p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
            <tr><td style="background-color:#f8f9fc;border-left:4px solid #F26B1F;border-radius:6px;padding:16px 20px;">
              <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#0B1F3A;">Badges and awards players chase</p>
              <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">Automatic MVPs, scoring streaks, and clutch awards that keep players coming back.</p>
            </td></tr>
          </table>

          <p style="margin:0 0 26px 0;font-size:15px;color:#444;line-height:1.7;">
            Want to keep it? Just <strong>log in and add a team</strong>, or reply to this email, within <strong>3 days</strong>. Do nothing and the empty league gets removed to free up space for leagues that are ready to play.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px 0;">
            <tr><td align="center">
              <a href="https://www.courtside-by-ai.com" style="display:inline-block;background-color:#F26B1F;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 34px;border-radius:8px;">Keep my league — add a team →</a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:12px;color:#999;text-align:center;">${leagueName} · dormant ${daysDormant} days · deadline in 3 days</p>
        </td></tr>

        <tr><td style="background-color:#f4f6f9;padding:24px 40px;text-align:center;border-top:1px solid #e8eaf0;">
          <p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:#0B1F3A;">Courtside by AI</p>
          <p style="margin:0 0 12px 0;font-size:12px;color:#888;">Basketball League Intelligence</p>
          <p style="margin:0;font-size:12px;color:#aaa;">Reply to this email or reach us at <a href="mailto:info@courtside-by-ai.com" style="color:#F26B1F;text-decoration:none;">info@courtside-by-ai.com</a></p>
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
    const user = await base44.auth.me();

    // Only a true app admin can send these warnings.
    if (!user || (user.role !== 'admin' && user.user_type !== 'app_admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const leagueId = payload.league_id;
    const leagueName = payload.league_name || 'your league';
    const ownerEmail = payload.owner_email;
    const ownerName = payload.owner_name || '';
    const daysDormant = payload.days_dormant ?? 0;

    if (!leagueId) return Response.json({ error: 'Missing league_id' }, { status: 400 });
    if (!ownerEmail) return Response.json({ skipped: true, reason: 'No owner email on file for this league' });

    const firstName = ownerName ? ownerName.split(' ')[0] : null;
    const htmlBody = buildHtml(firstName, leagueName, daysDormant);

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: ownerEmail,
      subject: `"${leagueName}" is inactive — 3 days to keep your league`,
      body: htmlBody,
      from_name: "Courtside by AI",
      reply_to: "info@courtside-by-ai.com",
    });

    // Start the 3-day clock by logging the warning.
    const now = new Date();
    const deadline = new Date(now.getTime() + 3 * 86400000);
    const warning = await base44.asServiceRole.entities.DormantWarning.create({
      league_id: leagueId,
      league_name: leagueName,
      owner_email: ownerEmail,
      owner_name: ownerName,
      warned_at: now.toISOString(),
      deadline: deadline.toISOString(),
      status: 'warned',
    });

    return Response.json({ success: true, sent_to: ownerEmail, deadline: deadline.toISOString(), warning_id: warning?.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
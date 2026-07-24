import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ROLE_WELCOME_EMAIL_V1 = true;

const LOGO_URL = "https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/453b424ab_CourtSidebyAILOGO.png";

const NAVY = "#1a2340";
const ORANGE = "#f97316";
const BORDER = "#e2e6ef";

function shell(innerHtml) {
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

          <tr>
            <td style="background-color:#ffffff;padding:36px 40px;text-align:center;border-bottom:3px solid ${ORANGE};">
              <img src="${LOGO_URL}" alt="Courtside by AI" width="140" style="display:block;margin:0 auto;" />
            </td>
          </tr>

          <tr>
            <td style="background-color:${ORANGE};padding:18px 40px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">Welcome to Courtside by AI &#127936;</p>
            </td>
          </tr>

          <tr>
            <td style="padding:36px 32px 32px 32px;">
              ${innerHtml}
            </td>
          </tr>

          <tr>
            <td style="background-color:#f4f6f9;padding:24px 40px;text-align:center;border-top:1px solid #e8eaf0;">
              <p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:${NAVY};">Courtside by AI</p>
              <p style="margin:0 0 12px 0;font-size:12px;color:#888;">Basketball League Intelligence</p>
              <p style="margin:0;font-size:12px;color:#aaa;">
                Questions? Contact us at <a href="mailto:info@courtside-by-ai.com" style="color:${ORANGE};text-decoration:none;">info@courtside-by-ai.com</a>
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

function ctaBlock() {
  return `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center">
                    <a href="https://www.courtside-by-ai.com" style="display:inline-block;background-color:${ORANGE};color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:8px;letter-spacing:0.3px;">
                      Log in to Courtside by AI &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px 0;font-size:14px;color:#666;line-height:1.7;text-align:center;">
                Need help at any point? Tap the <span style="color:${ORANGE};font-weight:700;">?</span> button on any page, or open the Help Center from the menu.
              </p>

              <p style="margin:0;font-size:14px;color:#444;line-height:1.7;">
                Best,<br/>
                <strong style="color:${NAVY};">Courtside by AI</strong><br/>
                <span style="color:#888;">Basketball League Intelligence</span>
              </p>`;
}

function numberBadge(n) {
  return `<span style="display:inline-block;width:26px;height:26px;background-color:${ORANGE};color:#ffffff;border-radius:13px;text-align:center;line-height:26px;font-size:13px;font-weight:700;vertical-align:middle;">${n}</span>`;
}

function coachBody(greeting) {
  return `
              <p style="margin:0 0 18px 0;font-size:16px;color:${NAVY};font-weight:700;">${greeting}</p>

              <p style="margin:0 0 16px 0;font-size:15px;color:#444;line-height:1.7;">
                Your coach access has been approved. You can log in any time at <a href="https://www.courtside-by-ai.com" style="color:${ORANGE};font-weight:700;text-decoration:none;">www.courtside-by-ai.com</a>.
              </p>

              <p style="margin:0 0 16px 0;font-size:15px;color:#444;line-height:1.7;">
                First, the part most coaches ask about: you don't have to record anything. Your league's score committee tracks every game live in Courtside as it's being played. The stats, the box scores and the season records build themselves. You just use them.
              </p>

              <p style="margin:0 0 30px 0;font-size:15px;color:#444;line-height:1.7;">
                Courtside by AI gives coaches something grassroots basketball has rarely had &mdash; a complete record of every game in the season, and the analytics to do something useful with it.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:${NAVY};">Four things you can do from today</p>
                    <table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="width:60px;height:3px;background-color:${ORANGE};font-size:0;line-height:0;">&nbsp;</td></tr></table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px 0;">
                <tr>
                  <td style="border:1px solid ${BORDER};border-radius:10px;padding:20px 22px;">
                    <p style="margin:0 0 10px 0;">
                      ${numberBadge(1)}
                      <span style="display:inline-block;background-color:${ORANGE};color:#ffffff;font-size:10px;font-weight:700;letter-spacing:1px;padding:4px 10px;border-radius:12px;margin-left:8px;vertical-align:middle;">POWERED BY AI</span>
                    </p>
                    <p style="margin:0 0 10px 0;font-size:17px;font-weight:700;color:${NAVY};">&#129302; &nbsp;Get a game plan written for you</p>
                    <p style="margin:0 0 10px 0;font-size:14px;color:#444;line-height:1.7;">Select your next opponent and Courtside's AI reads everything on record for them this season &mdash; every game, every player, every statistic &mdash; then produces a tactical briefing: their strengths, their weaknesses, the players you need to account for, and a proposed game plan for how to approach them.</p>
                    <p style="margin:0 0 10px 0;font-size:14px;color:#444;line-height:1.7;">Preparation that would take hours of film and note-taking is ready in moments.</p>
                    <p style="margin:0 0 12px 0;font-size:14px;color:#444;line-height:1.7;">The more games a team has played, the sharper the briefing gets. Early in a season it works from a smaller sample, so treat it as a starting point rather than the final word.</p>
                    <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background-color:#fff5ed;border-radius:6px;padding:10px 14px;">
                      <p style="margin:0;font-size:13px;color:#8a3d0b;line-height:1.6;"><strong>You have 10 briefings a month</strong>, resetting at the start of each month. If your team needs more during a busy stretch, your league admin can arrange it.</p>
                    </td></tr></table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px 0;">
                <tr>
                  <td style="border:1px solid ${BORDER};border-radius:10px;padding:20px 22px;">
                    <p style="margin:0 0 10px 0;">
                      ${numberBadge(2)}
                      <span style="font-size:10px;font-weight:700;color:#c2570f;letter-spacing:1px;margin-left:8px;vertical-align:middle;">PREPARATION</span>
                    </p>
                    <p style="margin:0 0 10px 0;font-size:17px;font-weight:700;color:${NAVY};">&#128269; &nbsp;Know your opponent, and know your own team</p>
                    <p style="margin:0 0 10px 0;font-size:14px;color:#444;line-height:1.7;">Coach Insights shows you the numbers on any team you're about to face &mdash; their leading scorer, their strongest rebounder, their most effective defender, and which of their players are trending up or down in recent games.</p>
                    <p style="margin:0 0 10px 0;font-size:14px;color:#444;line-height:1.7;">The same view works on your own team. Points, rebounds, assists and turnovers per game. Rebound margin, so you know whether you're winning or losing the boards. Rank your own players by scoring, rebounding, assists or defence, and see who has improved and who has quietly dropped off.</p>
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.7;">Every game of the season is in there. Nothing gets lost between weeks, and nothing depends on what anyone remembers.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px 0;">
                <tr>
                  <td style="border:1px solid ${BORDER};border-radius:10px;padding:20px 22px;">
                    <p style="margin:0 0 10px 0;">
                      ${numberBadge(3)}
                      <span style="font-size:10px;font-weight:700;color:#a32d2d;letter-spacing:1px;margin-left:8px;vertical-align:middle;">LIVE</span>
                    </p>
                    <p style="margin:0 0 10px 0;font-size:17px;font-weight:700;color:${NAVY};">&#128308; &nbsp;Follow games as they happen</p>
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.7;">Live statistics are on screen while the game is being played. Team fouls, timeouts remaining, and every player's live numbers in real time &mdash; no walking over to the score committee, no waiting until it's over to find out your best player picked up his fourth foul.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 30px 0;">
                <tr>
                  <td style="border:1px solid ${BORDER};border-radius:10px;padding:20px 22px;">
                    <p style="margin:0 0 10px 0;">
                      ${numberBadge(4)}
                      <span style="font-size:10px;font-weight:700;color:#c2570f;letter-spacing:1px;margin-left:8px;vertical-align:middle;">COACHING TOOLS</span>
                    </p>
                    <p style="margin:0 0 10px 0;font-size:17px;font-weight:700;color:${NAVY};">&#9999;&#65039; &nbsp;Diagram plays without a clipboard</p>
                    <p style="margin:0 0 10px 0;font-size:14px;color:#444;line-height:1.7;">The Whiteboard turns whatever device you already have &mdash; your phone on the sideline, a tablet in the huddle, or your laptop at home &mdash; into a full tactical board.</p>
                    <p style="margin:0 0 10px 0;font-size:14px;color:#444;line-height:1.7;">Choose half court or full court, then drag your players and the opposition into position with your finger or your mouse. Set up your offence, an inbounds play, a press break, or an end-of-game situation, and walk your players through it exactly as you see it.</p>
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.7;">It opens full screen, so during a timeout the whole board is visible to everyone in the huddle.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 30px 0;">
                <tr>
                  <td style="background-color:${NAVY};border-radius:10px;padding:24px 22px;">
                    <p style="margin:0 0 6px 0;font-size:18px;font-weight:700;color:#ffffff;">&#128640; &nbsp;Getting started</p>
                    <p style="margin:0 0 18px 0;font-size:13px;color:#9aa5c0;">About 10 minutes.</p>

                    <p style="margin:0 0 6px 0;font-size:14px;color:#d5dae6;line-height:1.6;">${numberBadge(1)} <span style="color:#ffffff;font-weight:700;">Open My Roster</span> and check every player and jersey number. Add anyone missing, then mark your roster as done.</p>
                    <p style="margin:0 0 14px 0;font-size:14px;color:#d5dae6;line-height:1.6;">${numberBadge(2)} Open <span style="color:#ffffff;font-weight:700;">Schedule</span> to see your team's fixtures.</p>
                    <p style="margin:0 0 18px 0;font-size:14px;color:#d5dae6;line-height:1.6;">${numberBadge(3)} Open <span style="color:#ffffff;font-weight:700;">Coach Insights</span> and generate a briefing for your next opponent.</p>

                    <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background-color:#26304d;border-radius:8px;padding:14px 16px;">
                      <p style="margin:0 0 10px 0;font-size:13px;color:#d5dae6;line-height:1.65;"><span style="color:${ORANGE};font-weight:700;">Step 1 is the one that matters.</span> Live statistics are recorded against the jersey numbers on your roster, so if a number is wrong, that player's points end up on the wrong line.</p>
                      <p style="margin:0;font-size:13px;color:#9aa5c0;line-height:1.65;">Rosters can be edited while your league's registration window is open. That window is set by your league and closes once your team has played, so do this before your first game. If it's already closed, your league admin can still make changes for you.</p>
                    </td></tr></table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 10px 0;font-size:17px;font-weight:700;color:${NAVY};">Why we built this</p>
              <p style="margin:0 0 14px 0;font-size:15px;color:#444;line-height:1.7;">Grassroots basketball is played with the same commitment as the professional game, but it has rarely been supported like it. Games go unrecorded, performances are forgotten, and the work coaches put in leaves no trace.</p>
              <p style="margin:0 0 14px 0;font-size:15px;color:#444;line-height:1.7;">Courtside exists to close that gap &mdash; real statistics, real analysis, real preparation, and real recognition for the people who earn it.</p>
              <p style="margin:0 0 14px 0;font-size:15px;color:#444;line-height:1.7;">Your players feel that part too. Every one of them gets a profile, their own numbers after every game, badges, and a place in the league leaders. Players who can see their progress tend to invest more in it.</p>
              <p style="margin:0 0 28px 0;font-size:15px;color:${NAVY};line-height:1.7;font-weight:700;">We're glad to have you with us, coach. Let's make your season count.</p>
${ctaBlock()}`;
}

function genericBody(greeting) {
  return `
              <p style="margin:0 0 20px 0;font-size:16px;color:${NAVY};font-weight:600;">${greeting}</p>

              <p style="margin:0 0 16px 0;font-size:15px;color:#444;line-height:1.7;">
                Your access to <strong>Courtside by AI</strong> has been approved, and you can now log in at <a href="https://www.courtside-by-ai.com" style="color:${ORANGE};font-weight:600;text-decoration:none;">www.courtside-by-ai.com</a> using your approved account.
              </p>

              <p style="margin:0 0 24px 0;font-size:15px;color:#444;line-height:1.7;">Welcome to a smarter basketball league experience.</p>

              <p style="margin:0 0 20px 0;font-size:15px;color:#444;line-height:1.7;">
                Courtside by AI is built to help leagues run more professionally, make games more engaging, and give every type of user a better experience &mdash; from organizers and coaches to players and viewers.
              </p>

              <p style="margin:0 0 16px 0;font-size:15px;color:${NAVY};font-weight:700;">Here's what Courtside by AI brings to the game:</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
                <tr>
                  <td style="background-color:#f8f9fc;border-left:4px solid ${ORANGE};padding:16px 20px;">
                    <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:${NAVY};">&#127942; For League Organizers</p>
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">Run your league with more structure through live stats, schedules, standings, game management, and automated awards that help bring more credibility and excitement to the competition.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
                <tr>
                  <td style="background-color:#f8f9fc;border-left:4px solid ${NAVY};padding:16px 20px;">
                    <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:${NAVY};">&#129504; For Coaches</p>
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">Use Coach Insights and coaching tools to better understand team performance, study trends, and prepare more effectively for every game.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
                <tr>
                  <td style="background-color:#f8f9fc;border-left:4px solid ${ORANGE};padding:16px 20px;">
                    <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:${NAVY};">&#128293; For Players</p>
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">Build your presence through player profiles, track your performance through live stats, and earn badges and recognition that highlight your impact on the court.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="background-color:#f8f9fc;border-left:4px solid ${NAVY};padding:16px 20px;">
                    <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:${NAVY};">&#128064; For Viewers</p>
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
${ctaBlock()}`;
}

function buildEmailHtml(firstName, role) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  if (role === 'coach') return shell(coachBody(greeting));
  return shell(genericBody(greeting));
}

function buildSubject(role) {
  if (role === 'coach') return "Your Courtside coach access is ready \u{1F3C0}";
  return "Welcome to Courtside by AI \u2014 built for everyone in the game \u{1F3C0}";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const application = payload.data || payload.application;
    const eventType = payload.event?.type;

    if (eventType) {
      return Response.json({ skipped: true, reason: 'Email is only sent by the request-page approval, not by automations' });
    }

    if (application?.approval_email_sent) {
      return Response.json({ skipped: true, reason: 'Approval email already sent' });
    }

    if (!application?.user_email) {
      return Response.json({ error: 'No user_email in application' }, { status: 400 });
    }

    const role = (application.requested_role || '').toLowerCase();
    const firstName = application.user_name?.split(' ')[0] || null;
    const htmlBody = buildEmailHtml(firstName, role);

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: application.user_email,
      subject: buildSubject(role),
      body: htmlBody,
      from_name: "Courtside by AI",
    });

    if (application?.id) {
      await base44.asServiceRole.entities.UserApplication.update(application.id, {
        approval_email_sent: true,
      });
    }

    return Response.json({ success: true, sent_to: application.user_email, role_template: role === 'coach' ? 'coach' : 'generic' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
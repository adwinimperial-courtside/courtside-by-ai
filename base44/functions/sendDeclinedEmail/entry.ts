import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// DECLINE_REASONS_V1 — reason-aware decline email.
// The admin picks a reason on the User Requests page; that code selects the headline,
// explanation and "what to do next" below. Unknown or missing code falls back to GENERIC,
// which is the wording this email used before reasons existed.
const LOGO_URL = "https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/453b424ab_CourtSidebyAILOGO.png";

const GENERIC = {
  head: "Update on your request",
  body: [
    "Thanks for your interest in Courtside by AI. After review, your request to join wasn't approved at this time.",
    "This can happen for a few reasons — for example, the name or jersey number on your request didn't match your team's roster, or your league organiser didn't recognise the request.",
  ],
  next: "If you think this was a mistake, the best next step is to contact your league organiser directly.",
  reapply: false,
  short: "Your request wasn't approved this time.",
};

const REASONS = {
  player_not_on_roster: {
    head: "We couldn't find you on that roster",
    body: [
      "Your league organiser reviewed your request and couldn't find your name on the roster for the team you selected.",
      "Usually this just means the roster hasn't been updated yet — not that anything is wrong.",
    ],
    next: "Ask your coach or league organiser to add you to the team roster first. Once you're on it, sign up again and you'll be approved.",
    reapply: true,
    short: "We couldn't find you on that team's roster.",
  },
  player_details_mismatch: {
    head: "Your details didn't match the roster",
    body: [
      "Your league organiser couldn't match the name and jersey number you entered to anyone on that team's roster.",
      "A different spelling or an old shirt number is the usual cause.",
    ],
    next: "Sign up again using your name and jersey number exactly as they appear on your team's roster.",
    reapply: true,
    short: "Your name or jersey number didn't match the roster.",
  },
  invalid_name: {
    head: "We need your real name on the request",
    body: [
      "The name on your request doesn't look like a full name — it may have been a nickname, initials, or left unfinished.",
      "Courtside puts your name on rosters, box scores, standings and stat leaderboards, so it has to be the name your league actually knows you by.",
    ],
    next: "Sign up again using your full first and last name, spelled the way it appears on your team's roster.",
    reapply: true,
    short: "The name on the request wasn't a full real name.",
  },
  player_slot_claimed: {
    head: "That roster spot is already linked to another account",
    body: [
      "The player you selected is already connected to a different Courtside account, so we couldn't link it to yours.",
      "If you've signed up before with another email, that older account may already have your stats.",
    ],
    next: "Contact your league organiser — they can free up the spot and approve you, or help you get back into your original account.",
    reapply: false,
    short: "That roster spot is already linked to another account.",
  },
  coach_not_listed: {
    head: "You're not listed as a coach for that team",
    body: [
      "Your league organiser doesn't currently have you recorded as part of that team's coaching staff.",
    ],
    next: "Ask your league organiser to confirm you as a coach for the team. Once they have, sign up again and you'll be approved.",
    reapply: true,
    short: "You're not listed as a coach for that team.",
  },
  coach_staff_full: {
    head: "That team's coaching staff is already full",
    body: [
      "Courtside allows up to two coaches per team — a head coach and one assistant. Both spots on that team are already taken.",
      "If one of those should be yours, it's a quick fix on the organiser's side.",
    ],
    next: "Contact your league organiser. They can free up a coaching spot and approve your request.",
    reapply: false,
    short: "That team's coaching staff is already full.",
  },
  wrong_league_team: {
    head: "It looks like the wrong league or team was selected",
    body: [
      "The league or team on your request doesn't look like the one you actually belong to.",
    ],
    next: "Sign up again and pick the correct league and team from the list.",
    reapply: true,
    short: "The wrong league or team was selected.",
  },
  not_recognised: {
    head: "Your league organiser didn't recognise this request",
    body: [
      "We check every request with the person who runs the league, and they weren't able to confirm this one.",
      "This is a safeguard — it keeps rosters and stats accurate for everyone.",
    ],
    next: "Get in touch with your league organiser directly. Once they can confirm who you are, you're welcome to request access again.",
    reapply: false,
    short: "Your league organiser didn't recognise the request.",
  },
  league_private: {
    head: "This league is invite only",
    body: [
      "The organiser of this league has chosen to keep it closed, so it isn't open to public followers right now.",
    ],
    next: "If you should have access, ask the league organiser to invite you directly.",
    reapply: false,
    short: "This league is invite only.",
  },
  league_already_exists: {
    head: "This league is already set up on Courtside",
    body: [
      "Someone is already running this league on Courtside, so we can't create a second copy of it — that would split the stats and standings in two.",
    ],
    next: "Get in touch with whoever set it up. They can add you as a coach, a player, or a co-admin on the existing league. Please don't sign up again as a new league — it would create a duplicate.",
    reapply: false,
    short: "This league is already set up on Courtside.",
  },
  not_organiser: {
    head: "We couldn't confirm that you run this league",
    body: [
      "League Admin is the role that creates the league, adds the teams and records the live stats — so we only approve it for the people who actually organise the competition.",
    ],
    next: "If you do run this league, reply to this email with a link to your league's page or group and we'll get you set up. If you play or coach in it, sign up again as a Player or Coach instead.",
    reapply: true,
    short: "We couldn't confirm you run this league.",
  },
  insufficient_info: {
    head: "We need a bit more detail before we can set you up",
    body: [
      "Your request was missing some of the information we need to build your league properly — things like the league name, country, number of teams and when the season starts.",
    ],
    next: "Sign up again with those details filled in and we'll get your league live.",
    reapply: true,
    short: "The request was missing details we need.",
  },
  duplicate_request: {
    head: "You've already got a request in for this",
    body: [
      "We already have a request from you covering the same league, so this one was closed as a duplicate. Nothing is lost — the original is still being handled.",
    ],
    next: "Just sign in with the account you used the first time. If you can't get in, reply to this email and we'll sort it out.",
    reapply: false,
    short: "Closed as a duplicate of an earlier request.",
  },
  other: {
    head: "Update on your request",
    body: [
      "Your request to join wasn't approved this time. Here's what your league organiser said:",
    ],
    next: "If you think this was a mistake, contact your league organiser directly.",
    reapply: false,
    short: "Your request wasn't approved this time.",
  },
};

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveReason(code) {
  if (code && Object.prototype.hasOwnProperty.call(REASONS, code)) return REASONS[code];
  return GENERIC;
}

// Builds the per-league block used when one application was rejected across several
// leagues for DIFFERENT reasons. One row per league, each with its own short line.
function leagueRowsHtml(rejections) {
  return rejections.map((r) => {
    const reason = resolveReason(r && r.reason_code);
    const name = esc((r && r.league_name) || "Your league");
    return '<tr><td style="border:1px solid #e8eaf0;padding:12px 14px;background:#fafbfd;border-radius:6px;">'
      + '<p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:#1a2340;">' + name + '</p>'
      + '<p style="margin:0;font-size:13.5px;color:#555;line-height:1.6;">' + esc(reason.short) + '</p>'
      + '</td></tr><tr><td style="height:8px;line-height:8px;">&nbsp;</td></tr>';
  }).join("");
}

function buildDeclineHtml(firstName, reason, note, rejections) {
  const greeting = firstName ? "Hi " + esc(firstName) + "," : "Hi there,";

  let paras = reason.body
    .map((p) => '<p style="margin:0 0 16px 0;font-size:15px;color:#444;line-height:1.7;">' + esc(p) + '</p>')
    .join("");

  if (rejections && rejections.length > 1) {
    paras += '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;border-collapse:separate;">'
      + leagueRowsHtml(rejections) + '</table>';
  }

  const noteText = (note || "").trim();
  const noteBlock = noteText
    ? '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;"><tr>'
      + '<td style="border-left:3px solid #f97316;padding:12px 16px;background:#f8fafc;">'
      + '<p style="margin:0 0 6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#888;font-weight:700;">Note from your league organiser</p>'
      + '<p style="margin:0;font-size:14.5px;color:#333;line-height:1.65;font-style:italic;">&ldquo;' + esc(noteText) + '&rdquo;</p>'
      + '</td></tr></table>'
    : "";

  const ctaBlock = reason.reapply
    ? '<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;"><tr><td align="center">'
      + '<a href="https://courtside-by-ai.com" style="display:inline-block;background:#F26B1F;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 30px;border-radius:8px;">Sign up again</a>'
      + '</td></tr></table>'
    : "";

  return '<!DOCTYPE html>\n'
+ '<html lang="en">\n'
+ '<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Update on your Courtside by AI request</title></head>\n'
+ '<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;">\n'
+ '  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">\n'
+ '    <tr><td align="center">\n'
+ '      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">\n'
+ '        <tr><td style="background-color:#ffffff;padding:32px 40px;text-align:center;border-bottom:3px solid #1a2340;">\n'
+ '          <img src="' + LOGO_URL + '" alt="Courtside by AI" width="130" style="display:block;margin:0 auto;" />\n'
+ '        </td></tr>\n'
+ '        <tr><td style="background-color:#1a2340;padding:18px 40px;text-align:center;">\n'
+ '          <p style="margin:0;color:#ffffff;font-size:17px;font-weight:700;letter-spacing:0.3px;">' + esc(reason.head) + '</p>\n'
+ '        </td></tr>\n'
+ '        <tr><td style="padding:36px 40px 30px 40px;">\n'
+ '          <p style="margin:0 0 20px 0;font-size:16px;color:#1a2340;font-weight:600;">' + greeting + '</p>\n'
+ '          ' + paras + '\n'
+ '          ' + noteBlock + '\n'
+ '          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;"><tr>\n'
+ '            <td style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px 18px;">\n'
+ '              <p style="margin:0 0 6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.7px;color:#c2410c;font-weight:700;">What to do next</p>\n'
+ '              <p style="margin:0;font-size:14.5px;color:#7c2d12;line-height:1.65;">' + esc(reason.next) + '</p>\n'
+ '            </td></tr></table>\n'
+ '          ' + ctaBlock + '\n'
+ '          <p style="margin:0;font-size:14px;color:#444;line-height:1.7;">Thanks for your interest &mdash; we hope to see you on the court soon.</p>\n'
+ '          <p style="margin:16px 0 0 0;font-size:14px;color:#444;line-height:1.7;">Best,<br/><strong>Courtside by AI</strong><br/><span style="color:#888;">Numbers Don\'t Lie</span></p>\n'
+ '        </td></tr>\n'
+ '        <tr><td style="background-color:#f4f6f9;padding:22px 40px;text-align:center;border-top:1px solid #e8eaf0;">\n'
+ '          <p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:#1a2340;">Courtside by AI</p>\n'
+ '          <p style="margin:0 0 12px 0;font-size:12px;color:#888;">Basketball League Intelligence</p>\n'
+ '          <p style="margin:0;font-size:12px;color:#aaa;">Questions? Contact us at <a href="mailto:info@courtside-by-ai.com" style="color:#f97316;text-decoration:none;">info@courtside-by-ai.com</a></p>\n'
+ '        </td></tr>\n'
+ '      </table>\n'
+ '    </td></tr>\n'
+ '  </table>\n'
+ '</body>\n'
+ '</html>';
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

    // league_rejections: [{ league_name, reason_code }] — one entry per rejected league.
    const rejections = Array.isArray(application.league_rejections) ? application.league_rejections.filter(Boolean) : [];
    const codes = rejections.map((r) => r && r.reason_code).filter(Boolean);
    const allSame = codes.length > 0 && codes.every((c) => c === codes[0]);

    let reason;
    let usedMode;
    if (rejections.length > 1 && !allSame) {
      // Mixed reasons across leagues — list each league with its own line.
      const anyReapply = codes.some((c) => resolveReason(c).reapply);
      reason = {
        head: "Update on your request",
        body: ["You asked to join more than one league on Courtside. None could be approved this time — here's what each organiser said:"],
        next: "Check the notes above for each league, then get in touch with the organiser or sign up again with the corrected details.",
        reapply: anyReapply,
        short: "",
      };
      usedMode = 'multi';
    } else {
      const code = application.decline_reason_code || (allSame ? codes[0] : null);
      reason = resolveReason(code);
      usedMode = code && REASONS[code] ? 'reason' : 'generic';
    }

    const firstName = application.user_name?.split(' ')[0] || null;
    const htmlBody = buildDeclineHtml(firstName, reason, application.decline_reason_note, rejections);

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: application.user_email,
      subject: "Update on your Courtside by AI request",
      body: htmlBody,
      from_name: "Courtside by AI",
    });

    if (application?.id) {
      await base44.asServiceRole.entities.UserApplication.update(application.id, { decline_email_sent: true });
    }

    return Response.json({ success: true, sent_to: application.user_email, mode: usedMode, reason_code: application.decline_reason_code || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// MANAGE_VIDEO_ADMINS_V1 — single backend function behind the Stream Crew panel
// and the Accept Invitation page.
//
// Why a function: VideoAdminInvite is readable only by app_admin, and granting a
// role requires writing to the User entity, which league admins cannot do
// directly. Everything therefore runs here with the service role, and every
// action re-checks the caller's authority server-side.
//
// Actions and who may call them:
//   'list'          — app_admin, league_admin. Pending invites + active video
//                     admins for the leagues the caller controls.
//   'invite'        — app_admin, league_admin. Creates the invite and emails it.
//   'resend'        — app_admin, league_admin. Refreshes the expiry and re-sends.
//   'cancel'        — app_admin, league_admin. Withdraws a pending invite.
//   'remove_access' — app_admin, league_admin. Withdraws a granted video admin.
//   'check'         — any signed-in user. Looks up a pending invite matching the
//                     caller's own signed-in email. Never accepts anything.
//   'accept'        — any signed-in user. Grants the role for their own invite.
//
// CONSENT_GATE_V1: 'accept' is a self-service grant, so consent is recorded and re-read
// HERE before anything is written. The page used to do that from the browser, which meant a
// caller who skipped the page got the role with no consent at all.
//
// Role model: a granted video admin gets the league appended to
// assigned_league_ids and league_role_map[league_id] = 'video_admin'. The global
// user_type is set to 'video_admin' ONLY when the account has no meaningful role
// yet (blank, 'user', 'viewer' or already 'video_admin'). A coach or player who
// runs the stream for a different league keeps their existing global role, and
// the per-league map is what marks them as video admin there.
//
// No UserLeagueIdentity row is written. That entity's role enum has no
// 'video_admin' value, and useEffectiveRole falls back to the global user_type
// when no identity row exists, which resolves correctly for this role.

const INVITE_DAYS = 14;
const ACCEPT_URL = 'https://courtside-by-ai.com/AcceptInvite';
const LOGO_URL = 'https://media.base44.com/images/public/68fa0e7f8bbf24ed563563de/453b424ab_CourtSidebyAILOGO.png';
const NAVY = '#1a2340';
const ORANGE = '#f97316';

const PAGE = 1000;
const MAX_PAGES = 25;

// base44 silently caps a single list response at roughly 1,500 rows regardless
// of the requested limit, so every full-table read here pages until a short or
// empty page comes back.
async function listAll(entity) {
  const out = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const batch = await entity.list('-created_date', PAGE, i * PAGE);
    if (!batch || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

const lower = (s) => String(s || '').trim().toLowerCase();

function isValidEmail(s) {
  const v = lower(s);
  return v.length > 3 && v.includes('@') && v.includes('.') && !v.includes(' ');
}

function roleLabel(role) {
  const map = {
    league_admin: 'League Admin',
    coach: 'Coach',
    player: 'Player',
    viewer: 'Fan',
    video_admin: 'Stream Crew',
    ops_admin: 'Operations Admin',
    app_admin: 'App Admin',
  };
  return map[role] || role || 'a member';
}

// ROLE_ARTICLE_V1 — "a Coach" but "an App Admin". roleLabel's own fallback
// ('a member') already carries its article, so it is returned untouched.
function roleWithArticle(role) {
  const label = roleLabel(role);
  if (label === 'a member') return label;
  return `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`;
}

// The role a user effectively holds inside one league: the per-league entry
// wins, otherwise their global type. Mirrors useEffectiveRole on the frontend.
function roleInLeague(user, leagueId) {
  if (!user) return null;
  const assigned = Array.isArray(user.assigned_league_ids) ? user.assigned_league_ids : [];
  const map = (user.league_role_map && typeof user.league_role_map === 'object') ? user.league_role_map : {};
  if (map[leagueId]) return map[leagueId];
  if (!assigned.includes(leagueId)) return null;
  return user.user_type || 'viewer';
}

// CONSENT_GATE_V1 — consent counts as on record when the account carries the accepted flag
// (CONSENT_FIELDS_V1) or when an append-only ConsentLog row exists (CONSENT_LOG_V1). Either
// one proves acceptance. A missing or unreadable ConsentLog is never treated as proof.
// Same two proofs, and the same order of operations, as approveUserApplication.
//
// No grandfathering clause is needed on this path: AcceptInvite shows the consent step to
// anyone whose account does not already carry the accepted flag, so every caller who comes
// through the page can pass this gate, and only a caller who skipped the page cannot.
async function hasConsentOnRecord(base44, userId, user) {
  if (user && user.privacy_terms_accepted === true) return true;
  try {
    const rows = await base44.asServiceRole.entities.ConsentLog.filter({ user_id: userId });
    if (rows && rows.length > 0) return true;
  } catch (_e) { /* absence of a log is not proof of consent */ }
  return false;
}

// CONSENT_GATE_V1 — write the consent the page just collected, server-side and awaited, so
// the gate below reads a record that is definitely there. PrivacyConsentStep writes the same
// thing from the browser but deliberately swallows every failure ("this must NEVER block or
// delay registration"), which is fine while a human reviews a request and fatal on a path
// that grants a role on the spot. Returns false if nothing could be written; the gate, not
// this function, decides what that means.
async function recordConsentFromPayload(base44, userId, userEmail, consent, leagueId) {
  if (!consent || consent.privacy_terms_accepted !== true) return false;
  const acceptedAt = consent.privacy_terms_accepted_at || new Date().toISOString();
  const marketing = consent.marketing_email_consent === true;
  const userUpdate = {
    privacy_terms_accepted: true,
    privacy_terms_accepted_at: acceptedAt,
    marketing_email_consent: marketing,
    consent_version: consent.consent_version || '',
  };
  if (marketing) userUpdate.marketing_email_consent_at = consent.marketing_email_consent_at || acceptedAt;
  try {
    await base44.asServiceRole.entities.User.update(userId, userUpdate);
  } catch (_e) {
    return false;
  }
  // The append-only log is a second record of the same acceptance. The browser may already
  // have written one, so only add a row when this user has none at all.
  try {
    const rows = await base44.asServiceRole.entities.ConsentLog.filter({ user_id: userId });
    if (!rows || rows.length === 0) {
      await base44.asServiceRole.entities.ConsentLog.create({
        user_id: userId,
        user_email: userEmail || '',
        consent_version: consent.consent_version || '',
        privacy_terms_accepted: true,
        marketing_email_consent: marketing,
        accepted_at: acceptedAt,
        league_id: leagueId || '',
        role: 'video_admin',
        source: 'AcceptInvite',
      });
    }
  } catch (_e) { /* the account fields written above already prove acceptance */ }
  return true;
}

function callerLeagueIds(caller) {
  return Array.isArray(caller.assigned_league_ids) ? caller.assigned_league_ids : [];
}

function canManageLeague(caller, leagueId) {
  if (caller.user_type === 'app_admin') return true;
  if (caller.user_type !== 'league_admin') return false;
  return callerLeagueIds(caller).includes(leagueId);
}

function emailHtml(inviteeName, inviterName, leagueName, invitedEmail, expiresLabel) {
  const greeting = inviteeName ? `Hi ${inviteeName},` : 'Hi,';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>You have been invited to the Stream Crew</title></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background-color:#ffffff;padding:36px 40px;text-align:center;border-bottom:3px solid ${ORANGE};">
          <img src="${LOGO_URL}" alt="Courtside by AI" width="140" style="display:block;margin:0 auto;" />
        </td></tr>
        <tr><td style="background-color:${ORANGE};padding:18px 40px;text-align:center;">
          <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">You are invited to run the stream</p>
        </td></tr>
        <tr><td style="padding:36px 32px 32px 32px;">
          <p style="margin:0 0 16px 0;font-size:15px;color:#333;">${greeting}</p>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#333;">
            <strong>${inviterName}</strong> has invited you to join the <strong>Stream Crew</strong> on Courtside by AI for <strong>${leagueName}</strong>.
            You will be able to set up the live game overlay &mdash; team logos, the score bug and the on-screen ticker &mdash; for every game in the league.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
            <tr><td style="background-color:#fff7ed;border-left:4px solid ${ORANGE};padding:16px 18px;border-radius:0 8px 8px 0;">
              <p style="margin:0 0 6px 0;font-size:14px;font-weight:700;color:#9a3412;">Register with this exact email address:</p>
              <p style="margin:0 0 6px 0;font-size:16px;font-weight:700;color:#7c2d12;">${invitedEmail}</p>
              <p style="margin:0;font-size:13px;color:#9a3412;">If you sign up with a different address we will not be able to find your invitation.</p>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${ACCEPT_URL}" style="display:inline-block;background-color:${ORANGE};color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:8px;font-size:16px;font-weight:700;">Accept invitation</a>
          </td></tr></table>
          <p style="margin:18px 0 0 0;font-size:13px;color:#888;text-align:center;">This invitation expires on ${expiresLabel}.</p>
        </td></tr>
        <tr><td style="background-color:#f4f6f9;padding:24px 40px;text-align:center;border-top:1px solid #e8eaf0;">
          <p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:${NAVY};">Courtside by AI</p>
          <p style="margin:0 0 12px 0;font-size:12px;color:#888;">Numbers Don't Lie</p>
          <p style="margin:0;font-size:12px;color:#aaa;">You received this because a league admin invited you. Questions? <a href="mailto:info@courtside-by-ai.com" style="color:${ORANGE};text-decoration:none;">info@courtside-by-ai.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendInviteEmail(base44, invite, inviterName, inviteeName) {
  const expiresLabel = new Date(invite.expires_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  await base44.asServiceRole.integrations.Core.SendEmail({
    to: invite.email,
    subject: `You have been invited to run the stream for ${invite.league_name || 'your league'}`,
    body: emailHtml(inviteeName, inviterName, invite.league_name || 'your league', invite.email, expiresLabel),
    from_name: 'Courtside by AI',
  });
}

async function findUserByEmail(base44, email) {
  const target = lower(email);
  try {
    const direct = await base44.asServiceRole.entities.User.filter({ email: target });
    if (direct && direct.length) return direct[0];
  } catch (_e) { /* fall through to scan */ }
  const all = await listAll(base44.asServiceRole.entities.User);
  return (all || []).find((u) => lower(u.email) === target) || null;
}

async function leagueNameFor(base44, leagueId) {
  try {
    const rows = await base44.asServiceRole.entities.League.filter({ id: leagueId });
    if (rows && rows[0] && rows[0].name) return rows[0].name;
  } catch (_e) { /* display only */ }
  return '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Not signed in' }, { status: 401 });

    const body = await req.json();
    const action = body && body.action;
    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    const ADMIN_ACTIONS = ['list', 'invite', 'resend', 'cancel', 'remove_access'];
    const isAdminCaller = caller.user_type === 'app_admin' || caller.user_type === 'league_admin';

    if (ADMIN_ACTIONS.includes(action) && !isAdminCaller) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ---------------------------------------------------------------- list
    if (action === 'list') {
      const allLeagues = await base44.asServiceRole.entities.League.list('name');
      const visibleLeagues = caller.user_type === 'app_admin'
        ? (allLeagues || [])
        : (allLeagues || []).filter((l) => callerLeagueIds(caller).includes(l.id));
      const visibleIds = visibleLeagues.map((l) => l.id);

      const allInvites = await listAll(base44.asServiceRole.entities.VideoAdminInvite);
      const now = Date.now();
      const pending = (allInvites || [])
        .filter((i) => i.status === 'pending' && visibleIds.includes(i.league_id))
        .map((i) => ({
          id: i.id,
          email: i.email,
          league_id: i.league_id,
          league_name: i.league_name || '',
          invited_by_name: i.invited_by_name || '',
          invited_at: i.invited_at || null,
          last_sent_at: i.last_sent_at || null,
          expires_at: i.expires_at || null,
          send_count: i.send_count || 1,
          expired: !!(i.expires_at && new Date(i.expires_at).getTime() < now),
        }));

      const allUsers = await listAll(base44.asServiceRole.entities.User);
      const active = [];
      for (const u of (allUsers || [])) {
        for (const lid of visibleIds) {
          if (roleInLeague(u, lid) === 'video_admin') {
            const league = visibleLeagues.find((l) => l.id === lid);
            active.push({
              user_id: u.id,
              full_name: u.full_name || '',
              email: u.email || '',
              league_id: lid,
              league_name: league ? league.name : '',
            });
          }
        }
      }

      return Response.json({
        leagues: visibleLeagues.map((l) => ({ id: l.id, name: l.name })),
        pending,
        active,
      });
    }

    // -------------------------------------------------------------- invite
    if (action === 'invite') {
      const email = lower(body.email);
      const leagueId = body.league_id;
      if (!isValidEmail(email)) {
        return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
      }
      if (!leagueId) {
        return Response.json({ error: 'Choose a league.' }, { status: 400 });
      }
      if (!canManageLeague(caller, leagueId)) {
        return Response.json({ error: 'You do not manage that league.' }, { status: 403 });
      }

      const leagueName = await leagueNameFor(base44, leagueId);

      // Same-league role conflict: one person holds one role per league.
      const existingUser = await findUserByEmail(base44, email);
      if (existingUser) {
        const held = roleInLeague(existingUser, leagueId);
        if (held === 'video_admin') {
          return Response.json({
            error: `${existingUser.full_name || email} is already on the Stream Crew in ${leagueName || 'that league'}.`,
          }, { status: 400 });
        }
        if (held) {
          return Response.json({
            error: `${existingUser.full_name || email} is already ${roleWithArticle(held)} in ${leagueName || 'that league'}. One person can hold only one role per league. Invite a different person, or remove their existing role on the People page first.`,
          }, { status: 400 });
        }
      }

      const allInvites = await listAll(base44.asServiceRole.entities.VideoAdminInvite);
      const dupe = (allInvites || []).find(
        (i) => i.status === 'pending' && lower(i.email) === email && i.league_id === leagueId
      );
      if (dupe) {
        return Response.json({
          error: `${email} already has a pending invitation for ${leagueName || 'that league'}. Use Resend below instead.`,
        }, { status: 400 });
      }

      const nowIso = new Date().toISOString();
      const expiresIso = new Date(Date.now() + INVITE_DAYS * 86400000).toISOString();

      const created = await base44.asServiceRole.entities.VideoAdminInvite.create({
        email,
        league_id: leagueId,
        league_name: leagueName,
        status: 'pending',
        invited_by_email: caller.email || '',
        invited_by_name: caller.full_name || caller.email || 'A league admin',
        invited_at: nowIso,
        last_sent_at: nowIso,
        send_count: 1,
        expires_at: expiresIso,
      });

      try {
        await sendInviteEmail(
          base44,
          created,
          caller.full_name || 'Your league admin',
          existingUser ? (existingUser.full_name || '').split(' ')[0] : ''
        );
      } catch (mailErr) {
        console.error('Invite email failed:', mailErr && mailErr.message);
        return Response.json({
          ok: true,
          email_sent: false,
          invite_id: created.id,
          message: `Invitation saved, but the email could not be sent to ${email}. Use Resend to try again.`,
        });
      }

      return Response.json({
        ok: true,
        email_sent: true,
        invite_id: created.id,
        message: `Invitation sent to ${email}. It expires in ${INVITE_DAYS} days.`,
      });
    }

    // -------------------------------------------------------------- resend
    if (action === 'resend') {
      const inviteId = body.invite_id;
      if (!inviteId) return Response.json({ error: 'invite_id is required' }, { status: 400 });

      const rows = await base44.asServiceRole.entities.VideoAdminInvite.filter({ id: inviteId });
      const invite = rows && rows[0];
      if (!invite) return Response.json({ error: 'That invitation no longer exists.' }, { status: 404 });
      if (!canManageLeague(caller, invite.league_id)) {
        return Response.json({ error: 'You do not manage that league.' }, { status: 403 });
      }
      if (invite.status !== 'pending') {
        return Response.json({ error: 'That invitation is no longer pending.' }, { status: 400 });
      }

      const newEmail = body.email ? lower(body.email) : lower(invite.email);
      if (!isValidEmail(newEmail)) {
        return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
      }

      const nowIso = new Date().toISOString();
      const expiresIso = new Date(Date.now() + INVITE_DAYS * 86400000).toISOString();

      await base44.asServiceRole.entities.VideoAdminInvite.update(invite.id, {
        email: newEmail,
        last_sent_at: nowIso,
        expires_at: expiresIso,
        send_count: (invite.send_count || 1) + 1,
      });

      await sendInviteEmail(
        base44,
        { ...invite, email: newEmail, expires_at: expiresIso },
        caller.full_name || 'Your league admin',
        ''
      );

      return Response.json({ ok: true, message: `Invitation re-sent to ${newEmail}.` });
    }

    // -------------------------------------------------------------- cancel
    if (action === 'cancel') {
      const inviteId = body.invite_id;
      if (!inviteId) return Response.json({ error: 'invite_id is required' }, { status: 400 });

      const rows = await base44.asServiceRole.entities.VideoAdminInvite.filter({ id: inviteId });
      const invite = rows && rows[0];
      if (!invite) return Response.json({ error: 'That invitation no longer exists.' }, { status: 404 });
      if (!canManageLeague(caller, invite.league_id)) {
        return Response.json({ error: 'You do not manage that league.' }, { status: 403 });
      }

      await base44.asServiceRole.entities.VideoAdminInvite.update(invite.id, { status: 'cancelled' });
      return Response.json({ ok: true, message: `Invitation for ${invite.email} cancelled.` });
    }

    // ------------------------------------------------------- remove_access
    if (action === 'remove_access') {
      const userId = body.user_id;
      const leagueId = body.league_id;
      if (!userId || !leagueId) {
        return Response.json({ error: 'user_id and league_id are required' }, { status: 400 });
      }
      if (!canManageLeague(caller, leagueId)) {
        return Response.json({ error: 'You do not manage that league.' }, { status: 403 });
      }

      const rows = await base44.asServiceRole.entities.User.filter({ id: userId });
      const target = rows && rows[0];
      if (!target) return Response.json({ error: 'That account no longer exists.' }, { status: 404 });
      if (roleInLeague(target, leagueId) !== 'video_admin') {
        return Response.json({ error: 'That person is not a video admin in this league.' }, { status: 400 });
      }

      const assigned = Array.isArray(target.assigned_league_ids) ? target.assigned_league_ids : [];
      const map = (target.league_role_map && typeof target.league_role_map === 'object') ? target.league_role_map : {};
      const nextMap = { ...map };
      delete nextMap[leagueId];

      await base44.asServiceRole.entities.User.update(userId, {
        assigned_league_ids: assigned.filter((id) => id !== leagueId),
        league_role_map: nextMap,
      });

      return Response.json({
        ok: true,
        message: `${target.full_name || target.email} no longer has video admin access to this league.`,
      });
    }

    // --------------------------------------------------------------- check
    // Any signed-in user, looking up their OWN invitation only.
    if (action === 'check' || action === 'accept') {
      const myEmail = lower(caller.email);
      if (!myEmail) return Response.json({ found: false, reason: 'no_email' });

      const allInvites = await listAll(base44.asServiceRole.entities.VideoAdminInvite);
      const now = Date.now();
      const mine = (allInvites || []).filter(
        (i) => i.status === 'pending' && lower(i.email) === myEmail
      );

      const live = mine.filter((i) => !i.expires_at || new Date(i.expires_at).getTime() >= now);
      if (live.length === 0) {
        return Response.json({
          found: false,
          reason: mine.length > 0 ? 'expired' : 'no_invite',
          signed_in_as: caller.email || '',
        });
      }

      const invite = live[0];

      if (action === 'check') {
        return Response.json({
          found: true,
          invite_id: invite.id,
          league_id: invite.league_id,
          league_name: invite.league_name || '',
          invited_by_name: invite.invited_by_name || '',
          expires_at: invite.expires_at || null,
          signed_in_as: caller.email || '',
        });
      }

      // ------------------------------------------------------------ accept
      // CONSENT_GATE_V1 — record what the page just collected, then run the same gate
      // approveUserApplication runs before any grant. Deliberately not overridable, and
      // nothing below this point runs without it.
      const firstTimeConsent = caller.privacy_terms_accepted !== true;
      await recordConsentFromPayload(base44, caller.id, caller.email, body.consent, invite.league_id);
      let consentUser = caller;
      if (firstTimeConsent) {
        try {
          consentUser = await base44.asServiceRole.entities.User.get(caller.id);
        } catch (_e) { /* keep what we have */ }
      }
      if (!(await hasConsentOnRecord(base44, caller.id, consentUser))) {
        return Response.json({
          error: 'Please accept the privacy terms before accepting this invitation.',
        }, { status: 400 });
      }

      // Re-check the same-league conflict at accept time: the account may have
      // gained a role in the meantime.
      const held = roleInLeague(caller, invite.league_id);
      if (held && held !== 'video_admin') {
        return Response.json({
          error: `You are already ${roleWithArticle(held)} in ${invite.league_name || 'this league'}, and one person can hold only one role per league. Ask your league admin for help.`,
        }, { status: 400 });
      }

      const assigned = Array.isArray(caller.assigned_league_ids) ? caller.assigned_league_ids : [];
      const map = (caller.league_role_map && typeof caller.league_role_map === 'object') ? caller.league_role_map : {};

      const currentType = caller.user_type || '';
      const typeIsPlaceholder = !currentType || currentType === 'user' || currentType === 'viewer' || currentType === 'video_admin';

      const userUpdate = {
        assigned_league_ids: assigned.includes(invite.league_id) ? assigned : [...assigned, invite.league_id],
        league_role_map: { ...map, [invite.league_id]: 'video_admin' },
      };
      // Only promote the global role when there is no real role to protect.
      // A coach or player who runs the stream for another league keeps theirs.
      if (typeIsPlaceholder) userUpdate.user_type = 'video_admin';
      // CONSENT_GATE_V1 — this line used to be an updateMe() in the browser, fired only when
      // the page had just collected consent, i.e. only for an account that had never been
      // through registration. Same condition, same effect, decided here now. An account that
      // already had consent keeps whatever status it has: a pending application for some
      // other league is not decided by this invitation.
      if (firstTimeConsent) userUpdate.application_status = 'Approved';

      await base44.asServiceRole.entities.User.update(caller.id, userUpdate);

      await base44.asServiceRole.entities.VideoAdminInvite.update(invite.id, {
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_user_id: caller.id,
        accepted_email: caller.email || '',
      });

      return Response.json({
        ok: true,
        league_id: invite.league_id,
        league_name: invite.league_name || '',
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('manageVideoAdmins error:', err);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
});
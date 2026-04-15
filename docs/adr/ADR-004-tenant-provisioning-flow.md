# ADR-004 — Tenant Provisioning Flow

**Date:** 2026-04-15
**Status:** Decided
**Decider:** Win

---

## Context

Courtside by AI is a multi-tenant SaaS platform where each league is a tenant (ADR-001). This ADR defines what happens when a new league organisation joins the platform — from signup through to their first session inside the app — and how existing players and coaches join leagues.

---

## Decision

### 1. Two distinct provisioning flows

There are two separate user journeys:

| Flow | Who | Trigger |
|------|-----|---------|
| A — New league admin | A new customer wanting to run their league on Courtside | Self-serve signup + manual approval by Win |
| B — New player/coach/viewer | Someone joining an existing league | Self-serve application + approval by league admin |

---

### 2. Flow A — New league admin provisioning

#### Step-by-step

```
1. User signs up via any auth provider (Google, Microsoft, Facebook, email + password)
2. No memberships exist → registration gate is shown
3. User selects "I want to run my own league" and submits an application
4. Application record created in user_applications table with requested_role: 'league_admin'
5. Win receives notification (email) that a new league admin application is pending
6. Win reviews application in admin dashboard
7. Win approves:
   a. user_league_memberships row created: { role: 'league_admin' }
      (no league_id yet — league admin must create their own league)
   b. Sample league provisioned automatically (see Section 4)
   c. user_league_memberships row created linking new admin to sample league
   d. Approval email sent to user
8. User clicks link in approval email → lands inside the app
9. User sees sample league to explore + "Create new league" option
10. User creates their own league via self-serve league creation tool
11. New league_id generated, user_league_memberships row updated with real league_id
```

#### Manual approval rationale

Win approves every new league admin manually during early stage. This allows quality control, fraud prevention, and direct contact with early customers. This decision can be revisited and automated once the platform reaches a scale where manual review is impractical.

---

### 3. Flow B — New player/coach/viewer joining an existing league

This flow is preserved from Base44 with minimal changes:

```
1. User signs up via any auth provider
2. No memberships exist → registration gate shown
3. User selects their role (player, coach, viewer) and their league
4. Application submitted to user_applications
5. League admin (or Win) reviews and approves
6. On approval:
   a. user_league_memberships row created with approved role + league_id + team_id
   b. For players: PlayerIdentityModal shown to link roster name
   c. Approval email sent
7. User lands inside the app scoped to their league
```

---

### 4. Sample league — automatic provisioning

Every new approved league admin receives a pre-populated sample league automatically on approval. This gives them a realistic environment to explore before touching their real data.

#### Sample league contents

| Entity | Count | Notes |
|--------|-------|-------|
| League | 1 | Named "Sample League — [Admin Name]" |
| Teams | 2 | "Team Alpha" and "Team Beta" |
| Players | 10 | 5 per team, realistic fake names |
| Games | 3 | 2 completed with full stats, 1 scheduled |
| Player stats | Full | Realistic stat lines for completed games |

#### Implementation

Sample league is provisioned by a Supabase Edge Function triggered on approval:

```
provisionSampleLeague(userId, leagueAdminName)
  → creates league row
  → creates teams
  → creates players
  → creates games with stats
  → creates user_league_memberships row linking admin to sample league
```

Sample league is clearly labelled in the UI so the admin knows it is not real data. Admin can delete the sample league at any time.

---

### 5. Self-serve league creation

After approval, league admins create their own real leagues inside the app:

```
1. Admin clicks "Create new league"
2. Form: league name, season, description
3. On submit:
   a. New league row inserted
   b. user_league_memberships row created: { user_id, league_id, role: 'league_admin' }
4. Admin lands inside their new empty league
5. Admin adds teams, players, and schedule manually
```

There is no limit on how many leagues a league admin can create. Each creation follows the same flow.

---

### 6. Notifications

| Event | Notification |
|-------|-------------|
| New league admin application submitted | Email to Win |
| Application approved | Email to applicant |
| Application rejected | Email to applicant with reason |
| New player/coach application submitted | Email to league admin |

Email delivery uses the integration selected in the email provider decision (separate ADR — Resend or SendGrid).

---

### 7. Data model additions

The provisioning flow requires the following additions beyond ADR-001:

```sql
-- Track league admin applications separately from player/coach applications
-- user_applications table already exists — add application_type field
alter table user_applications
  add column application_type text
  check (application_type in ('league_admin', 'league_member'))
  default 'league_member';

-- Track sample league association
alter table leagues
  add column is_sample boolean default false;
```

---

## Alternatives Considered

### Fully self-serve (no manual approval)

Rejected for current stage. Win wants control over who is onboarded as a league admin while the platform is in early commercial phase. Can be revisited when scale demands it.

### No sample league

Rejected. New league admins land in an empty app with no context. A sample league significantly reduces time-to-value and demonstrates the platform's capabilities immediately.

### Win creates leagues manually for each new admin

Rejected. Does not scale and creates unnecessary dependency on Win for routine setup.

---

## Consequences

### Positive
- Win maintains full control over new league admin onboarding during early stage
- Sample league reduces confusion and accelerates time-to-value for new admins
- Self-serve league creation means no Win involvement after initial approval
- Existing player/coach flow is preserved with minimal changes

### Negative / risks
- Manual approval does not scale indefinitely — revisit when volume increases
- Sample league provisioning Edge Function must be reliable — a failed provisioning leaves the admin with no sample data
- Sample leagues accumulate in the database over time — add a cleanup/deletion mechanism

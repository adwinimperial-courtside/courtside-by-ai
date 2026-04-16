# Courtside by AI — Session 03 Handover
**Date:** 2026-04-15
**Next action:** Commit migration file to Git, then OAuth provider setup (Google, Microsoft, Facebook)

---

## What Was Accomplished This Session

1. **ADR-010** — Rollback strategy — decided and saved to `docs/adr/ADR-010-rollback-strategy.md`
2. **All 10 mandatory decisions complete** ✅
3. **Supabase project created** — eu-central-1 (Frankfurt), project ref `bikjkoyodkduhnnlbzpb`
4. **Full database schema deployed** — 12 tables, RLS enabled, all policies, triggers, indexes
5. **Win's admin account created** — `app_admin: true` set in user metadata
6. **Credentials file updated** — saved to Claude project workspace

---

## Key Decisions Made This Session

### Rollback strategy (ADR-010)
- Rollback window: **72 hours** post-cutover per league
- Triggers: data corruption, security breach, core feature failure >20% users >30min, or Win's discretion
- After 72 hours: fix-forward only — no reversion to Base44
- Per-league rollback supported if migrating in batches
- Pre-cutover requirement added: **error monitoring (Sentry) must be in place** before any league goes live

---

## Mandatory Decisions — Status

| # | Decision | Status |
|---|----------|--------|
| 1 | Multi-tenancy approach | Done — ADR-001 |
| 2 | RLS policy patterns | Done — ADR-002 |
| 3 | Auth and role model | Done — ADR-003 |
| 4 | Tenant provisioning flow | Done — ADR-004 |
| 5 | Billing integration | Done — ADR-005 |
| 6 | i18n framework | Done — ADR-006 |
| 7 | Timezone handling | Done — ADR-007 |
| 8 | Supabase region | Done — ADR-008 |
| 9 | Data migration strategy | Done — ADR-009 |
| 10 | Rollback strategy | Done — ADR-010 |

---

## Supabase Project

| Field | Value |
|-------|-------|
| Project name | courtside |
| Project ref | bikjkoyodkduhnnlbzpb |
| Project URL | https://bikjkoyodkduhnnlbzpb.supabase.co |
| Region | eu-central-1 (Central EU — Frankfurt) |
| Publishable key | sb_publishable_feazoLkkfHT18LYN5HhNzw_GiOWA58o |
| Secret key | Apple Keychain: "Supabase courtside — secret key" |
| Database password | Apple Keychain: "Supabase courtside — database password" |
| Win admin user ID | 425cb41e-6d1f-405f-b871-9b306b9f3c1a |
| Win admin email | adwin.imperial@gmail.com |
| Win admin password | Apple Keychain: "Supabase courtside — Win admin password" |

---

## Database Schema — Tables Deployed

| Table | Purpose |
|-------|---------|
| profiles | Extended user profile (timezone, display_name) |
| leagues | Each league = one tenant |
| user_league_memberships | Per-league role assignments |
| teams | Teams within a league |
| players | Players within a league/team |
| games | Scheduled and completed games |
| player_stats | Per-player per-game statistics |
| user_applications | New user applications for manual approval |
| pending_user_assignments | Role assignments awaiting user signup |
| user_league_identity | Per-league display name/jersey overrides |
| league_subscriptions | Paddle subscription state per league |
| id_mapping | Base44 to Supabase ID mapping for migration |

RLS enabled on all tables. All policies, triggers, and indexes in place.

### Known fixes applied during deployment
- Both trigger functions required SET search_path = public and explicit public. schema prefixes
- uuid_generate_v4() replaced with gen_random_uuid()
- Migration file kept in sync with all fixes throughout the session

---

## Migration File Location

/Users/macm5pro/Projects/courtside/supabase/migrations/20260415000000_initial_schema.sql

Not yet committed to Git — needs to be committed on a feature branch next session.

---

## ADR Files — Complete List

All saved to /Users/macm5pro/Projects/courtside/docs/adr/

| File | Decision |
|------|----------|
| ADR-001-multi-tenancy-and-role-model.md | League as tenant, per-league roles |
| ADR-002-rls-policy-patterns.md | RLS template, pgTAP + JS integration tests |
| ADR-003-authentication-and-role-model.md | Auth providers, app_admin storage |
| ADR-004-tenant-provisioning-flow.md | Manual approval, sample league |
| ADR-005-billing-integration.md | Paddle, per-seat model |
| ADR-006-i18n-framework.md | react-i18next, English only at launch |
| ADR-007-timezone-handling.md | Day.js, UTC storage, auto-detect timezone |
| ADR-008-supabase-region.md | eu-central-1 Frankfurt |
| ADR-009-data-migration-strategy.md | Phased migration, Base44 untouched |
| ADR-010-rollback-strategy.md | 72-hour window, fix-forward after |

---

## Next Session — Start Here

1. Attach AccountBriefingProtoMax.md and this handover file
2. Commit migration file to Git on a feature branch:
   - Branch: feature/initial-schema
   - Commit the migration file and ADR-010
   - Push to GitHub
3. OAuth provider setup in Supabase Auth:
   - Google
   - Microsoft
   - Facebook
4. Connect the frontend to Supabase — install @supabase/supabase-js and configure the client

---

## Working Rules Carried Forward

- Claude Code for all file-heavy tasks — not manual terminal paste
- One step at a time — confirm before proceeding
- All ADRs saved to docs/adr/ before any code is written
- Base44 never modified — stays live until cutover is explicitly triggered by Win
- Never hardcode UI strings — always use react-i18next
- Always use timestamptz for datetime columns — never plain timestamp
- All work on feature branches — main always deployable
- Never paste secrets into chat — Keychain only
- Publishable key is safe in frontend code; secret key never goes in frontend or Git

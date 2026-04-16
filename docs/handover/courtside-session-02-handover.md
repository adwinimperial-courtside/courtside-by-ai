# Courtside by AI — Session 02 Handover
**Date:** 2026-04-15
**Next action:** Complete Decision 10 (Rollback strategy → ADR-010), then begin Supabase project setup

---

## What Was Accomplished This Session

1. **Roles and auth audit completed** — full codebase analysis via Claude Code, saved to `docs/audit/roles-and-auth-audit.md`
2. **ADR-001** — Multi-tenancy and role model — decided and saved
3. **ADR-002** — RLS policy patterns — decided and saved
4. **ADR-003** — Authentication and role model — decided and saved
5. **ADR-004** — Tenant provisioning flow — decided and saved
6. **ADR-005** — Billing integration — decided and saved
7. **ADR-006** — i18n framework — decided and saved
8. **ADR-007** — Timezone handling — decided and saved
9. **ADR-008** — Supabase region — decided and saved
10. **ADR-009** — Data migration strategy — decided and saved

---

## Key Decisions Made This Session

### Role model
- Roles are **per-league**, not global — a user can be coach in League A and viewer in League B
- New table: `user_league_memberships` replaces the global `user_type` scalar and `assigned_league_ids` array
- `app_admin` is Win only, stored in Supabase Auth user metadata (`raw_user_meta_data: { app_admin: true }`)
- All 75 files using `currentUser.user_type` must be refactored to use helper functions

### Auth
- Providers: Google, Microsoft, Facebook, email + password (Apple deferred — $99/year)
- Existing 100 users: migrated via one-time magic link activation email — no re-signup required
- New users: standard social/email login

### Tenant provisioning
- New league admins: manual approval by Win
- On approval: sample league auto-provisioned (2 teams, 10 players, 3 games)
- League admins create their own real leagues self-serve
- Billing admin: designated per league, flagged on `user_league_memberships`

### Billing
- Provider: **Paddle** (merchant of record — handles EU VAT, Canadian GST, Philippines VAT automatically)
- Model: per-seat per-league per-month (league_admin + coach + player fees; viewer free)
- Pricing amounts: not yet decided — integrate now in inactive mode, activate when ready
- Currency: EUR
- Viewer restrictions: schedule and completed game stats only

### i18n
- Library: **react-i18next**
- Launch language: English only
- Framework in place from day one — no hardcoded UI strings anywhere

### Timezone
- Library: **Day.js** with UTC and timezone plugins
- Store: always UTC in database (`timestamptz`)
- Display: user's local timezone, auto-detected from browser on first login
- Helper functions in `src/lib/datetime.js`

### Supabase region
- **eu-central-1 (Frankfurt)** — closest to majority user base (Finland, Spain), satisfies GDPR data residency
- Significant improvement over Base44's current US-hosted infrastructure for EU users on live game console

### Data migration
- Base44 stays live and untouched throughout — purely additive migration
- Phases: Export → Import static data → Create Supabase users + magic links → Validate → Cutover
- Cutover timing: between seasons/tournaments, never mid-game
- Delta export needed immediately before cutover to catch new data created during migration window

---

## Mandatory Decisions — Status

| # | Decision | Status |
|---|----------|--------|
| 1 | Multi-tenancy approach | ✅ Done — ADR-001 |
| 2 | RLS policy patterns | ✅ Done — ADR-002 |
| 3 | Auth and role model | ✅ Done — ADR-003 |
| 4 | Tenant provisioning flow | ✅ Done — ADR-004 |
| 5 | Billing integration | ✅ Done — ADR-005 |
| 6 | i18n framework | ✅ Done — ADR-006 |
| 7 | Timezone handling | ✅ Done — ADR-007 |
| 8 | Supabase region | ✅ Done — ADR-008 |
| 9 | Data migration strategy | ✅ Done — ADR-009 |
| 10 | Rollback strategy | ⏳ Next |

---

## ADR Files — Saved Locations

All saved to `/Users/macm5pro/Projects/courtside/docs/adr/`:

| File | Decision |
|------|----------|
| ADR-001-multi-tenancy-and-role-model.md | League as tenant, per-league roles, user_league_memberships table |
| ADR-002-rls-policy-patterns.md | RLS template, pgTAP + JS integration tests |
| ADR-003-authentication-and-role-model.md | Auth providers, app_admin storage, helper functions |
| ADR-004-tenant-provisioning-flow.md | Manual approval, sample league, self-serve league creation |
| ADR-005-billing-integration.md | Paddle, per-seat model, billing admin, inactive until monetization |
| ADR-006-i18n-framework.md | react-i18next, English only at launch |
| ADR-007-timezone-handling.md | Day.js, UTC storage, auto-detect timezone |
| ADR-008-supabase-region.md | eu-central-1 Frankfurt |
| ADR-009-data-migration-strategy.md | Phased migration, Base44 untouched, magic link activation |

---

## Audit Files — Saved Locations

| File | Contents |
|------|----------|
| `docs/audit/roles-and-auth-audit.md` | Full role system, auth patterns, Base44 API usage across 75 files |

---

## New Database Tables Required (beyond existing entities)

| Table | Purpose | Defined in |
|-------|---------|------------|
| `user_league_memberships` | Per-league role assignments | ADR-001 |
| `league_subscriptions` | Paddle subscription state per league | ADR-005 |
| `profiles` | Extended user profile (timezone, display_name etc.) | ADR-007 |
| `id_mapping` | Base44 → Supabase ID mapping during migration | ADR-009 |

Existing entities to recreate: `leagues`, `teams`, `players`, `games`, `player_stats`, `user_applications`, `pending_user_assignments`, `user_league_identity`

---

## Next Session — Start Here

1. Attach `AccountBriefingProtoMax.md` and this handover file to the new session
2. Complete **Decision 10: Rollback strategy** → produce ADR-010
3. Then begin **Supabase project setup**:
   - Create Supabase project in eu-central-1 (Frankfurt)
   - Add credentials to `courtside-credentials-reference.txt`
   - Create database schema (all tables + RLS policies)
   - Set up Win's app_admin metadata
4. Then begin **OAuth provider setup** (Google, Microsoft, Facebook)

---

## Working Rules Carried Forward

- Claude Code for all file-heavy tasks — not manual terminal paste
- One step at a time — confirm before proceeding
- All ADRs saved to `docs/adr/` before any code is written
- Base44 never modified — stays live until cutover is explicitly triggered by Win
- Never hardcode UI strings — always use react-i18next
- Always use `timestamptz` for datetime columns — never plain `timestamp`
- All work on feature branches — `main` always deployable

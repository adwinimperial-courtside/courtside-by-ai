# ADR-009 — Data Migration Strategy

**Date:** 2026-04-15
**Status:** Decided
**Decider:** Win

---

## Context

Courtside by AI is migrating from Base44 to a self-owned Supabase stack. The platform currently has ~100 users across Finland, Philippines, Spain, and Canada with active leagues, live and upcoming games, and historical stats. Base44 remains live and fully operational throughout the entire migration. No changes are made to Base44 at any point during migration.

---

## Decision

### 1. Core principle — additive migration, Base44 untouched

The migration is purely additive. Data is exported from Base44 and imported into Supabase. Base44 is never modified, never put into read-only mode, and never touched during the migration process. It continues to serve all 100 users normally until Win decides to cut over.

This means:
- Zero risk to live games during migration
- Zero disruption to users during migration
- Base44 is the source of truth until cutover is explicitly triggered by Win

### 2. Migration phases

#### Phase 1 — Export from Base44

Export all entities from Base44 as JSON or CSV:

| Entity | Fields to export |
|--------|-----------------|
| Users | id, email, full_name, user_type, assigned_league_ids, default_league_id, league_team_pairs, application_status, display_name, handle, player_name_status |
| Leagues | id, name, season, description |
| Teams | id, name, league_id, color, wins, losses |
| Players | id, name, team_id, jersey_number, position |
| Games | id, league_id, home_team_id, away_team_id, game_date, status, home_score, away_score, location, player_of_game, entry_type, edited, is_default_result, default_winner_team_id, default_loser_team_id, clock_running, clock_time_left, clock_started_at, clock_period |
| PlayerStats | id, game_id, player_id, team_id, is_starter, points_2, points_3, free_throws, free_throws_missed, offensive_rebounds, defensive_rebounds, assists, steals, blocks, turnovers, fouls, technical_fouls, unsportsmanlike_fouls, minutes_played, is_active, did_play |
| UserLeagueIdentity | id, user_id, league_id, team_id, roster_player_name, roster_match_status, identity_status |
| UserApplication | id, user_id, user_email, user_name, requested_role, status, is_additional_request, league_ids, league_team_pairs, display_name, handle |
| PendingUserAssignment | id, email, user_type, assigned_league_ids, applied |

#### Phase 2 — Import static data into Supabase

Import in dependency order (parents before children):

```
1. Leagues
2. Teams (depends on leagues)
3. Players (depends on teams)
4. Games (depends on leagues, teams)
5. PlayerStats (depends on games, players, teams)
6. UserLeagueIdentity records
```

Base44 IDs are preserved where possible to simplify cross-referencing. If Supabase requires UUID format and Base44 IDs differ, a mapping table is maintained:

```sql
create table id_mapping (
  entity_type  text,
  base44_id    text,
  supabase_id  uuid,
  primary key (entity_type, base44_id)
);
```

#### Phase 3 — Create Supabase user accounts

For each exported user:

1. Create Supabase Auth account using their email address
2. Send one-time magic link activation email — "Welcome to the new Courtside, click here to activate your account"
3. Create `user_league_memberships` rows from their `user_type` + `assigned_league_ids` + `league_team_pairs` data per ADR-001 migration path
4. Set `app_admin: true` in user metadata for Win's account

Users are not required to do anything until they receive the activation email. Base44 continues to work normally for them until then.

#### Phase 4 — Validate data integrity

Before any user is directed to the new system, run automated validation:

| Check | Method |
|-------|--------|
| Row counts match | Compare Base44 export counts vs Supabase import counts per entity |
| No orphaned records | Every team has a valid league_id, every player has a valid team_id, etc. |
| All user memberships created | Every user has at least one user_league_memberships row |
| RLS isolation test | Run ADR-002 cross-league isolation tests |
| Auth test | Win logs in to new system and verifies full access |
| Sample league test | Verify sample league provisioning works end to end |

Migration does not proceed to cutover until all validation checks pass.

#### Phase 5 — Cutover

Cutover is triggered manually by Win when:
- All validation checks pass
- Win is confident in the new system
- Timing is between seasons or tournaments — never mid-game

Cutover sequence:
```
1. Win activates new system (Cloudflare Pages deployment goes live)
2. Win sends communication to all users with new URL and login instructions
3. Users activate accounts via magic link and begin using new system
4. Base44 remains accessible but users are directed to new system
5. Win monitors for issues — Base44 stays live as fallback
6. After a defined period with no critical issues, Base44 is decommissioned
```

### 3. Timing rule — never mid-game

The user cutover step (Phase 5) must not happen while any league has a game in progress or scheduled within 24 hours. Win checks the schedule before triggering cutover.

Data migration phases 1-4 can happen at any time — they are invisible to users and do not affect Base44.

### 4. Data that does not migrate

| Data | Reason |
|------|--------|
| Base44 platform roles (`role: "admin" \| "user"`) | Replaced by `app_admin` metadata in Supabase Auth |
| `application_status` field on users | Replaced by presence/absence of `user_league_memberships` rows |
| Pending applications in flight | Reviewed and resolved in Base44 before cutover |
| Base44 analytics events | Not migrated — historical analytics stay in Base44 |

### 5. Rollback during migration

Since Base44 is never modified, rollback at any point during phases 1-4 is trivial — simply stop the migration and continue using Base44. No rollback procedure needed for these phases.

Rollback after cutover (Phase 5) is covered in ADR-010.

---

## Alternatives Considered

### Big bang cutover (migrate everything at once)

Rejected. Higher risk — if something goes wrong, all 100 users are affected immediately. The phased approach allows validation before any user is impacted.

### Migrate users before data

Rejected. Users must have their league memberships and data waiting for them when they activate their accounts. Data must be imported first.

### Modify Base44 during migration

Rejected. Base44 stays completely untouched throughout. Any modification to Base44 introduces risk to the live system.

---

## Consequences

### Positive
- Zero risk to live games — Base44 untouched throughout
- Zero user disruption during data migration phases
- Full validation before any user sees the new system
- Clean rollback available at any point before cutover

### Negative / risks
- During the window between data export and cutover, new data created in Base44 (new games, new stats) is not automatically synced to Supabase — a final delta export may be needed immediately before cutover
- 100 users must all receive and act on activation emails — some users may not activate promptly, requiring follow-up
- ID mapping adds complexity if Base44 IDs and Supabase UUIDs differ significantly

# ADR-001 — Multi-Tenancy and Role Model

**Date:** 2026-04-15
**Status:** Decided
**Decider:** Win

---

## Context

Courtside by AI is a global SaaS basketball league management platform. Multiple league organisations use the same application. Their data must be strictly isolated. The platform is being migrated from Base44 to a self-owned stack (React 18 + Supabase + Cloudflare Pages).

The existing Base44 system stores a single `user_type` scalar on each user record, giving every user one global role across all leagues they belong to. League membership is stored as an array (`assigned_league_ids`) on the user record. This prevents a user from having different roles in different leagues — a real limitation for a multi-league SaaS product.

---

## Decision

### 1. Tenancy model — League as tenant

The **League** is the tenant unit. Each league is an isolated organisation. Users belong to one or more leagues. All data (teams, players, games, stats) is scoped to a league via a `league_id` foreign key.

Row-Level Security (RLS) on Supabase enforces isolation at the database level. No frontend-only enforcement.

### 2. Role model — Per-league membership

User roles are **per-league**, not global. A user can hold different roles in different leagues.

A new join table — `user_league_memberships` — replaces the `assigned_league_ids` array and the global `user_type` scalar:

```sql
user_league_memberships
  id              uuid primary key
  user_id         uuid references auth.users
  league_id       uuid references leagues
  role            text check (role in ('league_admin', 'coach', 'player', 'viewer'))
  team_id         uuid references teams nullable  -- required for player and coach
  created_at      timestamptz default now()

  unique (user_id, league_id)
```

### 3. Platform role — app_admin

`app_admin` is a platform-level role belonging to Win (the owner). It is stored on the Supabase Auth user metadata, not in `user_league_memberships`. An `app_admin` user has implicit access to all leagues and all data without requiring membership rows.

### 4. Role definitions

| Role | Scope | Description |
|------|-------|-------------|
| `app_admin` | Platform-wide | Win only. Full access to everything. Bypasses all league-level restrictions. |
| `league_admin` | Per-league | Manages one or more leagues they are assigned to. Can manage users, teams, rosters, and settings within their leagues. |
| `coach` | Per-league | Manages their assigned team within a league. Requires `team_id`. |
| `player` | Per-league | Active roster player within a league. Requires `team_id`. |
| `viewer` | Per-league | Read-only access to a league. No `team_id` required. |

### 5. Onboarding and approval flow

The existing approval workflow (`UserApplication`, `PendingUserAssignment`) is preserved but updated to create `user_league_memberships` rows on approval rather than updating a `user_type` scalar.

### 6. Frontend impact

All 75 files currently checking `currentUser.user_type` must be updated to derive the user's role from their membership record for the currently selected league. A helper function will be introduced:

```js
// Returns the current user's role for the active league
getCurrentLeagueRole(currentUser, activeLeagueId)

// Returns true if user has app_admin platform role
isAppAdmin(currentUser)
```

These two functions replace all raw `user_type` string comparisons across the codebase.

### 7. RLS policy approach

Every table that contains league-scoped data will have RLS policies enforcing:

- `app_admin` users can read and write all rows
- All other users can only read/write rows where `league_id` matches a league they have a membership row for
- Write access is further restricted by role (e.g. only `league_admin` and `coach` can insert game stats)

RLS policies are documented in a separate artifact (RLS-policies.md) and every policy has an automated test proving Customer A cannot access Customer B's data.

---

## Alternatives Considered

### Keep global `user_type` on the user record

Rejected. Prevents a user from holding different roles in different leagues — a real limitation as the platform scales and users participate in multiple leagues in different capacities.

### Schema-per-tenant (one schema per league)

Rejected. Supabase does not support this pattern well. Schema migrations become unmanageable at scale.

### Database-per-tenant (one Supabase project per league)

Rejected. Operationally unworkable at any meaningful scale.

---

## Consequences

### Positive
- Correct SaaS multi-tenancy from day one
- Per-league roles unlock realistic use cases (e.g. a user who coaches in one league and plays in another)
- Database-level enforcement via RLS — frontend checks become a UX convenience, not a security boundary
- Clean, queryable membership model replaces an array field on the user record

### Negative / risks
- 75 files require frontend refactor to replace `currentUser.user_type` checks
- RLS policies must be written carefully — a policy mistake is a data leak
- Migration of existing 100 Base44 users requires mapping their current `user_type` + `assigned_league_ids` into `user_league_memberships` rows (one row per user per league)

---

## Migration path for existing users

Each existing user's `assigned_league_ids` array is expanded into individual `user_league_memberships` rows, using their current `user_type` as the role value for every league they belong to. `app_admin` status is written to Supabase Auth user metadata.

Example:
```
Before (Base44):
  user_type: "coach"
  assigned_league_ids: ["league_A", "league_B"]
  league_team_pairs: [
    { league_id: "league_A", team_id: "team_5" },
    { league_id: "league_B", team_id: "team_12" }
  ]

After (Supabase):
  user_league_memberships:
    { user_id, league_id: "league_A", role: "coach", team_id: "team_5" }
    { user_id, league_id: "league_B", role: "coach", team_id: "team_12" }
```

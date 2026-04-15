# ADR-002 — RLS Policy Patterns

**Date:** 2026-04-15
**Status:** Decided
**Decider:** Win

---

## Context

ADR-001 established that Supabase Row-Level Security (RLS) is the mechanism for enforcing data isolation between leagues. This ADR defines how RLS policies are structured, documented, and tested across all tables.

All role and membership logic flows from the `user_league_memberships` table defined in ADR-001.

---

## Decision

### 1. Policy structure — standard template

Every league-scoped table follows the same policy shape. Two building blocks are reused in every policy:

**Block A — league membership check**
```sql
league_id in (
  select league_id from user_league_memberships
  where user_id = auth.uid()
)
```

**Block B — app_admin bypass**
```sql
(auth.jwt() -> 'user_metadata' ->> 'app_admin') = 'true'
```

**Full policy template:**
```sql
-- READ: any league member
create policy "{table}: members can read"
on {table} for select
using (
  (auth.jwt() -> 'user_metadata' ->> 'app_admin') = 'true'
  or league_id in (
    select league_id from user_league_memberships
    where user_id = auth.uid()
  )
);

-- INSERT: league_admin and coach only
create policy "{table}: admins and coaches can insert"
on {table} for insert
with check (
  (auth.jwt() -> 'user_metadata' ->> 'app_admin') = 'true'
  or exists (
    select 1 from user_league_memberships
    where user_id = auth.uid()
    and league_id = {table}.league_id
    and role in ('league_admin', 'coach')
  )
);

-- UPDATE: league_admin and coach only
create policy "{table}: admins and coaches can update"
on {table} for update
using (
  (auth.jwt() -> 'user_metadata' ->> 'app_admin') = 'true'
  or exists (
    select 1 from user_league_memberships
    where user_id = auth.uid()
    and league_id = {table}.league_id
    and role in ('league_admin', 'coach')
  )
);

-- DELETE: league_admin only
create policy "{table}: league_admin can delete"
on {table} for delete
using (
  (auth.jwt() -> 'user_metadata' ->> 'app_admin') = 'true'
  or exists (
    select 1 from user_league_memberships
    where user_id = auth.uid()
    and league_id = {table}.league_id
    and role = 'league_admin'
  )
);
```

### 2. Tables requiring RLS

| Table | RLS required | Notes |
|-------|-------------|-------|
| `leagues` | Yes | Read: members only. Write: app_admin only |
| `teams` | Yes | Scoped by league_id |
| `players` | Yes | Scoped by league_id |
| `games` | Yes | Scoped by league_id |
| `player_stats` | Yes | Scoped by league_id via game |
| `user_league_memberships` | Yes | Users read own rows; league_admin reads their league's rows; app_admin reads all |
| `user_applications` | Yes | Users read own rows; app_admin reads all |
| `pending_user_assignments` | Yes | app_admin only |
| `user_league_identity` | Yes | User reads own rows; league_admin reads their league's rows |

### 3. Special case — `user_league_memberships`

This table is the source of truth for all other policies. Its own policies must be written carefully to avoid circular dependency:

```sql
-- Users can read their own membership rows
create policy "memberships: user reads own"
on user_league_memberships for select
using (user_id = auth.uid());

-- league_admin can read memberships for their leagues
create policy "memberships: league_admin reads league"
on user_league_memberships for select
using (
  (auth.jwt() -> 'user_metadata' ->> 'app_admin') = 'true'
  or exists (
    select 1 from user_league_memberships m2
    where m2.user_id = auth.uid()
    and m2.league_id = user_league_memberships.league_id
    and m2.role = 'league_admin'
  )
);

-- Only app_admin can insert/update/delete memberships
create policy "memberships: app_admin manages"
on user_league_memberships for all
using (
  (auth.jwt() -> 'user_metadata' ->> 'app_admin') = 'true'
);
```

### 4. RLS must be explicitly enabled on every table

```sql
alter table {table} enable row level security;
alter table {table} force row level security;
```

`force row level security` ensures that even the table owner (service role) is subject to policies when acting as a regular user. The service role key used in Edge Functions bypasses RLS by design — this is intentional and acceptable.

### 5. Testing — two layers required

Both layers must pass before any table is considered migration-ready.

#### Layer 1 — pgTAP (database-level isolation proof)

pgTAP tests run inside the Supabase database. They prove at the SQL level that one league's data is invisible to another league's users.

Minimum required test per table:
```sql
-- Prove user in league_A cannot select rows belonging to league_B
select is(
  (select count(*) from {table} where league_id = 'league_B_id'),
  0,
  'league_A user cannot see league_B data'
);
```

#### Layer 2 — JavaScript integration tests

JS tests simulate real application behaviour using the Supabase JS client. They authenticate as specific test users and verify access at the API level.

Minimum required test per table:
```js
// Authenticate as a league_A user
const { data } = await supabase
  .from('{table}')
  .select()
  .eq('league_id', leagueBId);  // attempt to read league_B data

expect(data).toHaveLength(0);   // must return empty
```

#### Non-negotiable test cases (all tables)

| Test | Description |
|------|-------------|
| Cross-league read isolation | User in League A gets zero rows when querying League B data |
| Cross-league write isolation | User in League A cannot insert/update rows with League B's league_id |
| Role-based write restriction | `viewer` and `player` cannot insert game stats |
| app_admin full access | app_admin can read and write all leagues |
| Unauthenticated access | Unauthenticated requests return zero rows on all tables |

### 6. Documentation requirement

Every table's policies are documented in `docs/rls/RLS-policies.md` with:
- The policy name
- What it enforces
- Which roles it applies to
- The test case that proves it works

No policy ships without a corresponding test and documentation entry.

---

## Alternatives Considered

### Application-level enforcement only (no RLS)

Rejected. The existing Base44 system uses frontend-only checks. A determined user can call the Supabase API directly and bypass all React conditionals. RLS is the only way to enforce isolation at the database level.

### Single permissive policy with application-level filtering

Rejected. Same problem as above — trusts the application layer too much.

---

## Consequences

### Positive
- Data isolation is enforced at the database level — no frontend bug can leak one league's data to another
- Consistent policy shape across all tables makes auditing straightforward
- Two-layer testing gives high confidence before any customer data is live

### Negative / risks
- RLS adds a small query overhead (subquery on every request) — acceptable at Courtside's scale
- Policy mistakes are silent data leaks, not loud errors — the test suite is the only protection
- The `user_league_memberships` self-referential policy requires careful ordering during setup

# ADR-003 — Authentication and Role Model

**Date:** 2026-04-15
**Status:** Decided
**Decider:** Win

---

## Context

Courtside by AI is migrating from Base44 to Supabase. The existing login screen supports Google, Microsoft, Facebook, Apple, and email + password. This ADR defines how authentication is implemented in Supabase, how the platform role (`app_admin`) is stored, and how the frontend derives a user's league role for the currently active league.

This ADR builds on ADR-001 (role model) and ADR-002 (RLS policies).

---

## Decision

### 1. Authentication providers

The following providers are enabled in Supabase Auth, matching the existing Base44 login experience:

| Provider | Enabled | Notes |
|----------|---------|-------|
| Google | ✅ | Most common social login globally |
| Microsoft | ✅ | Common in corporate/organisational contexts |
| Facebook | ✅ | Already in use by existing users |
| Apple | ❌ | Requires $99/year Apple Developer account — deferred, can be added later |
| Email + password | ✅ | Fallback for all users including Apple email addresses |

Users with Apple email addresses (iCloud, me.com, mac.com) can log in using email + password or Google if their Apple email is linked to a Google account.

### 2. app_admin storage

`app_admin` is a platform-level role belonging to Win only. It is stored in Supabase Auth user metadata on Win's account:

```js
raw_user_meta_data: { app_admin: true }
```

This is set manually in the Supabase dashboard. No signup flow, no application process. No other user can obtain this value.

The RLS policies in ADR-002 read this directly from the JWT:
```sql
(auth.jwt() -> 'user_metadata' ->> 'app_admin') = 'true'
```

### 3. League role derivation

A user's role for a specific league is stored in `user_league_memberships` (defined in ADR-001). The frontend derives the current user's active league role as follows:

#### AuthContext shape

```js
{
  user: {
    id: string,
    email: string,
    full_name: string,
    is_app_admin: boolean,           // read from user_metadata.app_admin
  },
  memberships: [                     // all user_league_memberships rows for this user
    {
      league_id: string,
      role: 'league_admin' | 'coach' | 'player' | 'viewer',
      team_id: string | null,
    }
  ],
  isAuthenticated: boolean,
  isLoadingAuth: boolean,
}
```

#### Helper functions (replace all currentUser.user_type checks)

```js
// Returns the user's role for the given league, or null if not a member
getCurrentLeagueRole(user, memberships, leagueId)
// returns: 'league_admin' | 'coach' | 'player' | 'viewer' | null

// Returns true if user is app_admin
isAppAdmin(user)
// returns: boolean

// Returns true if user has any of the given roles in the given league
hasLeagueRole(user, memberships, leagueId, roles[])
// returns: boolean
// example: hasLeagueRole(user, memberships, leagueId, ['league_admin', 'coach'])

// Returns all league IDs the user is a member of
getUserLeagueIds(memberships)
// returns: string[]
```

These four functions replace all raw `currentUser.user_type` string comparisons across 75 files.

#### On login — data loading sequence

```
1. supabase.auth.getUser()          → get authenticated user + metadata
2. supabase.from('user_league_memberships')
     .select()
     .eq('user_id', user.id)        → get all league memberships
3. Store both in AuthContext
4. App renders with full role context available
```

### 4. Session management

Supabase handles session management via JWT tokens stored in localStorage. Sessions are automatically refreshed. No custom session logic required.

### 5. Onboarding gate

New users who sign up via any provider but have no `user_league_memberships` rows are shown the registration gate — the same flow that exists in Base44. The gate detects zero memberships and prompts the user to apply for league access.

```js
// In Layout.jsx — replace the existing user_type === "user" check
const showRegistrationGate = isAuthenticated
  && !isAppAdmin(user)
  && memberships.length === 0
  && !isLiveGamePage;
```

### 6. Migration — existing users

Existing Base44 users do not create new accounts. They are migrated as follows:

1. Their email addresses are imported into Supabase Auth via the Supabase invite flow
2. Their `user_type` and `assigned_league_ids` are used to create `user_league_memberships` rows before they log in (one per league, per ADR-001 migration path)
3. Each user receives a **one-time magic link** email — "Welcome to the new Courtside, click here to activate your account"
4. They click the magic link — account is activated, memberships are already waiting for them, no signup form required
5. On all subsequent logins they use their preferred method — Google, Microsoft, Facebook, or email + password

Magic link is used **once per existing user for account activation only**. It is not an ongoing login method.

Win's account is set to `app_admin: true` in Supabase user metadata manually after account creation.

### 7. OAuth developer app setup (one-time)

Each social provider requires a developer app registration:

| Provider | Portal | Cost |
|----------|--------|------|
| Google | Google Cloud Console | Free |
| Microsoft | Azure Portal | Free |
| Facebook | Meta Developer Portal | Free |

Each app registration produces a Client ID and Client Secret, which are entered into Supabase Auth provider settings. This is a one-time setup task before launch.

---

## Alternatives Considered

### Magic link only (no passwords)

Rejected. Existing users are accustomed to social login and email + password. Removing these options would create friction during migration.

### Apple Sign In

Deferred. Requires $99/year Apple Developer Program membership. Users with Apple email addresses can still log in via email + password. Can be added post-launch.

### Custom JWT / custom auth server

Rejected. Supabase Auth handles all required providers natively. No custom auth infrastructure needed.

---

## Consequences

### Positive
- Exact same login experience as Base44 — zero friction for existing users
- Supabase Auth handles token refresh, session management, and OAuth flows natively
- `app_admin` stored in JWT means RLS policies can check it without a database lookup
- Helper functions centralise all role logic — no more scattered string comparisons

### Negative / risks
- Three OAuth developer app registrations required before launch (Google, Microsoft, Facebook) — one-time setup, ~30-60 minutes total
- All 75 files using `currentUser.user_type` must be refactored to use helper functions
- If Win's `app_admin` metadata is accidentally removed, Win loses admin access — keep a record of how to restore it

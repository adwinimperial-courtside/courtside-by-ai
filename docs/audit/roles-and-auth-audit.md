# Courtside — Authorization & Roles Audit Report

---

## 1. Role Names & Values

All role strings are stored on the user's `user_type` field. Exact values:

| Role String | Type | Access Level |
|---|---|---|
| `"app_admin"` | System role | Application-wide administrator |
| `"league_admin"` | League role | League owner/manager |
| `"coach"` | League role | Team coach |
| `"player"` | League role | Active player |
| `"viewer"` | League role | Read-only access |
| `"user"` | Default role | New/unapproved — shown registration gate |

Application status values (on `application_status` field):

| Value | Meaning |
|---|---|
| `"Pending"` | Application submitted, awaiting review |
| `"Approved"` | Access granted |
| `"Rejected"` | Application denied |

---

## 2. User Object Shape

Returned by `base44.auth.me()`. Role-relevant fields:

```js
{
  id: string,
  email: string,
  full_name: string,

  // PRIMARY ROLE FIELD
  user_type: "app_admin" | "league_admin" | "coach" | "player" | "viewer" | "user",

  // LEAGUE ACCESS
  assigned_league_ids: string[],      // leagues this user can see
  default_league_id: string | null,   // pre-selected league on load
  league_team_pairs: [                // player/coach team assignments per league
    { league_id: string, team_id: string }
  ] | null,

  // ONBOARDING GATE
  application_status: "Pending" | "Approved" | "Rejected" | undefined,

  // PLAYER IDENTITY
  display_name: string | null,        // official player roster name
  handle: string | null,              // nickname
  player_name_status: "completed" | "missing" | "needs_review",

  // BASE44 PLATFORM FIELDS (separate from app roles)
  role: "admin" | "user",             // platform-level role (rarely used in app logic)
  status: string,                     // account status
  created_date: ISO8601,
}
```

> **Note:** `user_type` is the application-level role. `role` is the Base44 platform role and appears in only one place (`Analytics.jsx`) where both are checked together.

---

## 3. Tenant / Organisation Model

There is **no formal multi-tenant entity**. League membership is encoded directly on the User record.

### Data model

```
User
  ├── user_type: "player"                          ← single global role
  ├── assigned_league_ids: ["league_A", "league_B"] ← which leagues they belong to
  ├── default_league_id: "league_A"
  └── league_team_pairs: [
        { league_id: "league_A", team_id: "team_5" },
        { league_id: "league_B", team_id: "team_12" }
      ]
```

### Supporting entities

**`UserLeagueIdentity`** — links a player user to a specific roster entry:
```js
{
  user_id, league_id, team_id,
  roster_player_name,
  roster_match_status: "matched" | "unmatched" | "manual_review",
  identity_status: "completed" | "needs_review"
}
```

**`PendingUserAssignment`** — pre-configures roles before a user signs up:
```js
{
  email, user_type, assigned_league_ids, applied: boolean
}
```

**`UserApplication`** — the approval workflow record:
```js
{
  user_id, user_email, user_name,
  requested_role,          // role being applied for
  status: "Pending" | "Approved" | "Rejected",
  is_additional_request: boolean,
  league_ids, league_team_pairs,
  display_name, handle,    // player-specific fields
  ...
}
```

**`LeagueAccessRequest`** — secondary request to join additional leagues:
```js
{ user_id, user_name, user_email, requested_league_ids, status }
```

**Key constraint:** A user has **one global role** across all leagues. There is no per-league role (e.g., a user cannot be `coach` in League A and `viewer` in League B).

---

## 4. Authorization Logic — Exact Conditionals by Page/Component

### Pages

**Most admin pages** use this pattern to hard-block non-admins:
```js
if (currentUser && currentUser.user_type !== "app_admin") {
  return <AccessDenied />
}
```
This applies to: `AdminTools`, `AllPlayersView`, `Analytics`, `Coaches`, `DataBackup`, `DeleteLeague`, `FixManualStats`, `LeagueAwardSettings`, `LeagueIDs`, `LeagueOwners`, `Players`, `RegularSeasonRecap`, `RequestManagement`, `UserManagement`, `UserRoles`, `Viewers`.

**Pages with multi-role access:**

```js
// GameLog.jsx
if (currentUser &&
    currentUser.user_type !== "app_admin" &&
    currentUser.user_type !== "league_admin") {
  return <AccessDenied />
}

// LeagueUsers.jsx
const isAppAdmin = currentUser?.user_type === 'app_admin';
const isLeagueAdmin = currentUser?.user_type === 'league_admin';
if (currentUser && !isAppAdmin && !isLeagueAdmin) {
  return <AccessDenied />
}

// PlayerProfile.jsx
if (currentUser &&
    currentUser.user_type !== 'player' &&
    currentUser.user_type !== 'coach') {
  return <AccessDenied />
}

// Whiteboard.jsx
const allowedTypes = ["app_admin", "league_admin", "coach", "player"];
if (!currentUser || !allowedTypes.includes(currentUser.user_type)) {
  return <Warning />
}

// CoachInsights.jsx
if (currentUser && currentUser.user_type === 'viewer') {
  return <NotAvailable />
}

// ApplyForLeague.jsx — blocks app_admin from applying
if (currentUser.user_type === "app_admin") {
  return <Message>App administrators manage league access directly</Message>
}
```

**Data-level filtering in Leagues.jsx:**
```js
const filteredLeagues = currentUser?.assigned_league_ids
  ? leagues.filter(l => currentUser.assigned_league_ids.includes(l.id))
  : isAppAdmin ? leagues : [];
```

**React Query data-fetching gate (used throughout):**
```js
useQuery({
  enabled: currentUser?.user_type === "app_admin",  // don't even fetch if wrong role
  ...
})
```

**Analytics.jsx mixes two role sources** (the only place `role` is used):
```js
const isAdmin = currentUser?.role === "admin" || currentUser?.user_type === "app_admin";
```

### Layout / Navigation

**`Layout.jsx`** — registration gate:
```js
const showRegistrationGate = currentUser && (
  !currentUser.user_type || currentUser.user_type === "user"
) && !isLiveGamePage;
```

**`SidebarMenuContent.jsx`** — role-based nav filtering:
```js
// Viewers: strip certain items
const base = currentUser.user_type === "viewer"
  ? navItems.filter(i => !["Leagues", "Teams", "Coach Insights", "Whiteboard"].includes(i.title))
  : navItems;

// Players/Coaches: inject Player Profile link
const withRole = (currentUser.user_type === "player" || currentUser.user_type === "coach")
  ? [playerNavItem, ...base]
  : base;

// Admins: append admin + league-admin menu sections
if (currentUser.user_type === "app_admin") return [...adminItems, ...leagueAdminItems];
if (currentUser.user_type === "league_admin") return [...withRole, ...leagueAdminItems];
```

---

## 5. Role Assignment — Where and How

### Step 1 — New user applies (`RegistrationGate.jsx`)

```js
await base44.entities.UserApplication.create({
  user_id, user_email, user_name,
  requested_role: selectedRole,  // chosen by user from dropdown
  status: "Pending",
  applied_at: new Date().toISOString(),
  league_ids, league_team_pairs,
  display_name, handle,          // player-only
  ...
});
await base44.auth.updateMe({ application_status: "Pending" });
```

### Step 2 — Admin approves (`UserApplicationsReview.jsx`)

```js
await base44.functions.invoke('approveUserApplication', {
  applicationId: application.id,
  action: 'approve',   // or 'reject'
});
```

This backend function sets `user_type`, `assigned_league_ids`, and `application_status` on approval.

### Direct assignment by admin (`EnhancedUserManagement.jsx`)

```js
await base44.entities.User.update(userId, {
  user_type: data.user_type,
  assigned_league_ids: data.assigned_league_ids,
  default_league_id: data.default_league_id || null,
});
```

### Invite user with pre-set role (`EnhancedUserManagement.jsx`)

```js
await base44.users.inviteUser(data.email, "user");
await base44.entities.PendingUserAssignment.create({
  email: data.email,
  user_type: data.user_type,
  assigned_league_ids: data.assigned_league_ids,
  applied: false,
});
```

The `PendingUserAssignment` record is applied to the user on their first login (manually or via an onboarding hook).

### Additional league access (`ApplyForLeague.jsx`)

```js
await base44.entities.UserApplication.create({
  ...payload,
  is_additional_request: true,
  current_user_type: currentUser.user_type,
});
```

Admin approves this to add more IDs to `assigned_league_ids`.

### Player identity linking (`PlayerIdentityModal.jsx`)

```js
await base44.entities.UserLeagueIdentity.create({
  user_id, league_id, team_id,
  roster_player_name,
  roster_match_status: "matched" | "unmatched" | "manual_review",
  identity_status: "completed" | "needs_review",
});
await base44.auth.updateMe({
  display_name,
  player_name_status: "completed",
});
```

---

## 6. Role Checking Patterns

All role checks are raw string comparisons — there is no helper function, no enum, and no centralised `hasRole()` utility.

```js
// Single role equality
currentUser?.user_type === 'app_admin'
currentUser?.user_type !== 'app_admin'

// Multi-role OR
currentUser?.user_type === 'app_admin' || currentUser?.user_type === 'league_admin'

// Multi-role negation (AND)
currentUser?.user_type !== 'app_admin' && currentUser?.user_type !== 'league_admin'

// Whitelist via array
["app_admin", "league_admin", "coach", "player"].includes(currentUser.user_type)

// Boolean flag variables (used for readability)
const isAppAdmin = currentUser?.user_type === 'app_admin';
const isLeagueAdmin = currentUser?.user_type === 'league_admin';
const isAdmin = currentUser?.user_type === 'app_admin' || currentUser?.user_type === 'league_admin';

// React Query fetch gate
useQuery({ enabled: currentUser?.user_type === "app_admin" })

// Filtering lists
users.filter(u => u.user_type === 'league_admin')
users.filter(u => u.user_type === 'player')
users.filter(u => u.user_type === 'viewer')
users.filter(u => u.user_type === 'coach')

// Indirect lookup (tab → role mapping in UserRoles.jsx)
const TAB_USER_TYPE = { owners: 'league_admin', coaches: 'coach', players: 'player', viewers: 'viewer' };
users.filter(u => u.user_type === TAB_USER_TYPE[activeTab])
```

---

## 7. Auth-Related Files Inventory

| File | Purpose |
|---|---|
| `src/api/base44Client.js` | Initialises and exports the `base44` SDK client singleton |
| `src/api/entities.js` | Re-exports entity helpers and `base44.auth` |
| `src/api/integrations.js` | Exposes email, SMS, LLM, file-upload integrations |
| `src/lib/AuthContext.jsx` | React context — provides `useAuth()` hook; exposes `currentUser`, `isAuthenticated`, `isLoadingAuth`, `authError` |
| `src/Layout.jsx` | App shell — calls `base44.auth.me()` on mount, detects unapproved users, renders `RegistrationGate`, tracks login events |
| `src/components/registration/RegistrationGate.jsx` | Shown to `user_type === "user"` — collects role request and submits `UserApplication` |
| `src/components/registration/PlayerIdentityModal.jsx` | Player-only post-approval step — links `display_name` and team roster identity |
| `src/components/layout/SidebarMenuContent.jsx` | Role-based navigation rendering |
| `src/pages/UserManagement.jsx` | Admin page shell for user management (delegates to component below) |
| `src/components/admin/EnhancedUserManagement.jsx` | Full user CRUD — add, invite, edit role/leagues, delete users |
| `src/components/admin/UserApplicationsReview.jsx` | Review and approve/reject `UserApplication` records |
| `src/components/admin/PendingUserManagement.jsx` | Manage `PendingUserAssignment` records (pre-configured roles) |
| `src/components/admin/PlayerIdentityAdmin.jsx` | Admin tool to manually review and fix player identity matches |
| `src/components/admin/ApplicationAccess.jsx` | Uses `base44.asServiceRole` to bypass normal user permissions |
| `src/pages/ApplyForLeague.jsx` | Lets existing users request additional league access |
| `src/pages/LeagueUsers.jsx` | League-admin view of users within their leagues |
| `src/pages/RequestManagement.jsx` | App-admin page for reviewing pending applications |

---

## 8. Base44 Auth Patterns

### `base44.auth.*`

| Call | Where Used |
|---|---|
| `base44.auth.me()` | `Layout.jsx`, `AuthContext.jsx`, and virtually every page via `useAuth()` |
| `base44.auth.updateMe(data)` | `RegistrationGate` (set `application_status`), `PlayerIdentityModal` (set `display_name`), `Leagues` (add league to `assigned_league_ids`) |
| `base44.auth.logout(url?)` | `Layout.jsx`, `RegistrationGate.jsx` |
| `base44.auth.redirectToLogin(url)` | `AuthContext.jsx` |

### `base44.entities.User.*`

| Call | Where Used |
|---|---|
| `base44.entities.User.list()` | Many admin pages |
| `base44.entities.User.filter(query)` | `PlayerIdentityAdmin`, role-filtered views |
| `base44.entities.User.update(id, data)` | `EnhancedUserManagement`, `PlayerIdentityAdmin` |
| `base44.entities.User.delete(id)` | `EnhancedUserManagement` |

### `base44.entities.UserApplication.*`

| Call | Where Used |
|---|---|
| `UserApplication.create(data)` | `RegistrationGate`, `ApplyForLeague` |
| `UserApplication.filter(query)` | `UserApplicationsReview`, `ApplyForLeague` |
| `UserApplication.list()` | `UserApplicationsReview` |

### `base44.entities.PendingUserAssignment.*`

| Call | Where Used |
|---|---|
| `PendingUserAssignment.create(data)` | `EnhancedUserManagement`, `PendingUserManagement` |
| `PendingUserAssignment.list()` | `PendingUserManagement` |
| `PendingUserAssignment.filter(query)` | `PendingUserManagement` |
| `PendingUserAssignment.update(id, data)` | `PendingUserManagement` |
| `PendingUserAssignment.delete(id)` | `PendingUserManagement` |

### `base44.entities.UserLeagueIdentity.*`

| Call | Where Used |
|---|---|
| `UserLeagueIdentity.create(data)` | `PlayerIdentityModal` |
| `UserLeagueIdentity.list()` | `UserRoles`, `PlayerIdentityAdmin` |

### `base44.functions.invoke(name, payload)`

| Function Name | Purpose | File |
|---|---|---|
| `approveUserApplication` | Approve or reject a role application; sets `user_type`, leagues, `application_status` | `UserApplicationsReview` |
| `getLeagueUsers` | Fetch users scoped to a set of leagues | `LeagueUsers` |
| `getPublicLeagues` | Public league list for sign-up flow | `RegistrationGate` |
| `sendAccessApprovedEmail` | Email user on role approval | `EnhancedUserManagement` |
| `recordLoginEvent` | Track login for analytics | `Layout` |

### `base44.users.inviteUser(email, role)`

Used in `EnhancedUserManagement` to invite users to the Base44 platform before their app role is configured.

### `base44.asServiceRole.*`

Used in `ApplicationAccess.jsx` to bypass normal user-level permissions when performing privileged reads/writes:
```js
base44.asServiceRole.entities.User.list()
base44.asServiceRole.entities.User.update(id, data)
```

### `base44.analytics.track(event, properties)`

| Event | Properties | File |
|---|---|---|
| `user_login` | `{ username, user_email, user_type }` | `Layout` |
| `page_navigation` | `{ username, user_email, page, user_type }` | `Layout` |
| `user_active` | `{ username, user_email, user_type }` | `Layout` |
| `user_session_end` | `{ username, user_email, session_duration_seconds, session_duration_minutes }` | `Layout` |

---

## Key Architectural Notes

1. **Frontend-only enforcement.** All role checks are React conditionals. The only server-side enforcement visible in the client code is the `approveUserApplication` backend function — everything else relies on the client not calling APIs it shouldn't.

2. **No role hierarchy.** `app_admin` does not implicitly inherit `league_admin` permissions. Every multi-role page explicitly lists both: `user_type === 'app_admin' || user_type === 'league_admin'`.

3. **One global role per user.** A user cannot be `coach` in one league and `player` in another. `user_type` is a single scalar on the user record.

4. **League membership is an array on the user.** `assigned_league_ids: string[]` is the sole source of truth for which leagues a user can see. There is no join table between User and League.

5. **No centralised role constants.** Role strings like `"app_admin"` are hardcoded throughout the codebase with no shared enum or `ROLES` constant file. A typo in any one place would silently break access control for that check.

6. **`base44.asServiceRole`** is used in `ApplicationAccess.jsx` to perform privileged operations — this bypasses the normal permission model and should be audited carefully.

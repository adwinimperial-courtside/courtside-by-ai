# Base44 Dependency Audit

**Date:** 2026-04-15
**Codebase:** `src/`
**Purpose:** Catalogue all Base44 SDK dependencies ahead of migration to Supabase

---

## Summary

| Metric | Count |
|---|---|
| Total `.js`/`.jsx` files in `src/` | 185 |
| Files with any Base44 dependency | **86 (46.5%)** |
| Pages affected | 35 / 35 |
| Components affected | 48 |
| Lib / API files affected | 3 |

| Dependency surface | Unique files |
|---|---|
| Imports `base44Client` | 86 |
| Entity CRUD (`entities.*`) | 61 |
| Auth (`base44.auth.*`) | 38 |
| Functions (`base44.functions.invoke`) | 9 |
| Integrations (LLM, file upload, email) | 6 |
| Analytics (`base44.analytics.track`) | 3 |
| `asServiceRole` | 1 |
| `base44.users` | 1 |

---

## Category 1 — Imports from `@base44/sdk` or `base44Client`

| File | Import |
|---|---|
| `src/api/base44Client.js` | `import { createClient } from '@base44/sdk'` — root client definition |
| `src/lib/AuthContextBase44.jsx` | `import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client'` |

The following **86 files** all contain `import { base44 } from "@/api/base44Client"`:

**Pages (35)**
- `src/pages/AdminTools.jsx`
- `src/pages/AllPlayersView.jsx`
- `src/pages/Analytics.jsx`
- `src/pages/ApplyForLeague.jsx`
- `src/pages/AwardLeaders.jsx`
- `src/pages/CoachInsights.jsx`
- `src/pages/Coaches.jsx`
- `src/pages/DataBackup.jsx`
- `src/pages/DeleteLeague.jsx`
- `src/pages/FixManualStats.jsx`
- `src/pages/GameLog.jsx`
- `src/pages/Landing.jsx`
- `src/pages/LeagueAwardSettings.jsx`
- `src/pages/LeagueIDs.jsx`
- `src/pages/LeagueOwners.jsx`
- `src/pages/LeagueSelection.jsx`
- `src/pages/LeagueUsers.jsx`
- `src/pages/Leagues.jsx`
- `src/pages/LiveBoxScore.jsx`
- `src/pages/LiveGame.jsx`
- `src/pages/PlayerProfile.jsx`
- `src/pages/Players.jsx`
- `src/pages/RegularSeasonRecap.jsx`
- `src/pages/RequestManagement.jsx`
- `src/pages/RosterUserMatching.jsx`
- `src/pages/Schedule.jsx`
- `src/pages/Standings.jsx`
- `src/pages/Statistics.jsx`
- `src/pages/StoryBuilder.jsx`
- `src/pages/Teams.jsx`
- `src/pages/UserManagement.jsx`
- `src/pages/UserRoles.jsx`
- `src/pages/Viewers.jsx`
- `src/pages/Whiteboard.jsx`
- `src/pages/Schedule.jsx`

**Components (48)**
- `src/components/admin/ApplicationAccess.jsx`
- `src/components/admin/ApplyPendingAssignments.jsx`
- `src/components/admin/BulkIdentityMatching.jsx`
- `src/components/admin/CoachesView.jsx`
- `src/components/admin/DeleteGameEntry.jsx`
- `src/components/admin/EditGameEntry.jsx`
- `src/components/admin/EnhancedUserManagement.jsx`
- `src/components/admin/LeagueAccessRequests.jsx`
- `src/components/admin/LeagueOwnersView.jsx`
- `src/components/admin/ManageRequests.jsx`
- `src/components/admin/ManualGameEntry.jsx`
- `src/components/admin/PendingBaseUsers.jsx`
- `src/components/admin/PendingUserManagement.jsx`
- `src/components/admin/PlayerIdentityAdmin.jsx`
- `src/components/admin/PlayerIdentityDetailPanel.jsx`
- `src/components/admin/PlayerLeagueMatchModal.jsx`
- `src/components/admin/PlayerMatchModal.jsx`
- `src/components/admin/PlayersView.jsx`
- `src/components/admin/StatIntegrityChecker.jsx`
- `src/components/admin/UserApplicationsReview.jsx`
- `src/components/admin/UserLeagueAssignment.jsx`
- `src/components/admin/UserManagement.jsx`
- `src/components/admin/ViewersView.jsx`
- `src/components/insights/AITacticalBriefing.jsx`
- `src/components/layout/SidebarMenuContent.jsx`
- `src/components/live/EmergencyLineupRepair.jsx`
- `src/components/live/LiveStatTracker.jsx`
- `src/components/live/ScoreHeader.jsx`
- `src/components/player/PlayerDashboardCard.jsx`
- `src/components/player/PlayerProfileHeader.jsx`
- `src/components/registration/PlayerIdentityModal.jsx`
- `src/components/registration/RegistrationGate.jsx`
- `src/components/schedule/DefaultWinnerDialog.jsx`
- `src/components/schedule/EditGameSettingsDialog.jsx`
- `src/components/schedule/GameCard.jsx`
- `src/components/schedule/POGSpotlightModal.jsx`
- `src/components/teams/CreateTeamDialog.jsx`
- `src/components/teams/EditTeamDialog.jsx`
- `src/components/teams/PlayerManagement.jsx`
- `src/components/teams/TeamDetailView.jsx`

**Lib / API files (3)**
- `src/api/entities.js`
- `src/api/integrations.js`
- `src/lib/AuthContextBase44.jsx`
- `src/lib/NavigationTracker.jsx`
- `src/lib/PageNotFound.jsx`
- `src/Layout.jsx`

---

## Category 2 — Base44 Entity CRUD Patterns

| Method | Instances | Example files |
|---|---|---|
| `.list()` | ~61 files | All pages, most admin components |
| `.filter()` | ~45 files | `LiveGame`, `AdminTools`, `Statistics`, `PlayerProfile` |
| `.get()` | 9 instances | `LiveBoxScore`, `LiveStatTracker`, `GameCard` |
| `.create()` | 26 instances | `RegistrationGate`, `Landing`, `Schedule`, `LiveStatTracker`, `ManualGameEntry` |
| `.update()` | 47 instances | `AdminTools`, `LiveGame`, `FixManualStats`, `ScoreHeader`, `Teams` |
| `.delete()` | 19 instances | `DeleteLeague`, `DataBackup`, `Teams`, `EditGameEntry`, `DeleteGameEntry` |
| `.bulkCreate()` | 2 instances | `LiveGame`, `DataBackup` |
| `.subscribe()` | 7 instances | `LiveBoxScore` (×3), `LiveStatTracker` (×2), `GameCard`, `ScoreHeader` |

### Selected `.create()` calls

```js
// src/pages/Landing.jsx
base44.entities.LeagueSetupRequest.create({ league_name, contact_person, email, message, status: "pending" })

// src/components/registration/RegistrationGate.jsx
base44.entities.UserApplication.create(applicationData)

// src/pages/Schedule.jsx
base44.entities.Game.create(gameData)

// src/components/live/LiveStatTracker.jsx
base44.entities.PlayerStats.create(statData)
base44.entities.GameLog.create(logData)

// src/components/insights/AITacticalBriefing.jsx
base44.entities.TacticalBriefing.create(briefingData)
base44.entities.AIUsageCounter.create({...})
```

### Selected `.subscribe()` calls (real-time)

```js
// src/pages/LiveBoxScore.jsx
base44.entities.PlayerStats.subscribe((event) => { ... })
base44.entities.Game.subscribe((event) => { ... })
base44.entities.GameLog.subscribe((event) => { ... })

// src/components/live/LiveStatTracker.jsx
base44.entities.PlayerStats.subscribe(() => { ... })
base44.entities.GameLog.subscribe(() => { ... })

// src/components/schedule/GameCard.jsx
base44.entities.Game.subscribe((event) => { ... })

// src/components/live/ScoreHeader.jsx
base44.entities.Game.subscribe((event) => { ... })
```

> **Note:** The `.subscribe()` pattern provides real-time updates in `LiveBoxScore`, `LiveGame`, and `GameCard`. The Supabase equivalent is `supabase.channel().on('postgres_changes', ...)`.

---

## Category 3 — Base44 Auth References

| Pattern | Instances | Files |
|---|---|---|
| `base44.auth.me()` | 39 | All 35 pages + `Layout`, `PageNotFound`, `AuthContextBase44`, `LiveStatTracker`, `ApplyPendingAssignments`, `DeleteGameEntry`, `TeamDetailView` |
| `base44.auth.updateMe()` | 8 | `Leagues`, `RegistrationGate`, `PlayerIdentityModal`, `PlayerProfileHeader`, `PlayerDashboardCard` |
| `base44.auth.logout()` | 6 | `Layout`, `AuthContextBase44`, `RegistrationGate` (×3) |
| `base44.auth.redirectToLogin()` | 1 | `AuthContextBase44` |
| `navigateToLogin()` | 2 | `AuthContextBase44` (defined + exported) |

### Notes

- **`base44.auth.me()`** is the universal current-user source. It is called directly in 38 files via `useQuery`, bypassing `AuthContext` entirely. After migration, all of these calls need to be replaced with `useAuth()` drawing from the Supabase session.
- **`base44.auth.updateMe()`** is used to mutate user profile fields (`default_league_id`, `application_status`, `display_name`, `profile_photo_url`). These fields will need equivalents in the `profiles` and `user_league_identity` tables.
- **Real-time subscriptions** in the live game flow currently rely on Base44's entity subscription model. Supabase Realtime (`postgres_changes`) is the direct replacement.

---

## Category 4 — Base44-Specific Globals

### `base44.functions.invoke()` — 19 calls across 9 files

| Function name | File |
|---|---|
| `getLoginAnalytics` (×4) | `src/pages/Analytics.jsx` |
| `recordLoginEvent` | `src/Layout.jsx` |
| `getLeagueUsers` | `src/pages/LeagueUsers.jsx` |
| `applyRosterMatches` | `src/pages/RosterUserMatching.jsx` |
| `getPublicLeagues` | `src/components/registration/RegistrationGate.jsx` |
| `sendAccessApprovedEmail` | `src/components/admin/EnhancedUserManagement.jsx` |
| `matchPlayerLeagues` | `src/components/admin/PlayerLeagueMatchModal.jsx` |
| `getPendingDashboardUsers` | `src/components/admin/PendingBaseUsers.jsx` |
| `approveUserApplication` (×3) | `src/components/admin/PendingBaseUsers.jsx`, `PlayerMatchModal`, `UserApplicationsReview` (×2) |
| `approveLeagueAccess` | `src/components/admin/LeagueAccessRequests.jsx` |
| `applyRosterMatches` | `src/components/admin/BulkIdentityMatching.jsx` |
| `updateUserFullName` | `src/components/admin/PlayerIdentityDetailPanel.jsx` |

These map to Supabase Edge Functions.

### `base44.integrations.Core.*` — 15 calls across 6 files

| Integration | Files |
|---|---|
| `InvokeLLM` | `RegularSeasonRecap`, `StoryBuilder`, `AITacticalBriefing`, `integrations.js` |
| `UploadFile` | `PlayerProfileHeader`, `PlayerDashboardCard`, `EditTeamDialog`, `CreateTeamDialog`, `TeamDetailView`, `integrations.js` |
| `SendEmail` | `integrations.js` (re-export only) |
| `SendSMS` | `integrations.js` (re-export only) |
| `GenerateImage` | `integrations.js` (re-export only) |

These will need replacement providers: Supabase Storage (files), an LLM API (AI features), and a transactional email service (email).

### `base44.analytics.track()` — 8 calls in 2 files

| Event | File |
|---|---|
| `user_login`, `page_navigation`, `user_active`, `user_session_end` | `src/Layout.jsx` (×5) |
| `team_created`, `team_updated`, `team_deleted` | `src/pages/Teams.jsx` (×3) |

### Other globals

| Pattern | File | Notes |
|---|---|---|
| `base44.asServiceRole.*` | `src/components/admin/ApplicationAccess.jsx` | Privileged list/update/delete bypassing RLS — maps to Supabase service role key in Edge Functions |
| `base44.users.inviteUser()` | `src/components/admin/EnhancedUserManagement.jsx` | Maps to `supabase.auth.admin.inviteUserByEmail()` |
| `appParams` | `src/lib/app-params.js`, `base44Client.js`, `AuthContextBase44` | Base44 app ID/token config — not needed post-migration |
| `VisualEditAgent` | `src/App.jsx`, `src/lib/VisualEditAgent.jsx` | Base44 visual editor — can be removed |
| `iframe-messaging` | `src/App.jsx` | Base44 platform integration — can be removed |
| `UserNotRegisteredError` | `src/components/UserNotRegisteredError.jsx` | Base44-specific error state — no longer rendered after `App.jsx` update |

---

## Conclusion

### A page-by-page frontend rebuild is recommended over a surgical migration

The audit shows that **86 of 185 files (46.5%)** in `src/` have a direct Base44 dependency, and **every single page** (35/35) is affected. The dependencies are not concentrated in a thin data layer — they are woven through every page, every component, and every data fetch.

A surgical migration (find-and-replace Base44 calls with Supabase equivalents file-by-file) carries the following risks:

1. **No clean seam to cut at.** `base44.auth.me()` is called directly in 38 files rather than flowing exclusively through `AuthContext`. There is no single abstraction to swap.

2. **Entity methods are not a 1:1 mapping.** Base44's `.filter()`, `.list()`, `.subscribe()` methods carry implicit query semantics (sorting, pagination, real-time) that must be individually re-expressed as Supabase queries, React Query hooks, and Realtime channel subscriptions.

3. **Backend functions have no Supabase equivalents yet.** 19 `base44.functions.invoke()` calls reference backend functions (`approveUserApplication`, `getLeagueUsers`, `recordLoginEvent`, etc.) that do not yet exist as Supabase Edge Functions. Surgical migration stalls until every one is ported.

4. **Integrations need replacing.** LLM calls, file uploads, and email sending all go through `base44.integrations.Core.*`. These need separate provider decisions before any component that uses them can be migrated.

5. **Partial migration creates a broken middle state.** Running Base44 and Supabase side-by-side for auth, data, and real-time simultaneously introduces split state, double fetching, and auth race conditions that are difficult to test.

### Recommended approach

Rebuild the frontend page-by-page against the new Supabase schema, starting from the lowest-dependency pages and working up to the most complex (live game tracking). The new schema (`20260415000000_initial_schema.sql`) is already deployed. The new `AuthContext.jsx` and `LoginPage.jsx` are already wired. The foundation is in place — the rebuild can proceed incrementally with each new page replacing its Base44 predecessor.

**Suggested rebuild order (lowest → highest Base44 dependency):**

1. `Landing` — public page, minimal data
2. `Standings`, `AwardLeaders` — read-only, simple queries
3. `Schedule`, `Teams`, `Players` — standard CRUD
4. `Statistics`, `PlayerProfile`, `CoachInsights` — aggregation queries
5. `Leagues`, `LeagueUsers`, `UserRoles` — membership + role logic
6. Admin pages (`UserManagement`, `RequestManagement`, etc.) — requires Edge Functions
7. `LiveGame`, `LiveBoxScore` — real-time subscriptions (most complex)

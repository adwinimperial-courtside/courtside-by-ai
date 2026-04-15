# Courtside by AI — Frontend Rebuild Plan
**Date:** 2026-04-15
**Status:** Approved — ready for execution

---

## Context

The Base44 dependency audit found 86 of 185 files (46.5%) coupled to Base44 — every single page is affected. A surgical migration is not viable. The decision is to rebuild the frontend page by page against Supabase, using existing UI as a visual reference but rewriting all data logic from scratch.

---

## User Roles

| Role | Description |
|------|-------------|
| app_admin | Full platform access across all leagues |
| league_admin | Full access within their league(s) |
| coach | Access to their team and coaching tools |
| player | Access to their profile and league data |
| viewer | Read-only access to league data |

---

## Pages — Final List

### Kept and rebuilt
| Page | Notes |
|------|-------|
| Landing.jsx | Public marketing page — rebuild clean |
| Home.jsx | Redirect stub — trivial rebuild |
| Leagues.jsx | Main dashboard — high priority |
| LeagueSelection.jsx | New user onboarding — high priority |
| ApplyForLeague.jsx | Apply to additional leagues |
| Schedule.jsx | Game schedule and creation |
| Standings.jsx | Team standings |
| Statistics.jsx | Stats dashboard |
| Players.jsx | Player directory (app_admin) |
| PlayerProfile.jsx | Individual player dashboard |
| Teams.jsx | Team management |
| LiveGame.jsx | Live stat tracking — highest complexity |
| LiveBoxScore.jsx | Real-time box score |
| AwardLeaders.jsx | Award rankings |
| CoachInsights.jsx | Coach analytics dashboard |
| LeagueAwardSettings.jsx | Award weight configuration |
| LeagueUsers.jsx | User management per league |
| UserRoles.jsx | User directory by role |
| UserManagement.jsx | App admin user management |
| RequestManagement.jsx | Approve/reject user applications |
| AdminTools.jsx | App admin game management tools |
| AllPlayersView.jsx | App admin all-players table |
| Coaches.jsx | App admin coaches list |
| LeagueOwners.jsx | App admin league admins list |
| Viewers.jsx | App admin viewers list |
| GameLog.jsx | Audit log |
| LeagueIDs.jsx | Internal ID reference (review later) |
| DeleteLeague.jsx | Delete league with confirmation |
| RegularSeasonRecap.jsx | End of season summary with AI narrative |
| StoryBuilder.jsx | AI game story generator |
| Whiteboard.jsx | Tactical drawing canvas |
| DataBackup.jsx | DB backup — JSON export + Supabase dump |
| Analytics.jsx | User engagement — logins per day, active users, last login lookup |
| RosterUserMatching.jsx | Match applicant to existing player record |

### Removed
| Page | Reason |
|------|--------|
| FixManualStats.jsx | Base44-specific stats storage quirk — not needed on Supabase |

---

## Rebuild Order

### Phase 1 — Foundation (no data dependencies)
| Priority | Page | Why |
|----------|------|-----|
| 1 | Home.jsx | Trivial redirect — establishes routing pattern |
| 2 | Landing.jsx | Public page — no auth required |
| 3 | LeagueSelection.jsx | First screen new users see — critical path |

### Phase 2 — Core Navigation
| Priority | Page | Why |
|----------|------|-----|
| 4 | Leagues.jsx | Main dashboard — gate to everything else |
| 5 | Teams.jsx | Required before players or games |
| 6 | Players.jsx | Required before profiles or stats |
| 7 | Schedule.jsx | Required before live game or standings |

### Phase 3 — League Operations
| Priority | Page | Why |
|----------|------|-----|
| 8 | Standings.jsx | Depends on games and teams |
| 9 | Statistics.jsx | Depends on player stats |
| 10 | PlayerProfile.jsx | Depends on players and stats |
| 11 | AwardLeaders.jsx | Depends on stats and award settings |
| 12 | LeagueAwardSettings.jsx | Config for award calculations |
| 13 | LeagueUsers.jsx | User management within a league |
| 14 | ApplyForLeague.jsx | Apply to additional leagues |
| 15 | RequestManagement.jsx | Approve/reject applications |
| 16 | RosterUserMatching.jsx | Match applicant to player record |

### Phase 4 — Live Game
| Priority | Page | Why |
|----------|------|-----|
| 17 | LiveGame.jsx | Core product feature — stat tracking |
| 18 | LiveBoxScore.jsx | Real-time box score — depends on LiveGame |

### Phase 5 — Coaching Tools
| Priority | Page | Why |
|----------|------|-----|
| 19 | CoachInsights.jsx | Analytics for coaches |
| 20 | Whiteboard.jsx | Tactical canvas — self-contained |

### Phase 6 — AI Features
| Priority | Page | Why |
|----------|------|-----|
| 21 | StoryBuilder.jsx | AI game narrative — needs Edge Function |
| 22 | RegularSeasonRecap.jsx | End of season AI summary |

### Phase 7 — App Admin Tools
| Priority | Page | Why |
|----------|------|-----|
| 23 | AdminTools.jsx | Manual game entry and score tools |
| 24 | AllPlayersView.jsx | All players across all leagues |
| 25 | Coaches.jsx | All coaches across all leagues |
| 26 | LeagueOwners.jsx | All league admins |
| 27 | Viewers.jsx | All viewers |
| 28 | UserRoles.jsx | User directory by role |
| 29 | UserManagement.jsx | Full user management |
| 30 | Analytics.jsx | User engagement dashboard |
| 31 | GameLog.jsx | Audit log |
| 32 | LeagueIDs.jsx | Internal ID reference |
| 33 | DeleteLeague.jsx | Destructive action — build last |
| 34 | DataBackup.jsx | JSON export + Supabase DB dump |
---

## Rebuild Rules

- One page at a time — complete, test, commit before moving to next
- Every page gets a feature branch: feature/rebuild-[pagename]
- No Base44 imports in any rebuilt file
- All data fetching via Supabase client (supabaseClient.js)
- All auth via useAuth() from AuthContext.jsx
- All UI strings via react-i18next (no hardcoded English)
- All datetimes stored as timestamptz, displayed in user local timezone via Day.js
- RLS handles data isolation — no manual tenant filtering in frontend code
- Each page must be tested with at least two different user roles before sign-off

---

## Definition of Done — Per Page

- [ ] Page loads without errors
- [ ] Data reads from Supabase correctly
- [ ] Data writes to Supabase correctly
- [ ] Correct data shown per user role
- [ ] RLS confirmed — user cannot see data they should not
- [ ] No Base44 imports remaining
- [ ] Committed to feature branch and pushed

---

## Definition of Done — Full Rebuild

- [ ] All 34 pages rebuilt and passing per-page checklist
- [ ] Automated RLS tests passing
- [ ] End-to-end test with a real league (at least one game tracked live)
- [ ] Base44 app still live and untouched
- [ ] Win has reviewed and approved each phase before next phase begins

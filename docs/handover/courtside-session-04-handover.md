# Courtside by AI — Session 04 Handover
**Date:** 2026-04-15
**Next action:** Start Phase 1 frontend rebuild — Home.jsx, Landing.jsx, LeagueSelection.jsx

---

## What Was Accomplished This Session

1. Migration file committed to Git on feature/initial-schema branch
2. @supabase/supabase-js installed
3. Supabase client created at src/lib/supabaseClient.js
4. Login page built at src/components/auth/LoginPage.jsx — email/password, Google/Microsoft/Facebook placeholders
5. Auth context migrated from Base44 to Supabase at src/lib/AuthContext.jsx — original preserved as AuthContextBase44.jsx
6. App.jsx updated — auth gate now uses Supabase session, LoginPage shown when not authenticated
7. Login tested and confirmed working in browser
8. Base44 dependency audit completed and saved to docs/audit/base44-dependency-audit.md
9. Frontend rebuild plan created and saved to docs/planning/frontend-rebuild-plan.md
10. All work committed and pushed to feature/initial-schema

---

## Key Findings — Base44 Audit

- 86 of 185 files (46.5%) are coupled to Base44
- Every single page (35/35) is affected
- Surgical migration is not viable — decision made to rebuild page by page
- Two critical replacement paths: entity CRUD (61 files) and base44.auth.me() (38 files)

---

## Rebuild Decision

The frontend will be rebuilt page by page against Supabase. Existing UI is used as a visual reference but all data logic is rewritten from scratch. FixManualStats.jsx is the only page being dropped.

---

## Rebuild — Working Rules

- One page at a time — complete, test, commit before moving to next
- Every page gets its own feature branch: feature/rebuild-[pagename]
- No Base44 imports in any rebuilt file
- All data fetching via src/lib/supabaseClient.js
- All auth via useAuth() from src/lib/AuthContext.jsx
- All UI strings via react-i18next — no hardcoded English
- All datetimes stored as timestamptz, displayed in user local timezone via Day.js
- RLS handles data isolation — no manual tenant filtering in frontend code
- Each page tested with at least two different user roles before sign-off
- One chat session per phase — start each phase with a fresh chat

---

## Rebuild Order — Full Plan

See docs/planning/frontend-rebuild-plan.md for the complete plan.

### Phase 1 — Foundation (next session)
| Priority | Page | Why |
|----------|------|-----|
| 1 | Home.jsx | Trivial redirect — establishes routing pattern |
| 2 | Landing.jsx | Public page — no auth required |
| 3 | LeagueSelection.jsx | First screen new users see — critical path |

### Phase 2 — Core Navigation
| Priority | Page | Why |
|----------|------|-----|
| 4 | Leagues.jsx | Main dashboard |
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
| 18 | LiveBoxScore.jsx | Real-time box score |

### Phase 5 — Coaching Tools
| Priority | Page | Why |
|----------|------|-----|
| 19 | CoachInsights.jsx | Analytics for coaches |
| 20 | Whiteboard.jsx | Tactical canvas |

### Phase 6 — AI Features
| Priority | Page | Why |
|----------|------|-----|
| 21 | StoryBuilder.jsx | AI game narrative |
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

## Supabase Project

| Field | Value |
|-------|-------|
| Project name | courtside |
| Project ref | bikjkoyodkduhnnlbzpb |
| Project URL | https://bikjkoyodkduhnnlbzpb.supabase.co |
| Region | eu-central-1 (Frankfurt) |
| Publishable key | sb_publishable_feazoLkkfHT18LYN5HhNzw_GiOWA58o |
| Secret key | Apple Keychain: "Supabase courtside — secret key" |
| Database password | Apple Keychain: "Supabase courtside — database password" |
| Win admin user ID | 425cb41e-6d1f-405f-b871-9b306b9f3c1a |
| Win admin email | adwin.imperial@gmail.com |
| Win admin password | Apple Keychain: "Supabase courtside — Win admin password" |

---

## Git — Current State

| Item | Value |
|------|-------|
| Active branch | feature/initial-schema |
| Remote | GitHub |
| Main branch | main — always deployable, never edited directly |
| Feature branch convention | feature/rebuild-[pagename] per page |

---

## Files Created This Session

| File | Purpose |
|------|---------|
| src/lib/supabaseClient.js | Supabase client initialisation |
| src/components/auth/LoginPage.jsx | Login page with email/password and OAuth placeholders |
| src/lib/AuthContext.jsx | Supabase auth context — session, currentUser, signOut |
| src/lib/AuthContextBase44.jsx | Preserved original Base44 auth context |
| docs/audit/base44-dependency-audit.md | Full Base44 dependency audit |
| docs/planning/frontend-rebuild-plan.md | Phased frontend rebuild plan |

---

## How Claude Should Work — Standing Instructions

These apply every session unless Win says otherwise.

### Communication
- Address Win by name occasionally but naturally
- Be direct — skip all filler phrases
- Never repeat back what Win just said before responding
- Default to concise — offer to go deeper only if Win asks
- Ask all clarifying questions in one message, never one at a time

### Coding
- Confirm understanding in one plain-English sentence before writing any code
- One step at a time — wait for confirmation before proceeding
- Complete code only — never partial snippets
- Always state the exact file path and whether it is new or replacing existing
- Always include a test step — tell Win what to click and what to look for
- Never proceed without Win's explicit confirmation

### Claude Code First
- Default to giving Win a single Claude Code prompt that handles multiple steps at once
- Never drip-feed terminal commands one at a time
- Win pastes one prompt, Claude Code executes, Win pastes back the result

### Error Handling
- Explain the error in one plain-English sentence
- Provide exact corrected code
- State exactly where to apply it

### Session Structure
- One chat per phase of the rebuild
- Start every session with AccountBriefingProtoMax.md and the latest handover doc attached
- At the end of each session, generate an updated handover doc before closing
- When the session is getting long, proactively suggest wrapping up and generating a handover

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

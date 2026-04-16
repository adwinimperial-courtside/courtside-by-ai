# Courtside by AI — Session 05 Handover
**Date:** 2026-04-15
**Next action:** Start Phase 2 — Leagues.jsx, Teams.jsx, Players.jsx, Schedule.jsx

---

## What Was Accomplished This Session

1. Phase 1 frontend rebuild completed — Home.jsx, Landing.jsx, LeagueSelection.jsx all rebuilt against Supabase
2. New migration created and applied: `default_league_id` added to `profiles` table
3. `react-i18next` and `i18next` installed (were missing from project)
4. App.jsx updated — Landing is now a public route (no auth required)
5. All changes committed to `feature/initial-schema` branch
6. Temp file `docs/temp/schema-and-routes.txt` deleted and removed from Git

---

## Phase 1 — Verified Working

| Page | Status | Notes |
|------|--------|-------|
| Landing.jsx | ✅ Working | Marketing page — nav, hero, features, footer |
| Home.jsx | ✅ Working | Pure router — unauthenticated → Landing, authenticated → LeagueSelection |
| LeagueSelection.jsx | ✅ Working | Shows "Choose your league" — empty because no league memberships in Supabase yet |

**LeagueSelection shows no leagues** — expected. Win's Supabase user has no `user_league_memberships` rows yet. This will be resolved when test data is set up in Phase 2.

**LeagueSelection renders inside the Layout sidebar** — noted as a potential visual issue to revisit. Could be made fullscreen without the sidebar if preferred.

---

## Database — Current State

| Item | Value |
|------|-------|
| Migration applied | `20260415000001_add_default_league.sql` |
| New column | `profiles.default_league_id uuid references leagues(id) on delete set null` |
| RLS note | `profiles` RLS policies (user can read own, user can update own) already existed before this migration — migration was corrected to use `add column if not exists` only |

---

## Routing Logic — Confirmed and Built

| Condition | Destination |
|-----------|-------------|
| Not logged in | Landing.jsx |
| Logged in, 1 league | Auto-set default → Schedule.jsx |
| Logged in, 2+ leagues, no default set | LeagueSelection.jsx |
| Logged in, 2+ leagues, default already set | Schedule.jsx |

After picking a league in LeagueSelection: saves `default_league_id` to `profiles`, navigates to Schedule.jsx.

---

## Git — Current State

| Item | Value |
|------|-------|
| Active branch | feature/initial-schema |
| Last commit | e15e4d8 — chore: remove temp schema dump file |
| Phase 1 commit | 97582d1 — feat: Phase 1 complete |
| Remote | GitHub |
| Main branch | main — always deployable, never edited directly |

---

## Files Changed This Session

| File | Change |
|------|--------|
| src/pages/Home.jsx | Rebuilt — pure router, no UI |
| src/pages/Landing.jsx | Rebuilt — marketing page, no Base44 dependencies |
| src/pages/LeagueSelection.jsx | Rebuilt — Supabase-backed league picker |
| src/App.jsx | Updated — Landing exposed as public route |
| supabase/migrations/20260415000001_add_default_league.sql | Created and applied |
| package.json | react-i18next and i18next added |

---

## Known Issues Carried Forward

- All Phase 2–7 pages still use Base44 SDK — 404 errors in console are expected until each page is rebuilt
- LeagueSelection shows empty state for Win's account — no league memberships in Supabase yet
- i18n is imported in Landing and LeagueSelection but no translation files exist yet — falls back to default English strings (working correctly for now)

---

## Phase 2 — Next Session

Rebuild core navigation pages against Supabase. One page at a time, one feature branch per page.

| Priority | Page | Why |
|----------|------|-----|
| 4 | Leagues.jsx | Main dashboard |
| 5 | Teams.jsx | Required before players or games |
| 6 | Players.jsx | Required before profiles or stats |
| 7 | Schedule.jsx | Required before live game or standings |

**Before starting Phase 2:** Win's Supabase account needs at least one league membership so pages have data to display. Create a test league and membership via the Supabase dashboard or SQL editor.

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

### Claude Code Prompts
- Always put Claude Code prompts in a single fenced code block so they are easy to copy
- Never drip-feed terminal commands one at a time — batch into one Claude Code prompt where possible
- Win pastes one prompt, Claude Code executes, Win pastes back the result

### URLs to Test
- Always put URLs in a fenced code block so they are easy to copy

### Terminal Commands
- Always tell Win which folder to run them in
- Always say what successful output looks like

### Handover Docs
- Generated at the end of every session
- Saved to `docs/handover/` in the repo AND a copy saved to Win's Desktop
- Committed to Git at end of session

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
- Handover docs committed to docs/handover/ in Git and copied to Desktop

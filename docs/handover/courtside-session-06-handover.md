# Courtside by AI — Session 06 Handover
**Date:** 2026-04-15
**Next action:** Start Phase 3 — remaining pages (Standings, Statistics, LiveGame, etc.)

---

## What Was Accomplished This Session

1. Realistic test data created and applied — 12 teams, 144 players, 21 games, full box scores for 12 completed games
2. Migration applied: `20260415000002_test_data.sql`
3. Migration applied: `20260415000003_team_and_player_fields.sql` — adds `head_coach`, `manager` to teams; `is_captain` to players
4. Migration applied: `20260415000004_game_fields.sql` — adds `game_stage`, `exclude_from_awards`, `is_default_result`, `default_winner_team_id`, `default_loser_team_id`, `default_reason`, `game_mode`, `period_type`, `period_count`, `period_minutes`, `overtime_minutes`, `player_of_game` to games
5. Phase 2 frontend rebuild completed: Leagues, Teams, Players, Schedule

---

## Phase 2 — Verified Working

| Page | Status | Notes |
|------|--------|-------|
| Leagues.jsx | ✅ Working | Shows Korisliiga Pro with League Admin badge |
| Teams.jsx | ✅ Working | Shows all 12 teams with colours, edit/delete on hover |
| TeamDetailView.jsx | ✅ Working | Inline player roster, captain flag, head coach display |
| Players.jsx | ✅ Working | Redirect to Teams — player management lives in TeamDetailView |
| Schedule.jsx | ✅ Working | Games list with date, venue, team colours, Start/Default/Settings buttons |

---

## Database — Current State

| Migration | Description |
|-----------|-------------|
| 20260415000000_initial_schema.sql | Full initial schema |
| 20260415000001_add_default_league.sql | Adds default_league_id to profiles |
| 20260415000002_test_data.sql | Realistic test data — Korisliiga Pro |
| 20260415000003_team_and_player_fields.sql | head_coach, manager, is_captain |
| 20260415000004_game_fields.sql | Full game fields (stage, mode, default result, POG etc.) |

---

## Git — Current State

| Item | Value |
|------|-------|
| Active branch | feature/initial-schema |
| Last commit | d2dadd9 — feat: rebuild Schedule.jsx against Supabase |
| Remote | GitHub |
| Main branch | main — always deployable, never edited directly |

---

## Files Changed This Session

| File | Change |
|------|--------|
| src/pages/Leagues.jsx | Rebuilt against Supabase |
| src/components/leagues/LeagueCard.jsx | Rebuilt — role badge, country, Supabase fields |
| src/components/leagues/CreateLeagueDialog.jsx | Placeholder — needs Edge Function |
| src/pages/Teams.jsx | Rebuilt against Supabase |
| src/components/teams/TeamCard.jsx | Rebuilt — removed Base44 fields |
| src/components/teams/CreateTeamDialog.jsx | Rebuilt — head_coach, manager fields |
| src/components/teams/EditTeamDialog.jsx | Rebuilt — head_coach, manager fields |
| src/components/teams/TeamDetailView.jsx | Rebuilt — full inline player management |
| src/pages/Players.jsx | Redirect to Teams |
| src/pages/Schedule.jsx | Rebuilt against Supabase |
| src/components/schedule/GameCard.jsx | Rebuilt — Supabase stat columns, box score expand |
| src/components/schedule/CreateGameDialog.jsx | Rebuilt against Supabase |
| src/components/schedule/EditGameSettingsDialog.jsx | Rebuilt against Supabase |
| src/components/schedule/DefaultWinnerDialog.jsx | Rebuilt against Supabase |
| src/components/schedule/POGSpotlightModal.jsx | Stub — deferred to Player Profile phase |
| supabase/migrations/20260415000002_test_data.sql | Created and applied |
| supabase/migrations/20260415000003_team_and_player_fields.sql | Created and applied |
| supabase/migrations/20260415000004_game_fields.sql | Created and applied |

---

## Known Issues / Stubbed Features

| Item | Status | Notes |
|------|--------|-------|
| Create League | Stub dialog | Needs Supabase Edge Function — service role only |
| Logo upload | Disabled with warning | Needs Supabase Storage configuration |
| POGSpotlightModal | Stub | Deferred to Player Profile phase |
| TeamDetailView from Teams | Working | Player management fully functional |
| League filter on Schedule | Hidden when 1 league | Correct — appears for multi-league users |

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

## Test Data — Korisliiga Pro

| Item | Value |
|------|-------|
| League ID | a1000000-0000-0000-0000-000000000001 |
| League name | Korisliiga Pro |
| Teams | 12 (Helsinki Seagulls, Espoo Storm, Tampere Thunder, Turku Lynx, Oulu Wolves, Jyväskylä Jets, Lahti Bears, Kuopio Kings, Pori Panthers, Rovaniemi Reindeer, Vaasa Vikings, Joensuu Falcons) |
| Players | 144 (12 per team) |
| Games | 21 total — 12 final with box scores, 1 live, 8 scheduled |

---

## File Workflow — Important

**ClaudeFiles directory:** `/Users/macm5pro/Projects/courtside/docs/ClaudeFiles/`

This is where Win saves files downloaded from Claude chat, so Claude Code can pick them up.

**From next session onwards:** Claude will deliver all code as a single Claude Code prompt that writes files directly to their correct paths. Win pastes one prompt, Claude Code does everything. No manual downloading or copying.

---

## Role Permissions — Standing Rules

These apply to every page and mutation going forward:

| Role | Access |
|------|--------|
| app_admin | Full access everywhere |
| league_admin | Create/edit/delete within their own league |
| coach | Read-only (exception: stat entry during live games — TBC) |
| player | Read-only of their own league/team data |
| viewer | Read-only, no mutations ever |

---

## Data Safety — Standing Rules

- **Always soft-delete** (`is_active = false`) by default — never hard-delete from frontend
- **Never cascade-delete from frontend** — let the database handle cascades
- **Always confirm** before any destructive operation
- **Never expose service role key** in frontend code

---

## Supabase Patterns — Standing Rules

- Always check RLS policy for a table before writing insert/update
- Never use plain `timestamp` — always `timestamptz`
- Service role operations must go through Edge Functions, never frontend

---

## Before Writing Any Page — Standing Rules

- Always read ALL child components before writing anything
- Flag any component being stubbed and note which phase it gets built in
- Check schema before assuming a column exists — ask Win to confirm if uncertain
- Always check Base44 field names against Supabase schema — they often differ

---

## Test Data Standards — Standing Rules

- Minimum 10 teams per league, minimum 10 players per team
- Games must have realistic scores, realistic box scores, mix of completed/live/upcoming
- Always deliver as a migration file, never raw SQL to paste once
- All player names, venues, and game data must be realistic for the league's country

---

## Phase 3 — Next Session

Remaining pages to rebuild. Priority order:

| Priority | Page | Notes |
|----------|------|-------|
| 1 | LiveGame.jsx | Core product feature — real-time stat entry |
| 2 | LiveBoxScore.jsx | Companion to LiveGame |
| 3 | Standings.jsx | Calculated from games table |
| 4 | Statistics.jsx | Aggregated from player_stats |
| 5 | PlayerProfile.jsx | Individual player view |

**Before starting LiveGame:** Need to audit LiveGame.jsx and all its child components — this is the most complex page in the app.

---

## How Claude Should Work — Standing Instructions

### Communication
- Address Win by name occasionally but naturally
- Be direct — skip all filler phrases
- Never repeat back what Win just said
- Default to concise — offer to go deeper only if Win asks
- Ask all clarifying questions in one message

### Coding
- Confirm understanding in one plain-English sentence before writing any code
- One feature at a time — wait for confirmation before proceeding
- Always state the exact file path and whether it is new or replacing existing
- Always include a test step
- Never proceed without Win's explicit confirmation

### File Delivery — NEW FROM THIS SESSION
- Always deliver code as a single Claude Code prompt that writes files directly to correct paths
- Never ask Win to download files and copy them manually
- Win pastes one prompt, Claude Code executes, Win reports back result

### Claude Code Prompts
- Always put Claude Code prompts in a single fenced code block
- Batch all file writes into one prompt where possible

### Saving Files for Claude to Read
- When Claude needs to read a file, ask Win to save it to docs/temp/
- If the output will be long, ask Claude Code to save it as a file first, then upload
- Win does NOT need to paste back confirmation of successful steps — just report failures

### Handover Docs
- Generated at end of every session
- Saved to docs/handover/ in repo AND Desktop
- Committed to Git at end of session

### Error Handling
- Explain error in one plain-English sentence
- Provide exact corrected code
- State exactly where to apply it

### Session Structure
- One chat per phase
- Start every session with AccountBriefingProtoMax.md and latest handover doc
- Generate updated handover before closing
- When session is getting long, proactively suggest wrapping up

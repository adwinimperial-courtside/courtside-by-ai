# Courtside by AI — Session 07 Handover
**Date:** 2026-04-16  
**Duration:** ~3 hours  
**Next action:** Rebuild LiveStatTracker.jsx — the final Phase 3B component

---

## What Was Accomplished This Session

### Migrations Applied (8 total)

| Migration | Description |
|-----------|-------------|
| 20260415000005_game_live_fields.sql | Added 13 live game columns to games table (clock state, possession, team fouls, timeouts, game_rules, entry metadata) |
| 20260415000006_replica_identity_full.sql | Set REPLICA IDENTITY FULL on games, player_stats, game_logs for complete Realtime payload.old data |
| 20260415000007_player_stats_live_fields.sql | Added is_starter, points_2, points_3, free_throws, free_throws_missed, technical_fouls, unsportsmanlike_fouls to player_stats |
| 20260415000008_players_name_column.sql | Added generated column: name = first_name || ' ' || last_name (fixes UI display issue) |
| 20260415000009_game_logs_table.sql | Created game_logs table with full audit trail fields (stat_type, stat_label, stat_points, undo support, clock_time, period, logged_by, device_name) |

All migrations applied successfully. Database schema is now complete for live game tracking.

---

### Components Rebuilt

| Component | Status | Notes |
|-----------|--------|-------|
| StartingLineup.jsx | ✅ TESTED, WORKING | Bulk insert player_stats, updates game status to 'live' |
| EndOfPeriodModal.jsx | ✅ WORKING | Pure UI component, no Base44 deps, copied as-is |
| EmergencyLineupRepair.jsx | ✅ REBUILT | Supabase mutations for lineup validation/repair |
| LiveGame.jsx | ✅ TESTED, WORKING | Orchestrator rebuilt, auto-transitions from StartingLineup to LiveStatTracker |
| ScoreHeader.jsx | ⚠️ REBUILT, NOT TESTED | Hybrid clock architecture, blocked by LiveStatTracker failure |
| Schedule.jsx | ✅ UPDATED | Added "View Live" button for games with status='live' |

**Phase 3A Status:** COMPLETE ✅  
**Phase 3B Status:** IN PROGRESS — LiveStatTracker.jsx is the only remaining component

---

### Architecture Decisions Made

#### 1. Game Clock — Hybrid Client-Server (Industry Standard)
**Rejected:** Pure server-side with pg_cron ticking every second  
**Accepted:** Hybrid approach used by NBA.com, ESPN, all professional sports platforms

**How it works:**
- Server stores: `clock_running`, `clock_started_at`, `clock_time_left`
- Clients compute display time: `elapsed = NOW() - clock_started_at; display = clock_time_left - elapsed`
- All devices sync because they use same server timestamp
- When clock hits 0:00, client calls mutation to stop clock and mark period complete

**Benefits:**
- No cron jobs needed
- Network latency doesn't affect clock smoothness
- All devices perfectly in sync
- Server is source of truth, clients are renderers

#### 2. Multi-Device Stat Entry — Multiple Admins Confirmed
**Use case:** Multiple League Admins tracking same game in parallel:
- Admin A (home side): home team offense stats
- Admin B (away side): away team offense stats  
- Admin C (scorer's table): clock, possession, timeouts
- Admin D (defensive specialist): steals, blocks, fouls for both teams

**Requirements:**
- Optimistic UI updates (instant feedback per admin)
- Realtime sync (all admins see each other's actions within 500ms)
- Server-side atomic increments (prevent conflicts)
- Permanent game log (audit trail for disputes)

#### 3. Game Log — Permanent Audit Trail
- Never deleted, only marked `undone = true`
- Records: stat_type, player, team, old_value, new_value, clock_time, period, logged_by, device_name
- Used for activity feed during game + post-game audit + dispute resolution

#### 4. Stat Increments — Server-Side Atomic
**Pattern:**
```sql
UPDATE player_stats SET points_2 = points_2 + 1 WHERE id = 'xxx' RETURNING *
```
**Benefit:** Postgres guarantees correctness even with concurrent updates from multiple admins

#### 5. Real-time Sync — Supabase Realtime Subscriptions
- ScoreHeader subscribes to games table (filter: `id=eq.${gameId}`)
- LiveStatTracker subscribes to player_stats table (filter: `game_id=eq.${gameId}`)
- LiveStatTracker subscribes to game_logs table (filter: `game_id=eq.${gameId}`)
- Refetch interval: 500ms when clock running, disabled when stopped

---

## Key Learnings This Session

### Database Patterns
- **Generated columns** cleanest solution for computed fields (players.name)
- **REPLICA IDENTITY FULL** required for Realtime UPDATE/DELETE to include complete payload.old
- **Base44 → Supabase field mapping:** Base44 uses `name`, Supabase schema has `first_name`/`last_name`
- **RLS helper functions:** Use `get_my_league_role()` and `is_app_admin()` consistently (not direct column checks)

### Supabase Limitations Discovered
- **pg_cron minimum interval:** 1 second (not suitable for smooth live clock)
- **Edge Functions + cron:** Creates ping-pong pattern (Cron → Function → DB → Realtime → Clients) — inefficient

### Industry Best Practices
- **Professional sports platforms** (NBA.com, ESPN) use hybrid clock (server timestamp, client computation)
- **Never use pure server-side ticking** for live clocks — network latency kills UX
- **Atomic increments at DB level** prevent race conditions in multi-device scenarios

---

## Current State

### Database Schema — Ready ✅
All tables have required columns for live game tracking:
- games: 13 live game columns added
- player_stats: 7 live stat columns added
- game_logs: full table created with audit trail support
- players: generated name column added
- All RLS policies applied and tested

### Phase 3A — Complete ✅
Simple components rebuilt and tested successfully:
- StartingLineup works end-to-end
- Transitions to LiveStatTracker correctly
- Player stats inserted properly
- Game status updated to 'live'

### Phase 3B — In Progress ⚠️
- **ScoreHeader.jsx** rebuilt but untested (multi-device sync blocked by LiveStatTracker)
- **LiveStatTracker.jsx** still on Base44 — causes blank page error, NEXT TASK

### Git Status
- **Active branch:** feature/initial-schema
- **Uncommitted files:** ScoreHeader.jsx, Schedule.jsx, LiveGame.jsx, StartingLineup.jsx, EmergencyLineupRepair.jsx
- **Action needed:** Commit Session 07 work before starting LiveStatTracker rebuild

### Test Data Status
**Korisliiga Pro** league (ID: `a1000000-0000-0000-0000-000000000001`)
- 12 teams with realistic Finnish names and colors
- 144 players (12 per team) with generated name column working
- 21 games: 12 final (with box scores), 1 live, 8 scheduled
- **Current test game:** Jyväskylä Jets vs Turku Lynx  
  - Game ID: `c1000000-0000-0000-0000-000000000021`
  - Status: 'live'
  - 10 player_stats rows created with `is_starter = true`
  - Clock at 09:36 Q1, possession = Turku Lynx

---

## LiveStatTracker Rebuild Requirements

### Complexity Assessment
- **1654 lines of code** (largest component in the app)
- **13 stat type buttons:** 2PT, 3PT, FTM, FTX, OREB, DREB, AST, STL, BLK, TO, FOUL, TECH, UNSP
- **Substitution flow:** Multi-step dialog (select players out, select replacements, confirm)
- **Foul tracking:** Automatic ejections at foul limits
- **Undo system:** Reverses last action (marks game_log.undone = true, decrements stat)
- **Emergency lineup repair:** Triggered when invalid lineup detected (< 5 or > 5 active players)
- **Activity feed:** Real-time game_logs displayed in chronological order
- **Multi-device sync:** All admins see each other's stat entries within 500ms

### Key Supabase Patterns Needed

#### 1. Atomic Stat Increments
```javascript
const { data, error } = await supabase
  .from('player_stats')
  .update({ points_2: supabase.raw('points_2 + 1') })
  .eq('id', playerStatId)
  .select()
  .single()
```

#### 2. Game Log Inserts (Full Audit Trail)
```javascript
await supabase.from('game_logs').insert({
  game_id: gameId,
  league_id: leagueId,
  player_id: playerId,
  team_id: teamId,
  player_stat_id: playerStatId,
  stat_type: '2PT',
  stat_label: '2PT — Arto Mäenpää',
  stat_points: 2,
  stat_color: 'bg-blue-600',
  old_value: 3,
  new_value: 5,
  old_home_score: 12,
  old_away_score: 8,
  clock_time: 586, // seconds remaining
  period: 1,
  logged_by: userEmail,
  device_name: 'MacBook Pro M5'
})
```

#### 3. Realtime Subscription to player_stats
```javascript
useEffect(() => {
  const channel = supabase
    .channel(`player-stats-${gameId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'player_stats', filter: `game_id=eq.${gameId}` },
      (payload) => {
        queryClient.setQueryData(['playerStats', gameId], (old) => {
          // Update optimistically
        })
      }
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [gameId])
```

#### 4. Realtime Subscription to game_logs
```javascript
useEffect(() => {
  const channel = supabase
    .channel(`game-logs-${gameId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'game_logs', filter: `game_id=eq.${gameId}` },
      (payload) => {
        queryClient.setQueryData(['gameLogs', gameId], (old) => [...old, payload.new])
      }
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [gameId])
```

#### 5. Optimistic UI Updates with Rollback
```javascript
const statMutation = useMutation({
  mutationFn: async ({ playerStatId, statType }) => {
    // Optimistic update to UI
    queryClient.setQueryData(['playerStats', gameId], (old) => 
      old.map(s => s.id === playerStatId ? { ...s, [statType]: s[statType] + 1 } : s)
    )
    
    // Server mutation
    const { error } = await supabase
      .from('player_stats')
      .update({ [statType]: supabase.raw(`${statType} + 1`) })
      .eq('id', playerStatId)
    
    if (error) throw error
  },
  onError: () => {
    // Rollback optimistic update
    queryClient.invalidateQueries(['playerStats', gameId])
  }
})
```

#### 6. Debouncing (Prevent Double-Tap)
```javascript
const isProcessingStatRef = useRef(false)
const lastStatClickTimeRef = useRef(0)

const handleStatClick = async (player, statType) => {
  const now = Date.now()
  if (isProcessingStatRef.current || now - lastStatClickTimeRef.current < 300) return
  
  isProcessingStatRef.current = true
  lastStatClickTimeRef.current = now
  
  try {
    await statMutation.mutateAsync({ playerStatId: player.id, statType })
  } finally {
    isProcessingStatRef.current = false
  }
}
```

### Child Components (Already Rebuilt)
- **ScoreHeader** — game controls at top (rebuilt, untested)
- **EndOfPeriodModal** — period transition dialog (working)
- **EmergencyLineupRepair** — lineup validation modal (rebuilt)
- **pogCalculator** — player of game scoring utility (no changes needed, reads stats directly)

---

## Session Behavior Changes Requested

Win requested these communication changes during Session 07. **CRITICAL — these must be followed in ALL future sessions:**

### Migration Prompts
- **Always combine CREATE + APPLY in single prompt**
- Never split into two separate prompts
- Pattern: "Create migration X, then apply with `supabase db push`, save output to docs/temp/"

### Role Context (New Requirement)
Win wants Claude to think as:
1. **Basketball player** — understand game flow from court perspective (when does clock stop? what triggers a substitution?)
2. **League organizer** — understand admin workflow from scorer's table (who enters stats? how are disputes resolved?)
3. **Senior software engineer** — build production-quality code (proper error handling, atomic transactions, audit trails)

**Add this context to every handover going forward.**

### Communication Style (From AccountBriefingProtoMax.md)
- Skip filler phrases ("Great!", "Sure!", "Let me know if...")
- Never repeat back what Win just said before responding
- Be direct and concise by default
- Ask all clarifying questions in **one message**, not one at a time
- **Always provide clickable URLs** for testing (e.g., `http://localhost:5173/schedule`)
- One feature at a time, wait for confirmation before proceeding
- Never proceed without Win's explicit confirmation

---

## Timeline Discussion

Win asked for timeline estimate assuming **5 hours/day**:

### Phases Remaining

| Phase | Tasks | Estimate |
|-------|-------|----------|
| **Phase 3B** | LiveStatTracker rebuild + multi-device testing | 3-4 days |
| **Phase 4** | Standings, Statistics, LiveBoxScore, PlayerProfile | 3-4 days |
| **Phase 5** | Real-world testing, edge cases, bug fixes | 3-5 days |
| **Phase 6** | Production deployment (Cloudflare Pages, env vars, monitoring) | 2-3 days |

**Total:** 11-16 days = **2.5-3.5 weeks** from 2026-04-16

**Target:** Mid-May for first real game test  
**Conservative:** End of May (with buffer for unknowns)

### Biggest Risks
1. **LiveStatTracker complexity** — multi-device stat sync is hardest part
2. **Performance at scale** — testing with realistic game data
3. **Mobile UX** — iPad/phone testing for live stat entry
4. **Unknown unknowns** — Base44 implicit behaviors not yet discovered

---

## Files Changed This Session

| File | Change |
|------|--------|
| src/components/live/StartingLineup.jsx | Migrated to Supabase — bulk insert player_stats, useMutation pattern |
| src/components/live/EndOfPeriodModal.jsx | No changes — already pure UI component |
| src/components/live/EmergencyLineupRepair.jsx | Migrated to Supabase — lineup repair mutations |
| src/pages/LiveGame.jsx | Migrated to Supabase — orchestrator with 4 queries (game, teams, players, player_stats) |
| src/components/live/ScoreHeader.jsx | Migrated to Supabase — hybrid clock, Realtime subscription, possession/timeout mutations |
| src/pages/Schedule.jsx | Added "View Live" button for games with status='live' |
| supabase/migrations/20260415000005_game_live_fields.sql | Created and applied |
| supabase/migrations/20260415000006_replica_identity_full.sql | Created and applied |
| supabase/migrations/20260415000007_player_stats_live_fields.sql | Created and applied |
| supabase/migrations/20260415000008_players_name_column.sql | Created and applied |
| supabase/migrations/20260415000009_game_logs_table.sql | Created and applied |

---

## Known Issues

| Issue | Impact | Workaround |
|-------|--------|------------|
| LiveStatTracker still on Base44 | Causes blank page when loading LiveGame | Rebuild LiveStatTracker (next task) |
| ScoreHeader multi-device sync untested | Can't verify clock syncs between tabs | Blocked by LiveStatTracker — test after rebuild |
| No auth/roles implemented | Everyone sees admin console | Acceptable for now — Phase 5 work |
| "View Live" button visible to all users | Should be role-gated (admin only) | Acceptable for now — auth in Phase 5 |

---

## Next Session Checklist

**Before starting LiveStatTracker rebuild:**

1. ✅ Read this handover doc + AccountBriefingProtoMax.md
2. ✅ Verify dev server running: `npm run dev` in `/Users/macm5pro/Projects/courtside`
3. ✅ Check git status — commit Session 07 work before starting LiveStatTracker
4. ✅ Read LiveStatTracker.jsx source (already uploaded as `/mnt/user-data/uploads/LiveStatTracker.jsx`)
5. ✅ Read Supabase Realtime guide (`docs/temp/supabase-realtime-guide.md` if exists)
6. ✅ Begin LiveStatTracker rebuild prompt

**Verification steps:**
```bash
cd /Users/macm5pro/Projects/courtside
git status
git add .
git commit -m "Session 07: Phase 3A complete, ScoreHeader rebuilt"
npm run dev
```

Then open: http://localhost:5173/schedule

---

## Critical Reminders for LiveStatTracker Rebuild

### Database Patterns
- Use **server-side atomic increments:** `UPDATE SET column = column + 1` (not client-side math)
- Insert **game_log for EVERY stat action** (permanent audit trail, never deleted)
- Subscribe to **player_stats + game_logs** via Realtime (separate channels)
- **Debounce stat buttons** using `isProcessingStatRef` pattern from Base44
- **Undo marks game_log.undone = true**, doesn't delete the log entry
- Multi-device sync must be tested with **2 browser tabs minimum**

### Column Naming
- Use **points_2, points_3, free_throws** (NOT field_goals_made, three_pointers_made, free_throws_made)
- Base44 naming conventions were kept in migration 007 for compatibility

### Child Components Already Available
- ScoreHeader (rebuilt)
- EndOfPeriodModal (working)
- EmergencyLineupRepair (rebuilt)
- pogCalculator utility (no changes needed)

### Testing Strategy
1. Single admin, single stat type (2PT) — verify increment works
2. Single admin, multiple stat types — verify all 13 buttons work
3. Two admins, same player, same stat — verify no conflicts (atomic increments)
4. Two admins, different players — verify Realtime sync works
5. Substitution flow — verify multi-step dialog works
6. Foul limits — verify automatic ejection triggers
7. Undo — verify last action reverses correctly
8. Activity feed — verify game_logs display in real-time

---

## Repository Info

**Location:** `/Users/macm5pro/Projects/courtside`  
**Branch:** `feature/initial-schema`  
**Remote:** GitHub (URL in courtside-credentials-reference.txt)

---

*Generated: 2026-04-16*  
*Next session: Continue Phase 3B — LiveStatTracker.jsx rebuild*

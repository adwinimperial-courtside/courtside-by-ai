# ADR-007 — Timezone Handling

**Date:** 2026-04-15
**Status:** Decided
**Decider:** Win

---

## Context

Courtside by AI serves users across multiple timezones simultaneously — Finland (EET, UTC+2/3), Philippines (PST, UTC+8), Spain (CET, UTC+1/2), and Canada (multiple zones, UTC-3.5 to UTC-8). Game schedules, live clocks, and stat timestamps must display correctly for all users regardless of location.

---

## Decision

### 1. Storage — always UTC

All datetimes are stored in UTC in the Supabase database. No exceptions.

```sql
-- All datetime columns use timestamptz (timestamp with time zone)
-- Supabase/PostgreSQL stores these as UTC internally
game_date    timestamptz
created_at   timestamptz default now()
clock_started_at  timestamptz
```

`timestamptz` is used everywhere — never `timestamp` (without timezone), never plain date strings.

### 2. Display — user's local timezone

All datetimes are converted to the user's local timezone before display. A game at 16:00 UTC displays as:
- 19:00 to a user in Finland (UTC+3 in summer)
- 00:00 next day to a user in the Philippines (UTC+8)
- 18:00 to a user in Spain (UTC+2 in summer)
- 12:00 to a user in Toronto (UTC-4 in summer)

### 3. Library — Day.js with timezone plugin

**Day.js** is selected for all datetime formatting and timezone conversion.

```js
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

// Convert UTC datetime from database to user's timezone for display
dayjs.utc(game.game_date).tz(userTimezone).format('DD MMM YYYY, HH:mm')
```

Day.js is lightweight (2kb core), Vite-compatible, and handles all timezone conversion needs for Courtside without unnecessary complexity.

### 4. User timezone detection — auto-detect with manual override

The user's timezone is detected automatically from the browser on first login:

```js
const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
// returns IANA timezone string e.g. "Europe/Helsinki", "Asia/Manila", "Europe/Madrid"
```

This value is stored on the user's profile in Supabase:

```sql
-- Addition to users profile table
alter table profiles
  add column timezone text default 'UTC';
```

On first login, if no timezone is stored, the detected timezone is saved automatically. The user can override it manually in profile settings if needed (e.g. they are travelling).

### 5. Implementation rules

All datetime handling across the codebase follows these rules:

| Rule | Detail |
|------|--------|
| Never store local time | Always convert to UTC before saving to database |
| Never display raw UTC | Always convert to user timezone before rendering |
| Never use `new Date()` for display | Always use Day.js with timezone plugin |
| Never hardcode a timezone | Always use the stored user timezone |
| Live game clocks | Server timestamps in UTC, converted client-side for display |

### 6. Helper functions

A shared utility file handles all timezone operations:

```js
// src/lib/datetime.js

// Format a UTC datetime for display in user's timezone
export const formatLocalTime = (utcDatetime, userTimezone, format = 'DD MMM YYYY, HH:mm') =>
  dayjs.utc(utcDatetime).tz(userTimezone).format(format)

// Format date only
export const formatLocalDate = (utcDatetime, userTimezone) =>
  dayjs.utc(utcDatetime).tz(userTimezone).format('DD MMM YYYY')

// Format time only
export const formatLocalTimeOnly = (utcDatetime, userTimezone) =>
  dayjs.utc(utcDatetime).tz(userTimezone).format('HH:mm')

// Convert local datetime input to UTC for storage
export const toUTC = (localDatetime, userTimezone) =>
  dayjs.tz(localDatetime, userTimezone).utc().toISOString()

// Get user's timezone from profile, fall back to browser detection
export const getUserTimezone = (userProfile) =>
  userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
```

---

## Alternatives Considered

### Luxon

Rejected. More powerful than needed for Courtside's use case. Day.js handles all required timezone operations with a simpler API and smaller bundle size.

### Store datetimes in local time

Rejected. Storing local time creates ambiguity — the database has no way to know which timezone a timestamp belongs to. Comparing or sorting datetimes across users in different timezones becomes unreliable. UTC is the only correct approach for a global app.

### Ask users to set timezone manually

Rejected. Auto-detection from the browser is accurate and eliminates user friction. Manual override is available for edge cases.

---

## Consequences

### Positive
- All datetimes are unambiguous in the database — UTC is universal
- Users in any timezone see correct local times without any manual configuration
- Day.js is lightweight and already compatible with the Vite stack
- Centralised helper functions mean timezone logic is never duplicated

### Negative / risks
- Daylight saving time transitions are handled automatically by the IANA timezone database inside Day.js — but edge cases around DST transitions (clocks going forward/back) should be tested
- If a user's stored timezone is wrong, all their displayed times will be wrong — the auto-detect on first login must be reliable

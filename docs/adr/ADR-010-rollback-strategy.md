# ADR-010 — Rollback Strategy

**Date:** 2026-04-15
**Status:** Decided
**Deciders:** Win

---

## Decision

Rollback to Base44 is supported within a **72-hour window** after cutover. After that window, the strategy is **fix-forward** (patch Supabase, do not revert). If migrating leagues in batches, rollback applies per-league independently.

---

## Context

Base44 stays live and untouched throughout the migration (see ADR-009). The question is: under what conditions and for how long can we revert to it, and what data loss is acceptable?

Key constraints:
- Cutover timing is between seasons/tournaments, never mid-game (ADR-009)
- Some new data will be created in Supabase during the migration window before cutover
- After 72 hours of active use, rolling back to Base44's stale data would cause meaningful data loss and user confusion
- Leagues may be migrated in batches rather than all at once

---

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| No formal rollback plan | Simple | Catastrophic if a critical bug hits post-launch |
| Indefinite rollback window | Maximum safety | Base44 data goes stale quickly; rollback after 1+ week means significant data loss |
| 72-hour window (chosen) | Realistic risk window; limits stale data problem | Requires fast bug detection and decision-making |
| Fix-forward only | Clean; no dependency on Base44 | High risk for a system without production history |

---

## Decision Detail

### Rollback triggers
Rollback is initiated if any of the following occur within the rollback window:

1. **Data loss or corruption** affecting any customer's records
2. **Security breach** — one customer can see or modify another's data (RLS failure)
3. **Core feature failure** — real-time stat tracking, game scoring, or login broken for >20% of users for >30 minutes
4. **Win's discretion** — Win may call a rollback for any reason within the window

### Rollback window
- **72 hours** from the moment the first league goes live on Supabase
- After 72 hours: fix-forward only — patches are applied to Supabase; Base44 is not reinstated

### What rollback means
- DNS/routing is switched back to Base44
- Supabase data written during the live window is **accepted as potentially lost** — users are informed if data loss occurs
- No automated Supabase-to-Base44 sync is built; the window is short enough to make this acceptable
- If the cause of rollback is fixable quickly (< 4 hours), Win may choose to re-migrate rather than lose the window

### Per-league rollback
- If leagues are migrated in batches, each league can be rolled back independently
- Rolling back League A does not affect League B (already on Supabase) or League C (still on Base44)
- Each league's 72-hour window starts from its own cutover moment

### Fix-forward (after rollback window)
- After 72 hours, Base44 is no longer a valid recovery target
- Critical bugs are patched on Supabase directly
- A hotfix branch process is used: `hotfix/description` → tested → merged to `main` → deployed
- Win is notified immediately of any P1 issue regardless of time

### Communication
- During rollback: Win notifies affected league admins directly (no automated messaging system yet)
- Data loss, if any, is disclosed honestly and immediately

---

## Consequences

- Must have fast bug detection in place before cutover — error monitoring (e.g. Sentry) is a pre-cutover requirement
- Win must be reachable during the first 72 hours after each league's cutover
- The 72-hour constraint reinforces the requirement to run thorough automated tests and a staging validation before any cutover
- RLS tests (ADR-002) are non-negotiable before any customer-facing deployment — a security breach is the most serious rollback trigger

---

## Related ADRs

- ADR-002 — RLS policy patterns (security breach trigger)
- ADR-004 — Tenant provisioning flow
- ADR-009 — Data migration strategy (cutover timing, Base44 stays live)

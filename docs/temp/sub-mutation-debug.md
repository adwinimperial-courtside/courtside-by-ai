# Substitution mutation debug — is_active issue

## Root cause

`player_stats` has NO `is_active` column. It only has `is_starter` (added in migration 007).
Every DB write below that includes `is_active` fails with:
  PostgreSQL: ERROR: column "is_active" of relation "player_stats" does not exist
The error is silently swallowed (not destructured or thrown), so `is_starter` is never written.

---

## Affected code (before fix)

### 1. Ejection — line 520
```js
await supabase
  .from('player_stats')
  .update({ is_active: false, is_starter: false })   // ← FAILS: is_active doesn't exist
  .eq('id', playerStat.id);
```

### 2. Undo substitution reversal — lines 676 / 681
```js
supabase.from('player_stats').update({ is_starter: true, is_active: true }).eq('id', s.id)
supabase.from('player_stats').update({ is_starter: false, is_active: false }).eq('id', s.id)
```

### 3. processTeamSub — outgoing player — line 808
```js
await supabase
  .from('player_stats')
  .update({ is_starter: false, is_active: false, minutes_played: totalMin })   // ← FAILS
  .eq('id', outStat.id);
```

### 4. processTeamSub — incoming player (existing row) — line 819
```js
await supabase
  .from('player_stats')
  .update({ is_starter: true, is_active: true })   // ← FAILS
  .eq('id', inStat.id);
```

### 5. processTeamSub — incoming player (new row insert) — line 828
```js
await supabase.from('player_stats').insert({
  ...
  is_starter: true,
  is_active:  true,    // ← FAILS insert: column doesn't exist
  ...
});
```

---

## Fix: remove is_active from all player_stats DB operations

Only `is_starter` exists. All `is_active` references must be removed from updates/inserts.
The optimistic cache update (setQueryData) is JS-only — no DB constraint applies there.

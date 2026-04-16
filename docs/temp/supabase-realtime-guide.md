# Supabase Realtime — Migration Reference Guide

**Context:** Replacing Base44's `Entity.subscribe()` pattern with Supabase Realtime Postgres Changes.

---

## 1. Core Concept

Supabase Realtime listens to Postgres WAL (Write-Ahead Log) events and streams them to connected clients over WebSocket. You subscribe to a **channel**, then register listeners for `postgres_changes` events on a specific table.

**Important prerequisite:** Realtime must be enabled for the table in the Supabase dashboard (Table Editor → Realtime toggle), or via SQL:

```sql
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table player_stats;
```

---

## 2. The Direct Base44 → Supabase Replacement

```javascript
// ─── BASE44 (current) ────────────────────────────────────────────────────────
const unsubscribe = base44.entities.Game.subscribe((event) => {
  if (event.id === game.id) {
    setLocalGame(event.data);
  }
});
// cleanup:
unsubscribe();

// ─── SUPABASE (replacement) ───────────────────────────────────────────────────
const channel = supabase
  .channel(`game-${game.id}`)                    // unique channel name
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',                           // or '*' for all events
      schema: 'public',
      table: 'games',
      filter: `id=eq.${game.id}`,               // server-side row filter
    },
    (payload) => {
      setLocalGame(payload.new);                 // payload.new = updated row
    }
  )
  .subscribe();

// cleanup:
supabase.removeChannel(channel);
```

Key differences:
- **Filter is server-side** — only matching rows are sent over the wire (no client-side `if event.id === game.id` check needed)
- **`payload.new`** contains the full updated row (equivalent to `event.data`)
- **`payload.old`** contains the previous row values (for UPDATE/DELETE, requires `REPLICA IDENTITY FULL` on the table)
- Channel names must be unique per subscription instance

---

## 3. Event Types

| Event string | Postgres operation | `payload` shape |
|---|---|---|
| `'INSERT'` | New row inserted | `{ new: {...}, old: {} }` |
| `'UPDATE'` | Existing row updated | `{ new: {...}, old: {...} }` |
| `'DELETE'` | Row deleted | `{ new: {}, old: {...} }` |
| `'*'` | All of the above | same as above |

> **Note:** `payload.old` only contains data if the table has `REPLICA IDENTITY FULL`. By default Postgres only logs the primary key in old. To enable full old row data:
> ```sql
> alter table games replica identity full;
> alter table player_stats replica identity full;
> ```

---

## 4. Subscribe to All Changes on a Table

```javascript
const channel = supabase
  .channel('all-games-changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'games' },
    (payload) => {
      console.log('Change received:', payload.eventType, payload.new);
    }
  )
  .subscribe();

// Cleanup
supabase.removeChannel(channel);
```

---

## 5. Subscribe to a Specific Row by ID

```javascript
const channel = supabase
  .channel(`game-${gameId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'games',
      filter: `id=eq.${gameId}`,   // PostgREST filter syntax
    },
    (payload) => {
      setGame(payload.new);
    }
  )
  .subscribe();

supabase.removeChannel(channel);
```

**Filter operators available:**
- `id=eq.${value}` — equals (most common)
- `status=eq.live`
- `league_id=eq.${leagueId}`
- Only `eq` is supported for column filters in Realtime (no `in`, `gt`, etc.)

---

## 6. Handling Multiple Event Types on One Channel

Multiple `.on()` calls can be chained on the same channel before `.subscribe()`:

```javascript
const channel = supabase
  .channel(`player-stats-${gameId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'player_stats', filter: `game_id=eq.${gameId}` },
    (payload) => {
      setStats(prev => [...prev, payload.new]);
    }
  )
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'player_stats', filter: `game_id=eq.${gameId}` },
    (payload) => {
      setStats(prev => prev.map(s => s.id === payload.new.id ? payload.new : s));
    }
  )
  .on(
    'postgres_changes',
    { event: 'DELETE', schema: 'public', table: 'player_stats', filter: `game_id=eq.${gameId}` },
    (payload) => {
      setStats(prev => prev.filter(s => s.id !== payload.old.id));
    }
  )
  .subscribe();

supabase.removeChannel(channel);
```

Or use `'*'` and branch on `payload.eventType`:

```javascript
const channel = supabase
  .channel(`player-stats-${gameId}`)
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'player_stats', filter: `game_id=eq.${gameId}` },
    (payload) => {
      if (payload.eventType === 'INSERT') {
        setStats(prev => [...prev, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setStats(prev => prev.map(s => s.id === payload.new.id ? payload.new : s));
      } else if (payload.eventType === 'DELETE') {
        setStats(prev => prev.filter(s => s.id !== payload.old.id));
      }
    }
  )
  .subscribe();
```

---

## 7. React useEffect Pattern (Direct Replacement)

```javascript
useEffect(() => {
  if (!gameId) return;

  const channel = supabase
    .channel(`game-${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        setLocalGame(payload.new);
      }
    )
    .subscribe();

  // Cleanup: remove channel when component unmounts or gameId changes
  return () => {
    supabase.removeChannel(channel);
  };
}, [gameId]);  // re-subscribe if gameId changes
```

**Rules:**
1. Always return `() => supabase.removeChannel(channel)` from the effect
2. Include the entity ID (e.g. `gameId`) in the dependency array — this re-creates the subscription if it changes
3. Use a unique channel name that includes the ID to avoid collisions between component instances

---

## 8. Subscription Status Handling

The `.subscribe()` call accepts a callback for connection status:

```javascript
const channel = supabase
  .channel(`game-${gameId}`)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
    (payload) => setLocalGame(payload.new)
  )
  .subscribe((status, error) => {
    if (status === 'SUBSCRIBED') {
      console.log('Realtime connected');
    }
    if (status === 'CHANNEL_ERROR') {
      console.error('Realtime error:', error);
    }
    if (status === 'TIMED_OUT') {
      console.warn('Realtime timed out');
    }
    if (status === 'CLOSED') {
      console.log('Realtime channel closed');
    }
  });
```

---

## 9. Using with TanStack Query

The recommended pattern: use TanStack Query for the initial data fetch, and Supabase Realtime to invalidate/update the cache on changes.

### Pattern A — Invalidate query on change (simplest)

```javascript
function useGame(gameId) {
  const queryClient = useQueryClient();

  // Initial fetch
  const query = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription — invalidate cache on any update
  useEffect(() => {
    if (!gameId) return;
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['game', gameId] });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [gameId, queryClient]);

  return query;
}
```

### Pattern B — Update query cache directly with payload (no extra fetch)

```javascript
function useGame(gameId) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription — patch cache directly from payload
  useEffect(() => {
    if (!gameId) return;
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          queryClient.setQueryData(['game', gameId], payload.new);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [gameId, queryClient]);

  return query;
}
```

Pattern B is lower latency (no round-trip refetch) but the payload only contains columns that were changed **if `REPLICA IDENTITY FULL` is not set** — use `setQueryData` only when you're confident the full row is in `payload.new`, or use `invalidateQueries` for safety.

---

## 10. ScoreHeader.jsx — Direct Replacement

```javascript
// BEFORE (Base44)
useEffect(() => {
  if (!game?.id) return;
  const unsubscribe = base44.entities.Game.subscribe((event) => {
    if (event.id === game.id) {
      setLocalGame(event.data);
    }
  });
  return () => unsubscribe();
}, [game?.id]);

// AFTER (Supabase)
useEffect(() => {
  if (!game?.id) return;
  const channel = supabase
    .channel(`score-header-game-${game.id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${game.id}`,
      },
      (payload) => {
        setLocalGame(payload.new);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [game?.id]);
```

---

## 11. Free Tier Limits (Supabase Realtime)

| Limit | Free Tier | Pro Tier |
|---|---|---|
| Concurrent connections | 200 | 500+ (configurable) |
| Messages per second (inbound) | 100 msg/s | higher |
| Channel joins per second | 100/s | higher |
| Max message payload size | 250 KB | 3 MB |
| Max channels per client | no hard limit | no hard limit |

**Practical implications for Courtside:**
- A live game page subscribing to `games` + `player_stats` = 2 channels per device
- With 200 concurrent connections, the free tier supports ~100 simultaneous devices across all active games
- Player stat events during a game (one per button tap) are low frequency — well within 100 msg/s
- ScoreHeader + LiveStatTracker together open ~3–4 channels per active game session

**To check current usage:** Supabase Dashboard → Settings → Usage

---

## 12. Quick Reference

```javascript
// Subscribe
const channel = supabase
  .channel('unique-channel-name')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'table_name' }, handler)
  .subscribe();

// Unsubscribe
supabase.removeChannel(channel);

// Remove all channels (e.g. on app teardown)
supabase.removeAllChannels();

// Check channel status
channel.state  // 'joined' | 'joining' | 'leaving' | 'closed' | 'errored'
```

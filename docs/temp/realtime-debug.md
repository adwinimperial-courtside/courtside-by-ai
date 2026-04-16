# Realtime subscription debug — LiveStatTracker.jsx

## Current subscription code (lines 199–243)

```js
useEffect(() => {
  if (!gameId) return;

  const statsChannel = supabase
    .channel(`live-stats-${gameId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'player_stats', filter: `game_id=eq.${gameId}` },
      () => {
        queryClient.invalidateQueries({ queryKey: ['player_stats', gameId] });
      }
    )
    .subscribe();

  const logsChannel = supabase
    .channel(`live-logs-${gameId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'game_logs', filter: `game_id=eq.${gameId}` },
      () => {
        queryClient.invalidateQueries({ queryKey: ['game_logs', gameId] });
      }
    )
    .subscribe();

  const gameChannel = supabase
    .channel(`live-game-${gameId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
      (payload) => {
        if (payload.new) {
          queryClient.setQueryData(['game', gameId], payload.new);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(statsChannel);
    supabase.removeChannel(logsChannel);
    supabase.removeChannel(gameChannel);
  };
}, [gameId, queryClient]);
```

---

## Root cause: React StrictMode async-removal race

In React StrictMode (development), every useEffect fires twice:
  mount → cleanup → mount (immediately)

The cleanup calls `supabase.removeChannel(channel)`, which is **async** — it sends an
unsubscribe over WebSocket and removes the channel from Supabase's internal registry
only when the Promise resolves. The second mount fires before that Promise resolves.

So on the second mount, `supabase.channel('live-stats-gameId')` finds the same
channel object still in the registry, in LEAVING state. It returns the existing object.

Calling `.on()` on a channel in LEAVING state fails silently — the Postgres changes
listener is never registered. The channel then reports as SUBSCRIBED but has no
callback. The WebSocket receives events, but nothing calls invalidateQueries.

Result: Tab 1 is "subscribed" but deaf. Tab 2's writes never update Tab 1's UI.

This is NOT a production bug — StrictMode only runs in development. But since all
testing is in development, it blocks verification of multi-device sync entirely.

---

## Checks against the four listed causes

a. Dependency array — `[gameId, queryClient]` is correct. queryClient is stable.
   Not the cause.

b. channelRef guard — no channelRef guard is present in this component. So the
   double-mount runs both times without being blocked. Combined with the async-removal
   race, this causes the broken second subscription. THIS IS THE CAUSE.

c. Subscription handler — invalidateQueries is the correct pattern. If the handler
   fires, the query would update. The handler is never registered — see (b).

d. Table/filter — correct. player_stats filtered by game_id=eq.${gameId}. ✓
   Replica identity FULL is set (migration 006). ✓

---

## Fix: generate unique channel name inside the effect

By generating a fresh random `id` inside the effect body (not in a ref), every
invocation gets a unique channel name. Even if the old channels are still being
asynchronously removed, the new channels have different names and are created fresh.

Also: add explicit `channel.unsubscribe()` before `removeChannel()` in cleanup
so the WebSocket signal is sent synchronously before async registry removal.

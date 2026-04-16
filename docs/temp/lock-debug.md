# EmergencyLineupRepair — lock-related code (pre-fix snapshot)

## Identity + lock refs (lines 19–20)

```js
const currentUserEmailRef = useRef(null);
const holdsLockRef = useRef(false);
```

❌ No stable per-tab identity ref at component level.
   Identity is generated inside init() (async), AFTER await supabase.auth.getUser().

---

## Lock helpers (lines 33–46)

```js
const claimLock = async (userEmail) => {
  await supabase.from('games').update({
    lineup_repair_locked_by: userEmail,
    lineup_repair_locked_at: new Date().toISOString(),
  }).eq('id', gameId);
  holdsLockRef.current = true;
};

const releaseLock = () => {
  holdsLockRef.current = false;
  return supabase.from('games')
    .update({ lineup_repair_locked_by: null, lineup_repair_locked_at: null })
    .eq('id', gameId);
};
```

---

## Realtime handler (lines 56–86)

```js
const channel = supabase
  .channel(`repair-lock-${gameId}-${uid}`)
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
    (payload) => {
      if (!isMounted) return;
      const newLockedBy = payload.new?.lineup_repair_locked_by;
      const newLockedAt = payload.new?.lineup_repair_locked_at
        ? new Date(payload.new.lineup_repair_locked_at)
        : null;
      const isFresh = newLockedAt && (Date.now() - newLockedAt.getTime() <= LOCK_TIMEOUT_MS);

      if (newLockedBy && isFresh && newLockedBy !== currentUserEmailRef.current) {
        if (!holdsLockRef.current) {
          setLockedByEmail(newLockedBy);
          setLockStatus('locked');
        }
      } else if (!newLockedBy || !isFresh) {
        if (!holdsLockRef.current && currentUserEmailRef.current) {
          claimLock(currentUserEmailRef.current).then(() => {   // ❌ no verify after claim
            if (isMounted) {
              setLockedByEmail(null);
              setLockStatus('mine');
            }
          });
        }
      }
    }
  )
  .subscribe();
```

❌ No console.log — cannot verify events are arriving.
❌ Lock-release path calls claimLock() with no verify step (same race as init).

---

## init() (lines 89–141)

```js
const init = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  // ❌ Identity generated here — AFTER an await, inside async init()
  // In StrictMode: first invocation sets ref to 'admin-abc', second to 'admin-xyz'.
  // The Realtime handler compares against currentUserEmailRef.current which may
  // differ from what was written to DB by a previous init() invocation.
  const userEmail = user?.email || `admin-${Math.random().toString(36).slice(2, 8)}`;
  currentUserEmailRef.current = userEmail;

  if (!isMounted) return;

  const { data: gameRow } = await supabase
    .from('games')
    .select('lineup_repair_locked_by, lineup_repair_locked_at')
    .eq('id', gameId)
    .single();

  if (!isMounted) return;

  const lockedBy = gameRow?.lineup_repair_locked_by;
  const lockedAt = gameRow?.lineup_repair_locked_at
    ? new Date(gameRow.lineup_repair_locked_at)
    : null;
  const isStale = !lockedAt || (Date.now() - lockedAt.getTime() > LOCK_TIMEOUT_MS);
  const isMine = lockedBy === userEmail;

  if (lockedBy && !isStale && !isMine) {
    setLockedByEmail(lockedBy);
    setLockStatus('locked');
  } else {
    await claimLock(userEmail);
    if (!isMounted) return;

    // ❌ No delay between write and re-read.
    // If both tabs write then immediately re-read, replication lag means each tab
    // still sees its own write — both report 'mine'.
    const { data: verify } = await supabase
      .from('games')
      .select('lineup_repair_locked_by')
      .eq('id', gameId)
      .single();

    if (!isMounted) return;

    if (verify?.lineup_repair_locked_by === userEmail) {
      setLockStatus('mine');
    } else {
      holdsLockRef.current = false;
      setLockedByEmail(verify?.lineup_repair_locked_by ?? null);
      setLockStatus('locked');
    }
  }
};
```

---

## Summary of failure points

| # | Issue | Effect |
|---|---|---|
| 1 | Identity generated inside async init() | May differ between claim-write and Realtime comparison; unstable in StrictMode |
| 2 | No 200ms wait between claim and re-read | Both tabs' re-reads see their own write before the other tab's propagates → both report 'mine' |
| 3 | Realtime lock-release path claims without verify | A waiting tab auto-claims but doesn't confirm it won |
| 4 | No console.log in Realtime handler | Cannot verify events are arriving |

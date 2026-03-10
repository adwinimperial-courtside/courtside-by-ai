import { useRef, useCallback } from 'react';

/**
 * Hook to debounce PlayerStats subscription refresh calls.
 * Prevents multiple rapid filter() API calls from subscription events.
 * 
 * @param {function} fetchFn - Async function to call (e.g., base44.entities.PlayerStats.filter)
 * @param {number} delay - Debounce delay in milliseconds
 * @returns {object} { trigger, cleanup } - trigger function and cleanup callback
 */
export function usePlayerStatsDebounce(fetchFn, delay) {
  const debounceRef = useRef(null);

  const trigger = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchFn();
    }, delay);
  }, [fetchFn, delay]);

  const cleanup = useCallback(() => {
    clearTimeout(debounceRef.current);
  }, []);

  return { trigger, cleanup };
}
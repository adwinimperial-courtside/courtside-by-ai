-- =============================================================================
-- Courtside by AI — Add lineup repair lock columns to games table
-- Migration: 20260416000010_lineup_repair_lock.sql
-- Date: 2026-04-16
-- =============================================================================
-- Prevents multiple admins from simultaneously handling an ejection repair.
-- The lock is soft (TTL 60s) and is cleared on repair confirmation or unmount.
-- =============================================================================

ALTER TABLE games
  ADD COLUMN lineup_repair_locked_by text NULL,
  ADD COLUMN lineup_repair_locked_at timestamp with time zone NULL;

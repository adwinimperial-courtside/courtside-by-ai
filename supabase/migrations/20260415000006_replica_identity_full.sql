-- =============================================================================
-- Courtside by AI — Enable REPLICA IDENTITY FULL for Realtime
-- Migration: 20260415000006_replica_identity_full.sql
-- Date: 2026-04-15
-- =============================================================================
-- Required so Supabase Realtime UPDATE and DELETE events include the complete
-- old row in payload.old (by default Postgres only sends the primary key).
-- Needed for: undo system in LiveStatTracker, clock state sync in ScoreHeader.
-- =============================================================================

-- Enable full replica identity for games table
-- Ensures UPDATE/DELETE events include complete old row data (clock state, scores, etc.)
alter table games replica identity full;

-- Enable full replica identity for player_stats table
-- Critical for undo functionality in LiveStatTracker (delete events must include full stat row)
alter table player_stats replica identity full;

-- NOTE: game_logs table does not exist yet in the schema.
-- Add replica identity for it in the migration that creates game_logs.

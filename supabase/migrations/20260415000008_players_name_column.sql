-- =============================================================================
-- Courtside by AI — Add generated name column to players table
-- Migration: 20260415000008_players_name_column.sql
-- Date: 2026-04-15
-- =============================================================================
-- Live game components (StartingLineup, LiveStatTracker, EmergencyLineupRepair)
-- reference player.name. This generated column concatenates first_name + last_name
-- automatically, keeping it in sync without any app-level transforms.
-- =============================================================================

-- Add generated name column for live game components
-- This concatenates first_name + last_name automatically
alter table players
  add column if not exists name text
  generated always as (first_name || ' ' || last_name) stored;

-- Create index for name lookups (used in player search/filtering)
create index if not exists idx_players_name on players(name);

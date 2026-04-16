-- =============================================================================
-- Courtside by AI — Add head_coach, manager, and is_captain
-- Migration: 20260415000003_team_and_player_fields.sql
-- Date: 2026-04-15
-- =============================================================================

-- Add head coach and manager to teams
alter table teams
  add column if not exists head_coach text,
  add column if not exists manager text;

-- Add captain flag to players
-- Only one player per team should have is_captain = true
-- Enforced at the application layer (not a DB constraint, to keep it flexible)
alter table players
  add column if not exists is_captain boolean not null default false;

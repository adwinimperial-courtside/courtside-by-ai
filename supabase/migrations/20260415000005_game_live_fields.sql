-- =============================================================================
-- Courtside by AI — Add live game state columns to games table
-- Migration: 20260415000005_game_live_fields.sql
-- Date: 2026-04-15
-- =============================================================================

alter table games
  -- Game clock state (for timed games)
  add column if not exists clock_running     boolean not null default false,
  add column if not exists clock_started_at  timestamptz,
  add column if not exists clock_time_left   numeric,  -- seconds remaining, stored when clock stops
  add column if not exists clock_period      integer not null default 1,

  -- Period state
  add column if not exists period_status     text
    check (period_status in ('active', 'completed')),

  -- Possession tracking
  add column if not exists possession        text
    check (possession in ('home', 'away')),

  -- Team fouls per period (JSONB map: period key → foul count)
  add column if not exists home_team_fouls   jsonb not null default '{}'::jsonb,
  add column if not exists away_team_fouls   jsonb not null default '{}'::jsonb,

  -- Timeouts per segment (JSONB map: segment key → timeouts used)
  add column if not exists home_timeouts     jsonb not null default '{}'::jsonb,
  add column if not exists away_timeouts     jsonb not null default '{}'::jsonb,

  -- Game rules (FIBA foul thresholds and other configurable rules per game)
  add column if not exists game_rules        jsonb,

  -- Entry metadata (for Player of Game calculation)
  add column if not exists entry_type        text not null default 'digital'
    check (entry_type in ('digital', 'manual', 'import')),
  add column if not exists edited            boolean not null default false;

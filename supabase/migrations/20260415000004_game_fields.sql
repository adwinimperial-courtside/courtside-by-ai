-- =============================================================================
-- Courtside by AI — Add missing game fields
-- Migration: 20260415000004_game_fields.sql
-- Date: 2026-04-15
-- =============================================================================

alter table games
  -- Game stage (regular season, playoffs etc.)
  add column if not exists game_stage text not null default 'regular'
    check (game_stage in ('regular', 'quarterfinal', 'semifinal', 'championship')),

  -- Awards exclusion
  add column if not exists exclude_from_awards boolean not null default false,

  -- Default result (forfeit/no-show)
  add column if not exists is_default_result boolean not null default false,
  add column if not exists default_winner_team_id uuid references teams(id) on delete set null,
  add column if not exists default_loser_team_id uuid references teams(id) on delete set null,
  add column if not exists default_reason text,

  -- Game format
  add column if not exists game_mode text not null default 'timed'
    check (game_mode in ('timed', 'untimed')),
  add column if not exists period_type text
    check (period_type in ('quarters', 'halves')),
  add column if not exists period_count integer,
  add column if not exists period_minutes integer,
  add column if not exists overtime_minutes integer,

  -- Player of the game
  add column if not exists player_of_game uuid references players(id) on delete set null;

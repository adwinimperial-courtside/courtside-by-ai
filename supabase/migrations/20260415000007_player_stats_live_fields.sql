-- =============================================================================
-- Courtside by AI — Add live game tracking fields to player_stats
-- Migration: 20260415000007_player_stats_live_fields.sql
-- Date: 2026-04-15
-- =============================================================================

-- Add live game tracking fields to player_stats
alter table player_stats
  add column if not exists is_starter            boolean not null default false,
  add column if not exists points_2              integer not null default 0,
  add column if not exists points_3              integer not null default 0,
  add column if not exists free_throws           integer not null default 0,
  add column if not exists free_throws_missed    integer not null default 0,
  add column if not exists technical_fouls       integer not null default 0,
  add column if not exists unsportsmanlike_fouls integer not null default 0;

-- Comment explaining the column naming
comment on column player_stats.points_2 is 'Two-point field goals made (Base44 naming for live stat entry)';
comment on column player_stats.points_3 is 'Three-point field goals made (Base44 naming for live stat entry)';
comment on column player_stats.free_throws is 'Free throws made (Base44 naming for live stat entry)';

-- NOTE: field_goals_made, three_pointers_made, free_throws_made columns remain for now
-- These can be deprecated/removed in a future migration after full Base44 cutover

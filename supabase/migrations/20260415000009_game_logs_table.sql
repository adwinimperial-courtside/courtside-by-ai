-- =============================================================================
-- Courtside by AI — Create game_logs table
-- Migration: 20260415000009_game_logs_table.sql
-- Date: 2026-04-15
-- =============================================================================

-- Create game_logs table for permanent activity tracking and undo support
create table game_logs (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references games(id) on delete cascade,
  league_id        uuid not null references leagues(id) on delete cascade,
  player_id        uuid references players(id) on delete set null,
  team_id          uuid references teams(id) on delete set null,
  player_stat_id   uuid references player_stats(id) on delete set null,

  -- Event type and display
  stat_type        text not null,         -- '2PT','3PT','FTM','FTX','OREB','DREB','AST','STL','BLK',
                                          -- 'TO','FOUL','TECHNICAL','UNSPORTSMANLIKE','EJECTION',
                                          -- 'SUBSTITUTION','TIMEOUT','PERIOD_END'
  stat_label       text,                  -- human-readable label / JSON for substitutions
  stat_points      integer not null default 0,
  stat_color       text,                  -- Tailwind class for activity feed UI

  -- Undo support
  old_value        integer,               -- stat value before this action
  new_value        integer,               -- stat value after this action
  old_home_score   integer,
  old_away_score   integer,
  undone           boolean not null default false,

  -- Game context at time of action
  clock_time       numeric,               -- seconds remaining on clock when action occurred
  period           integer,               -- which quarter/half

  -- Multi-device audit
  logged_by        text,                  -- email of admin who entered it
  device_name      text,                  -- device identifier

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Index for fetching game activity feed (ordered by time)
create index idx_game_logs_game_id_created on game_logs(game_id, created_at desc);

-- Index for undo queries
create index idx_game_logs_undone on game_logs(game_id, undone) where undone = false;

-- Enable RLS
alter table game_logs enable row level security;

-- RLS policies: match pattern used by games/player_stats tables
create policy "game_logs: members can read"
  on game_logs for select
  using (
    get_my_league_role(league_id) is not null
  );

create policy "game_logs: league_admin and coach can insert"
  on game_logs for insert
  with check (
    get_my_league_role(league_id) in ('league_admin', 'coach')
  );

create policy "game_logs: league_admin and coach can update"
  on game_logs for update
  using (
    get_my_league_role(league_id) in ('league_admin', 'coach')
  );

create policy "game_logs: app_admin full access"
  on game_logs for all
  using (is_app_admin());

-- Also enable replica identity for Realtime undo support
alter table game_logs replica identity full;

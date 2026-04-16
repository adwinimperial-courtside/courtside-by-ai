-- =============================================================================
-- Courtside by AI — Initial Schema
-- Migration: 20260415000000_initial_schema.sql
-- Date: 2026-04-15
-- Decisions: ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-007, ADR-009
-- =============================================================================

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

create extension if not exists "uuid-ossp" with schema extensions;


-- =============================================================================
-- HELPER FUNCTION: get current user's league role
-- Used in RLS policies throughout (ADR-002)
-- =============================================================================

create or replace function get_my_league_role(p_league_id uuid)
returns text
language plpgsql
security definer
stable
as $$
declare
  v_role text;
begin
  select role into v_role
  from user_league_memberships
  where user_id = auth.uid()
    and league_id = p_league_id
    and is_active = true
  limit 1;
  return v_role;
end;
$$;


-- =============================================================================
-- HELPER FUNCTION: check if current user is app_admin
-- Reads from Supabase Auth user metadata (ADR-003)
-- =============================================================================

create or replace function is_app_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'app_admin')::boolean,
    false
  );
$$;


-- =============================================================================
-- TABLE: profiles
-- Extended user profile beyond what Supabase Auth stores (ADR-007)
-- Created automatically when a user signs up via trigger
-- =============================================================================

create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  avatar_url        text,
  timezone          text not null default 'UTC',
  preferred_locale  text not null default 'en',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Profile is created automatically on signup (see trigger below)
-- RLS is disabled — access controlled at the application layer


-- =============================================================================
-- TABLE: leagues
-- Each league is a tenant (ADR-001)
-- =============================================================================

create table leagues (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text unique not null,
  country           text,
  timezone          text not null default 'UTC',
  sport             text not null default 'basketball',
  logo_url          text,
  is_active         boolean not null default true,
  is_sample         boolean not null default false,  -- sample leagues provisioned on signup (ADR-004)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table leagues enable row level security;

-- Members of a league can read it
create policy "leagues: members can read"
  on leagues for select
  using (
    get_my_league_role(id) is not null
  );

-- League admins can update their league
create policy "leagues: league_admin can update"
  on leagues for update
  using (
    get_my_league_role(id) = 'league_admin'
  );

-- App admin has full access
create policy "leagues: app_admin full access"
  on leagues for all
  using (is_app_admin());

-- Insert is handled server-side only (Edge Function / service role)


-- =============================================================================
-- TABLE: user_league_memberships
-- Per-league role assignments — replaces global user_type (ADR-001)
-- =============================================================================

create table user_league_memberships (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  league_id       uuid not null references leagues(id) on delete cascade,
  role            text not null check (role in ('league_admin', 'coach', 'player', 'viewer')),
  is_active       boolean not null default true,
  is_billing_admin boolean not null default false,  -- designated billing contact per league (ADR-005)
  invited_by      uuid references auth.users(id),
  joined_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, league_id)
);

alter table user_league_memberships enable row level security;

-- Users can read their own memberships
create policy "memberships: user can read own"
  on user_league_memberships for select
  using (user_id = auth.uid());

-- League admins can read all memberships in their league
create policy "memberships: league_admin can read league"
  on user_league_memberships for select
  using (
    get_my_league_role(league_id) = 'league_admin'
  );

-- League admins can insert memberships into their league
create policy "memberships: league_admin can insert"
  on user_league_memberships for insert
  with check (
    get_my_league_role(league_id) = 'league_admin'
  );

-- League admins can update memberships in their league
create policy "memberships: league_admin can update"
  on user_league_memberships for update
  using (
    get_my_league_role(league_id) = 'league_admin'
  );

-- App admin has full access
create policy "memberships: app_admin full access"
  on user_league_memberships for all
  using (is_app_admin());


-- =============================================================================
-- TABLE: teams
-- =============================================================================

create table teams (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references leagues(id) on delete cascade,
  name        text not null,
  short_name  text,
  logo_url    text,
  color       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table teams enable row level security;

-- League members can read teams in their league
create policy "teams: members can read"
  on teams for select
  using (
    get_my_league_role(league_id) is not null
  );

-- League admins and coaches can insert/update teams
create policy "teams: league_admin and coach can write"
  on teams for insert
  with check (
    get_my_league_role(league_id) in ('league_admin', 'coach')
  );

create policy "teams: league_admin and coach can update"
  on teams for update
  using (
    get_my_league_role(league_id) in ('league_admin', 'coach')
  );

-- App admin has full access
create policy "teams: app_admin full access"
  on teams for all
  using (is_app_admin());


-- =============================================================================
-- TABLE: players
-- =============================================================================

create table players (
  id            uuid primary key default gen_random_uuid(),
  league_id     uuid not null references leagues(id) on delete cascade,
  team_id       uuid references teams(id) on delete set null,
  user_id       uuid references auth.users(id) on delete set null,  -- null if not yet linked to an account
  first_name    text not null,
  last_name     text not null,
  jersey_number text,
  position      text,
  date_of_birth date,
  nationality   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table players enable row level security;

-- League members can read players in their league
create policy "players: members can read"
  on players for select
  using (
    get_my_league_role(league_id) is not null
  );

-- League admins and coaches can write players
create policy "players: league_admin and coach can insert"
  on players for insert
  with check (
    get_my_league_role(league_id) in ('league_admin', 'coach')
  );

create policy "players: league_admin and coach can update"
  on players for update
  using (
    get_my_league_role(league_id) in ('league_admin', 'coach')
  );

-- App admin has full access
create policy "players: app_admin full access"
  on players for all
  using (is_app_admin());


-- =============================================================================
-- TABLE: games
-- =============================================================================

create table games (
  id              uuid primary key default gen_random_uuid(),
  league_id       uuid not null references leagues(id) on delete cascade,
  home_team_id    uuid not null references teams(id),
  away_team_id    uuid not null references teams(id),
  scheduled_at    timestamptz not null,  -- always UTC (ADR-007)
  started_at      timestamptz,
  ended_at        timestamptz,
  status          text not null default 'scheduled'
                    check (status in ('scheduled', 'live', 'final', 'cancelled', 'postponed')),
  home_score      integer not null default 0,
  away_score      integer not null default 0,
  venue           text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (home_team_id != away_team_id)
);

alter table games enable row level security;

-- League members can read games in their league
create policy "games: members can read"
  on games for select
  using (
    get_my_league_role(league_id) is not null
  );

-- League admins and coaches can write games
create policy "games: league_admin and coach can insert"
  on games for insert
  with check (
    get_my_league_role(league_id) in ('league_admin', 'coach')
  );

create policy "games: league_admin and coach can update"
  on games for update
  using (
    get_my_league_role(league_id) in ('league_admin', 'coach')
  );

-- App admin has full access
create policy "games: app_admin full access"
  on games for all
  using (is_app_admin());


-- =============================================================================
-- TABLE: player_stats
-- Per-player per-game statistics
-- =============================================================================

create table player_stats (
  id              uuid primary key default gen_random_uuid(),
  league_id       uuid not null references leagues(id) on delete cascade,
  game_id         uuid not null references games(id) on delete cascade,
  player_id       uuid not null references players(id) on delete cascade,
  team_id         uuid not null references teams(id),
  -- scoring
  points          integer not null default 0,
  field_goals_made      integer not null default 0,
  field_goals_attempted integer not null default 0,
  three_pointers_made      integer not null default 0,
  three_pointers_attempted integer not null default 0,
  free_throws_made      integer not null default 0,
  free_throws_attempted integer not null default 0,
  -- rebounds
  offensive_rebounds  integer not null default 0,
  defensive_rebounds  integer not null default 0,
  -- other
  assists         integer not null default 0,
  steals          integer not null default 0,
  blocks          integer not null default 0,
  turnovers       integer not null default 0,
  fouls           integer not null default 0,
  minutes_played  numeric(5,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (game_id, player_id)
);

alter table player_stats enable row level security;

-- League members can read stats in their league
create policy "player_stats: members can read"
  on player_stats for select
  using (
    get_my_league_role(league_id) is not null
  );

-- League admins and coaches can write stats
create policy "player_stats: league_admin and coach can insert"
  on player_stats for insert
  with check (
    get_my_league_role(league_id) in ('league_admin', 'coach')
  );

create policy "player_stats: league_admin and coach can update"
  on player_stats for update
  using (
    get_my_league_role(league_id) in ('league_admin', 'coach')
  );

-- App admin has full access
create policy "player_stats: app_admin full access"
  on player_stats for all
  using (is_app_admin());


-- =============================================================================
-- TABLE: user_applications
-- New users applying to join a league — reviewed manually by Win (ADR-004)
-- =============================================================================

create table user_applications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  email           text not null,
  full_name       text not null,
  requested_role  text not null check (requested_role in ('league_admin', 'coach', 'player', 'viewer')),
  league_id       uuid references leagues(id) on delete set null,
  message         text,
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by     uuid references auth.users(id),
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table user_applications enable row level security;

-- Users can read their own applications
create policy "applications: user can read own"
  on user_applications for select
  using (user_id = auth.uid());

-- Users can submit an application (insert)
create policy "applications: user can insert"
  on user_applications for insert
  with check (user_id = auth.uid());

-- App admin can read and update all applications
create policy "applications: app_admin full access"
  on user_applications for all
  using (is_app_admin());


-- =============================================================================
-- TABLE: pending_user_assignments
-- Holds role assignments for users who haven't signed up yet (ADR-004)
-- Matched by email on first login
-- =============================================================================

create table pending_user_assignments (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  league_id   uuid not null references leagues(id) on delete cascade,
  role        text not null check (role in ('league_admin', 'coach', 'player', 'viewer')),
  invited_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (email, league_id)
);

alter table pending_user_assignments enable row level security;

-- App admin only — this table is managed server-side
create policy "pending_assignments: app_admin full access"
  on pending_user_assignments for all
  using (is_app_admin());


-- =============================================================================
-- TABLE: user_league_identity
-- Display name and number overrides per user per league (ADR-001)
-- e.g. a player may have a different jersey name vs their profile name
-- =============================================================================

create table user_league_identity (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  league_id     uuid not null references leagues(id) on delete cascade,
  display_name  text,
  jersey_number text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, league_id)
);

alter table user_league_identity enable row level security;

-- Users can read their own identity records
create policy "league_identity: user can read own"
  on user_league_identity for select
  using (user_id = auth.uid());

-- Users can update their own identity records
create policy "league_identity: user can update own"
  on user_league_identity for update
  using (user_id = auth.uid());

-- League admins can read all identities in their league
create policy "league_identity: league_admin can read"
  on user_league_identity for select
  using (
    get_my_league_role(league_id) = 'league_admin'
  );

-- App admin has full access
create policy "league_identity: app_admin full access"
  on user_league_identity for all
  using (is_app_admin());


-- =============================================================================
-- TABLE: league_subscriptions
-- Paddle subscription state per league (ADR-005)
-- Inactive until billing is activated
-- =============================================================================

create table league_subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  league_id             uuid not null references leagues(id) on delete cascade,
  paddle_subscription_id text unique,
  paddle_customer_id    text,
  plan                  text not null default 'free'
                          check (plan in ('free', 'active', 'past_due', 'cancelled')),
  seat_count            integer not null default 0,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  currency              text not null default 'EUR',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (league_id)
);

alter table league_subscriptions enable row level security;

-- League admins can read their own league's subscription
create policy "subscriptions: league_admin can read own"
  on league_subscriptions for select
  using (
    get_my_league_role(league_id) = 'league_admin'
  );

-- Billing admin can read (billing admin flag is on user_league_memberships)
-- Note: update/insert handled server-side via Paddle webhooks only

-- App admin has full access
create policy "subscriptions: app_admin full access"
  on league_subscriptions for all
  using (is_app_admin());


-- =============================================================================
-- TABLE: id_mapping
-- Base44 → Supabase ID mapping during migration (ADR-009)
-- Temporary — can be dropped after migration is validated
-- =============================================================================

create table id_mapping (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null,  -- e.g. 'league', 'team', 'player', 'game', 'user'
  base44_id       text not null,
  supabase_id     uuid not null,
  migrated_at     timestamptz not null default now(),
  unique (entity_type, base44_id)
);

alter table id_mapping enable row level security;

-- App admin only — migration tooling uses service role
create policy "id_mapping: app_admin full access"
  on id_mapping for all
  using (is_app_admin());


-- =============================================================================
-- TRIGGER: auto-create profile on user signup
-- Fires when a new user is inserted into auth.users
-- =============================================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- =============================================================================
-- TRIGGER: auto-match pending assignments on user signup
-- When a new user signs up, checks if there are pending role assignments
-- for their email and converts them to real memberships (ADR-004)
-- =============================================================================

create or replace function handle_pending_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_league_memberships (user_id, league_id, role, invited_by)
  select new.id, league_id, role, invited_by
  from public.pending_user_assignments
  where email = new.email;

  delete from public.pending_user_assignments
  where email = new.email;

  return new;
end;
$$;

create trigger on_auth_user_created_match_pending
  after insert on auth.users
  for each row execute function handle_pending_assignments();


-- =============================================================================
-- UPDATED_AT triggers
-- Auto-update the updated_at column on every row change
-- =============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_profiles
  before update on profiles
  for each row execute function set_updated_at();

create trigger set_updated_at_leagues
  before update on leagues
  for each row execute function set_updated_at();

create trigger set_updated_at_memberships
  before update on user_league_memberships
  for each row execute function set_updated_at();

create trigger set_updated_at_teams
  before update on teams
  for each row execute function set_updated_at();

create trigger set_updated_at_players
  before update on players
  for each row execute function set_updated_at();

create trigger set_updated_at_games
  before update on games
  for each row execute function set_updated_at();

create trigger set_updated_at_player_stats
  before update on player_stats
  for each row execute function set_updated_at();

create trigger set_updated_at_applications
  before update on user_applications
  for each row execute function set_updated_at();

create trigger set_updated_at_league_identity
  before update on user_league_identity
  for each row execute function set_updated_at();

create trigger set_updated_at_subscriptions
  before update on league_subscriptions
  for each row execute function set_updated_at();


-- =============================================================================
-- INDEXES
-- Performance indexes for common query patterns
-- =============================================================================

create index idx_memberships_user_id on user_league_memberships(user_id);
create index idx_memberships_league_id on user_league_memberships(league_id);
create index idx_teams_league_id on teams(league_id);
create index idx_players_league_id on players(league_id);
create index idx_players_team_id on players(team_id);
create index idx_games_league_id on games(league_id);
create index idx_games_scheduled_at on games(scheduled_at);
create index idx_games_status on games(status);
create index idx_player_stats_game_id on player_stats(game_id);
create index idx_player_stats_player_id on player_stats(player_id);
create index idx_player_stats_league_id on player_stats(league_id);
create index idx_applications_status on user_applications(status);
create index idx_pending_assignments_email on pending_user_assignments(email);

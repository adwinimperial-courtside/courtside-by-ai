-- Add default_league_id to profiles
alter table profiles
  add column if not exists default_league_id uuid references leagues(id) on delete set null;

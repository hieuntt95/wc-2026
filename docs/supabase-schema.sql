-- WC 2026 Supabase schema
-- Run this in Supabase SQL Editor.

create table if not exists teams (
  id int primary key,
  name text not null,
  short_name text not null,
  crest text not null,
  "group" text
);

create table if not exists matches (
  id int primary key,
  utc_date timestamptz not null,
  status text not null,
  stage text not null,
  "group" text,
  matchday int not null,
  home_team_id int references teams(id),
  away_team_id int references teams(id),
  home_score int,
  away_score int,
  home_goals jsonb not null default '[]'::jsonb,
  away_goals jsonb not null default '[]'::jsonb,
  venue text
);

alter table matches add column if not exists home_goals jsonb not null default '[]'::jsonb;
alter table matches add column if not exists away_goals jsonb not null default '[]'::jsonb;

create table if not exists sync_logs (
  id bigint generated always as identity primary key,
  source text not null,
  teams_count int not null,
  matches_count int not null,
  created_at timestamptz not null default now()
);

alter table teams enable row level security;
alter table matches enable row level security;
alter table sync_logs enable row level security;

drop policy if exists "Public teams are readable" on teams;
create policy "Public teams are readable"
on teams for select
using (true);

drop policy if exists "Public matches are readable" on matches;
create policy "Public matches are readable"
on matches for select
using (true);

drop policy if exists "Public sync logs are readable" on sync_logs;
create policy "Public sync logs are readable"
on sync_logs for select
using (true);

-- Demo-only write policies for /sync-data.
-- These allow anonymous browser clients to upsert tournament data.
-- For production, remove these and use a Supabase Edge Function with service role instead.

drop policy if exists "Anonymous can upsert teams for demo" on teams;
create policy "Anonymous can upsert teams for demo"
on teams for all
using (true)
with check (true);

drop policy if exists "Anonymous can upsert matches for demo" on matches;
create policy "Anonymous can upsert matches for demo"
on matches for all
using (true)
with check (true);

drop policy if exists "Anonymous can insert sync logs for demo" on sync_logs;
create policy "Anonymous can insert sync logs for demo"
on sync_logs for insert
with check (true);

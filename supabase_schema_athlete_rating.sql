-- ============================================================================
-- BRK Lift — Athlete Rating snapshot storage, run AFTER supabase_schema.sql
-- and supabase_schema_update.sql. Paste into the Supabase SQL Editor once.
--
-- One row per computed Athlete Rating snapshot (OVR, rank, category scores, muscle-group
-- scores) — the exact same object utils/athleteRating.js computes and stores locally in
-- state.athleteRatingSnapshots, synced as-is. Kept as a single jsonb `data` column rather than
-- normalized columns per category/muscle: the snapshot shape is derived data that may grow new
-- fields as the rating engine evolves, and nothing server-side ever needs to query into it —
-- it's only ever read back whole, same principle as workout_sessions.entries.
-- ============================================================================

create table if not exists public.athlete_rating_snapshots (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  computed_at timestamptz not null,
  ovr integer,
  rank_label text,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.athlete_rating_snapshots enable row level security;
create index if not exists athlete_rating_snapshots_user_computed_idx on public.athlete_rating_snapshots (user_id, computed_at desc);

create policy "athlete_rating_snapshots_select_own" on public.athlete_rating_snapshots
  for select using (auth.uid() = user_id);
create policy "athlete_rating_snapshots_insert_own" on public.athlete_rating_snapshots
  for insert with check (auth.uid() = user_id);
create policy "athlete_rating_snapshots_update_own" on public.athlete_rating_snapshots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "athlete_rating_snapshots_delete_own" on public.athlete_rating_snapshots
  for delete using (auth.uid() = user_id);

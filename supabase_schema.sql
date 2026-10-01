-- ============================================================================
-- BRK Lift — Supabase schema for workout data, with Row Level Security
-- Paste this whole file into the Supabase SQL Editor and run it once.
--
-- Every table is scoped to auth.uid() via a user_id column + RLS policies,
-- so each signed-in user can only ever see/write their own rows. Nothing
-- here touches auth.users itself — Supabase Auth (email magic link) owns
-- that table already.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. workout_profile — one row per user: the small "singleton" pieces of
--    app state (current program, weekly schedule, settings) that don't need
--    their own table. Mirrors currentProgram / weeklySchedule / scheduleLog /
--    settings / hasSeenOnboarding from the app's local state today.
-- ---------------------------------------------------------------------------
create table if not exists public.workout_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_program jsonb,
  weekly_schedule jsonb,
  schedule_log jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  has_seen_onboarding boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.workout_profile enable row level security;

create policy "workout_profile_select_own" on public.workout_profile
  for select using (auth.uid() = user_id);
create policy "workout_profile_insert_own" on public.workout_profile
  for insert with check (auth.uid() = user_id);
create policy "workout_profile_update_own" on public.workout_profile
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_profile_delete_own" on public.workout_profile
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. workout_sessions — finished guided-run summaries (Session Complete /
--    Workout History). One row per finished workout.
-- ---------------------------------------------------------------------------
create table if not exists public.workout_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_name text,
  source text,
  source_program_id text,
  source_program_name text,
  source_day_label text,
  started_at timestamptz,
  finished_at timestamptz not null,
  duration_sec integer,
  exercise_count integer,
  working_sets integer,
  total_reps integer,
  total_volume numeric,
  avg_rir numeric,
  is_volume_pr boolean default false,
  perf_delta_pct numeric,
  rating integer,
  main_muscles jsonb,
  best_lift jsonb,
  prs jsonb not null default '[]'::jsonb,
  entries jsonb not null default '[]'::jsonb,
  session_context jsonb,
  coach_message text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.workout_sessions enable row level security;
create index if not exists workout_sessions_user_finished_idx on public.workout_sessions (user_id, finished_at desc);

create policy "workout_sessions_select_own" on public.workout_sessions
  for select using (auth.uid() = user_id);
create policy "workout_sessions_insert_own" on public.workout_sessions
  for insert with check (auth.uid() = user_id);
create policy "workout_sessions_update_own" on public.workout_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_sessions_delete_own" on public.workout_sessions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. exercise_logs — per-exercise logged entries (state.logs today). Each
--    row is one exercise instance within a session: { exId, sets, ... }.
-- ---------------------------------------------------------------------------
create table if not exists public.exercise_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text references public.workout_sessions(id) on delete set null,
  ex_id text not null,
  date timestamptz not null,
  sets jsonb not null default '[]'::jsonb,
  target_reps integer,
  equipment_profile_id text,
  equipment_context text,
  joint_note jsonb,
  created_at timestamptz not null default now()
);

alter table public.exercise_logs enable row level security;
create index if not exists exercise_logs_user_exid_date_idx on public.exercise_logs (user_id, ex_id, date desc);

create policy "exercise_logs_select_own" on public.exercise_logs
  for select using (auth.uid() = user_id);
create policy "exercise_logs_insert_own" on public.exercise_logs
  for insert with check (auth.uid() = user_id);
create policy "exercise_logs_update_own" on public.exercise_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercise_logs_delete_own" on public.exercise_logs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. cardio_logs
-- ---------------------------------------------------------------------------
create table if not exists public.cardio_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ex_id text not null,
  date timestamptz not null,
  distance numeric,
  distance_unit text,
  duration numeric,
  load numeric,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.cardio_logs enable row level security;
create index if not exists cardio_logs_user_date_idx on public.cardio_logs (user_id, date desc);

create policy "cardio_logs_select_own" on public.cardio_logs
  for select using (auth.uid() = user_id);
create policy "cardio_logs_insert_own" on public.cardio_logs
  for insert with check (auth.uid() = user_id);
create policy "cardio_logs_update_own" on public.cardio_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cardio_logs_delete_own" on public.cardio_logs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. custom_programs
-- ---------------------------------------------------------------------------
create table if not exists public.custom_programs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  tagline text,
  days jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.custom_programs enable row level security;

create policy "custom_programs_select_own" on public.custom_programs
  for select using (auth.uid() = user_id);
create policy "custom_programs_insert_own" on public.custom_programs
  for insert with check (auth.uid() = user_id);
create policy "custom_programs_update_own" on public.custom_programs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "custom_programs_delete_own" on public.custom_programs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. custom_plans — one-off custom workout templates (BuildPlanTab).
-- ---------------------------------------------------------------------------
create table if not exists public.custom_plans (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exercises jsonb not null default '[]'::jsonb,
  is_custom boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.custom_plans enable row level security;

create policy "custom_plans_select_own" on public.custom_plans
  for select using (auth.uid() = user_id);
create policy "custom_plans_insert_own" on public.custom_plans
  for insert with check (auth.uid() = user_id);
create policy "custom_plans_update_own" on public.custom_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "custom_plans_delete_own" on public.custom_plans
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. custom_exercises — athlete-added catalog exercises.
-- ---------------------------------------------------------------------------
create table if not exists public.custom_exercises (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text,
  muscle text,
  secondary_muscles jsonb,
  equipment text,
  movement_category text,
  brand text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.custom_exercises enable row level security;

create policy "custom_exercises_select_own" on public.custom_exercises
  for select using (auth.uid() = user_id);
create policy "custom_exercises_insert_own" on public.custom_exercises
  for insert with check (auth.uid() = user_id);
create policy "custom_exercises_update_own" on public.custom_exercises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "custom_exercises_delete_own" on public.custom_exercises
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 8. equipment_profiles — "which physical machine" profiles per exercise.
-- ---------------------------------------------------------------------------
create table if not exists public.equipment_profiles (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  label text not null,
  gym_label text,
  brand text,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.equipment_profiles enable row level security;
create index if not exists equipment_profiles_user_exid_idx on public.equipment_profiles (user_id, exercise_id);

create policy "equipment_profiles_select_own" on public.equipment_profiles
  for select using (auth.uid() = user_id);
create policy "equipment_profiles_insert_own" on public.equipment_profiles
  for insert with check (auth.uid() = user_id);
create policy "equipment_profiles_update_own" on public.equipment_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "equipment_profiles_delete_own" on public.equipment_profiles
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 9. bodyweight_logs
-- ---------------------------------------------------------------------------
create table if not exists public.bodyweight_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz not null,
  weight numeric,
  waist numeric,
  body_fat numeric,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.bodyweight_logs enable row level security;
create index if not exists bodyweight_logs_user_date_idx on public.bodyweight_logs (user_id, date desc);

create policy "bodyweight_logs_select_own" on public.bodyweight_logs
  for select using (auth.uid() = user_id);
create policy "bodyweight_logs_insert_own" on public.bodyweight_logs
  for insert with check (auth.uid() = user_id);
create policy "bodyweight_logs_update_own" on public.bodyweight_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "bodyweight_logs_delete_own" on public.bodyweight_logs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 10. readiness_logs
-- ---------------------------------------------------------------------------
create table if not exists public.readiness_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz not null,
  sleep_quality integer,
  sleep_hours numeric,
  soreness integer,
  stress integer,
  motivation integer,
  energy integer,
  resting_hr integer,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.readiness_logs enable row level security;
create index if not exists readiness_logs_user_date_idx on public.readiness_logs (user_id, date desc);

create policy "readiness_logs_select_own" on public.readiness_logs
  for select using (auth.uid() = user_id);
create policy "readiness_logs_insert_own" on public.readiness_logs
  for insert with check (auth.uid() = user_id);
create policy "readiness_logs_update_own" on public.readiness_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "readiness_logs_delete_own" on public.readiness_logs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 11. goals
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text,
  start_value numeric,
  current_value numeric,
  target_value numeric,
  target_date date,
  units text,
  priority text,
  notes text,
  status text not null default 'active',
  linked_ex_id text,
  metric text,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);
create policy "goals_insert_own" on public.goals
  for insert with check (auth.uid() = user_id);
create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals_delete_own" on public.goals
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 12. photos — progress photos. dataUrl today; a real migration should move
--    these to Supabase Storage and keep only a storage path here, not a
--    base64 blob in a text column — flagged, not solved, in this pass.
-- ---------------------------------------------------------------------------
create table if not exists public.photos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz not null,
  context text,
  storage_path text,
  created_at timestamptz not null default now()
);

alter table public.photos enable row level security;

create policy "photos_select_own" on public.photos
  for select using (auth.uid() = user_id);
create policy "photos_insert_own" on public.photos
  for insert with check (auth.uid() = user_id);
create policy "photos_update_own" on public.photos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "photos_delete_own" on public.photos
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 13. completed_programs
-- ---------------------------------------------------------------------------
create table if not exists public.completed_programs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id text,
  program_source text,
  program_name text,
  weeks integer,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

alter table public.completed_programs enable row level security;

create policy "completed_programs_select_own" on public.completed_programs
  for select using (auth.uid() = user_id);
create policy "completed_programs_insert_own" on public.completed_programs
  for insert with check (auth.uid() = user_id);
create policy "completed_programs_update_own" on public.completed_programs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "completed_programs_delete_own" on public.completed_programs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 14. recovery_sessions — finished mobility/recovery sessions (kept separate
--    from workout_sessions so lifting analytics/PRs/volume are never mixed
--    with stretching, matching the app's existing principle).
-- ---------------------------------------------------------------------------
create table if not exists public.recovery_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id text,
  started_at timestamptz,
  finished_at timestamptz not null,
  duration_sec integer,
  movements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.recovery_sessions enable row level security;
create index if not exists recovery_sessions_user_finished_idx on public.recovery_sessions (user_id, finished_at desc);

create policy "recovery_sessions_select_own" on public.recovery_sessions
  for select using (auth.uid() = user_id);
create policy "recovery_sessions_insert_own" on public.recovery_sessions
  for insert with check (auth.uid() = user_id);
create policy "recovery_sessions_update_own" on public.recovery_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recovery_sessions_delete_own" on public.recovery_sessions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 15. recovery_logs — logged from an Active Recovery scheduled day.
-- ---------------------------------------------------------------------------
create table if not exists public.recovery_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz not null,
  activity text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.recovery_logs enable row level security;
create index if not exists recovery_logs_user_date_idx on public.recovery_logs (user_id, date desc);

create policy "recovery_logs_select_own" on public.recovery_logs
  for select using (auth.uid() = user_id);
create policy "recovery_logs_insert_own" on public.recovery_logs
  for insert with check (auth.uid() = user_id);
create policy "recovery_logs_update_own" on public.recovery_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recovery_logs_delete_own" on public.recovery_logs
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- End of schema. Nutrition and Coach-memory tables are intentionally left
-- out of this pass — not part of "workout data," and better designed once
-- this first migration is live and proven.
-- ============================================================================

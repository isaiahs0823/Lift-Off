-- Cloud sync v2 — revision tracking for the outbox's compare-and-swap writes.
--
-- STATUS: written and reviewed, NOT applied to any Supabase project (production or otherwise).
-- Do not run this against production without explicit approval, and only after the client side
-- (src/persistence/syncOutbox.js, src/utils/supabaseSync.js) has been exercised against a
-- disposable/isolated database first.
--
-- Purely additive: two new nullable-safe columns per synced table, each defaulting so every
-- existing row is valid the moment this runs. No column is dropped or renamed, no existing
-- constraint changes, RLS policies are untouched (every statement below stays inside the existing
-- per-row policies — nothing here needs SECURITY DEFINER or any RLS bypass).
--
-- revision            starts at 0 for existing rows; the outbox's compare-and-swap UPDATE bumps
--                      it by exactly 1 per successful write and fails the WHERE clause (0 rows
--                      affected) if another writer got there first.
-- last_operation_id   the outbox opId that produced the row's current revision. Lets a resent
--                      request be told apart from a genuine conflict: if a retry's own opId
--                      already matches this column, that retry already landed — it's a lost
--                      acknowledgement, not a collision with someone else's change.

alter table public.workout_profile      add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;
alter table public.workout_sessions     add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;
alter table public.exercise_logs        add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;
alter table public.cardio_logs          add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;
alter table public.custom_programs      add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;
alter table public.custom_plans         add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;
alter table public.custom_exercises     add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;
alter table public.equipment_profiles   add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;
alter table public.bodyweight_logs      add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;
alter table public.readiness_logs       add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;
alter table public.goals                add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;
alter table public.completed_programs   add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;
alter table public.recovery_sessions    add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;
alter table public.recovery_logs        add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;
alter table public.athlete_rating_snapshots add column if not exists revision bigint not null default 0, add column if not exists last_operation_id text;

-- photos and push_subscriptions are intentionally out of scope — supabaseSync.js's COLLECTIONS
-- list already excludes them from the existing sync mechanism, so v2 leaves them alone too.

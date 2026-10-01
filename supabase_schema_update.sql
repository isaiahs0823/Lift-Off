-- ============================================================================
-- BRK Lift — follow-up SQL, run AFTER supabase_schema.sql
-- Paste this into the Supabase SQL Editor and run it once.
--
-- Two things:
-- 1. recovery_sessions needs a few extra columns — the real app shape
--    (buildRecoverySessionSummary) carries routineName/planName/totalMovements/
--    movementsCompleted/completionPct/manual/sourceProgramId/sourceProgramName/
--    sourceDayLabel, which weren't in the original table. Additive only —
--    nothing is dropped or renamed.
-- 2. A private Storage bucket for progress photos, with RLS so only the
--    owner can read/write their own files.
-- ============================================================================

alter table public.recovery_sessions
  add column if not exists routine_name text,
  add column if not exists plan_name text,
  add column if not exists total_movements integer,
  add column if not exists movements_completed integer,
  add column if not exists completion_pct integer,
  add column if not exists manual boolean not null default false,
  add column if not exists source_program_id text,
  add column if not exists source_program_name text,
  add column if not exists source_day_label text;

-- ---------------------------------------------------------------------------
-- Private "progress-photos" bucket — public = false means nothing is
-- reachable by a plain URL; every read goes through a signed URL that only
-- the owner can generate, enforced by the policies below.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

-- Files are stored at path "<user_id>/<photo_id>.jpg" — storage.foldername(name)
-- splits that path so [1] is the leading <user_id> segment, which we check
-- against auth.uid(). This is the standard Supabase per-user-folder pattern.
create policy "progress_photos_select_own" on storage.objects
  for select using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress_photos_insert_own" on storage.objects
  for insert with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress_photos_update_own" on storage.objects
  for update using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress_photos_delete_own" on storage.objects
  for delete using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

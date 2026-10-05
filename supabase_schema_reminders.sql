-- ============================================================================
-- BRK Lift — Workout reminder preferences + Web Push scaffolding, run AFTER
-- supabase_schema.sql, supabase_schema_update.sql, and
-- supabase_schema_athlete_rating.sql. Paste into the Supabase SQL Editor once.
--
-- Two additions:
--   1. workout_profile.reminder_settings — one jsonb column, additive, mirrors
--      state.reminderSettings exactly (enabled/time/timeZone/lastFiredDateKey — see
--      src/utils/workoutReminders.js). Lets reminder prefs follow the athlete across devices
--      the same way weekly_schedule already does.
--   2. push_subscriptions — SCAFFOLDED, not yet wired to a live sender. Nothing client-side
--      writes to this table today (BRK has no deployed Edge Function or VAPID keys to subscribe
--      against — see sw.js's push handler comment). It's created now so the schema is ready the
--      moment that backend piece is deployed, rather than needing a second migration later.
--      Bringing it fully online still requires, outside this repo's reach from a coding session:
--        a. Generate a VAPID keypair (e.g. `npx web-push generate-vapid-keys`).
--        b. Set the public key as VITE_VAPID_PUBLIC_KEY (client) and the private key as a
--           Supabase Edge Function secret (server only — never shipped to the client bundle).
--        c. Deploy a Supabase Edge Function (Deno) that: reads due reminders by joining this
--           table against workout_profile.reminder_settings + each user's weekly_schedule
--           (same buildTodayReminderPlan logic, ported to the function), and calls the `web-push`
--           library with the stored subscription + VAPID keys for anyone due right now.
--        d. Schedule it with pg_cron + pg_net (Supabase's supported pattern) to invoke that
--           function every few minutes.
--      None of (a)-(d) can be done from an unattended coding session against a project with no
--      existing Edge Functions deployed — see the final report for this task.
-- ============================================================================

alter table public.workout_profile add column if not exists reminder_settings jsonb;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- No anon/public grants beyond RLS defaults — a user can only ever read or write their own
-- subscription rows. The (eventual) Edge Function reads this table with the service_role key,
-- which bypasses RLS by design and must never be exposed client-side (matches the existing rule
-- for every other privileged key in this project).

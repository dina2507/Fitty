-- ============================================================
-- PPL Tracker — Supabase Database Schema
-- Run this SQL in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. user_progress — tracks where the user is in the program
create table if not exists user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  current_phase_id text,
  current_week int,
  current_day_index int,
  program_start date,
  -- App-level preferences for units and timers
  weight_unit text,
  rest_timer_default int,
  dismissed_alerts text[],
  updated_at timestamptz default now()
);

alter table user_progress enable row level security;

create policy "Users can view own progress"
  on user_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on user_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on user_progress for update
  using (auth.uid() = user_id);

create policy "Users can delete own progress"
  on user_progress for delete
  using (auth.uid() = user_id);

-- 2. workout_logs — one row per completed workout session
create table if not exists workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  date date,
  phase_id text,
  week_number int,
  day_index int,
  day_label text,
  workout_type text,
  exercises jsonb,
  duration_minutes int,
  notes text,
  pr_exercises text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz default null
);

-- Safe migration for existing workout_logs tables created before
-- updated_at/deleted_at were introduced.
alter table workout_logs
  add column if not exists updated_at timestamptz default now();

alter table workout_logs
  add column if not exists deleted_at timestamptz default null;

update workout_logs
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

create index if not exists workout_logs_user_deleted_idx
  on workout_logs (user_id, deleted_at);

create index if not exists workout_logs_user_updated_idx
  on workout_logs (user_id, updated_at desc);

create or replace function set_workout_logs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists workout_logs_set_updated_at on workout_logs;

create trigger workout_logs_set_updated_at
before update on workout_logs
for each row
execute function set_workout_logs_updated_at();

alter table workout_logs enable row level security;

create policy "Users can view own logs"
  on workout_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own logs"
  on workout_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own logs"
  on workout_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete own logs"
  on workout_logs for delete
  using (auth.uid() = user_id);

-- 3. custom_exercises — user-created exercise library
create table if not exists custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  muscle_group text not null,
  secondary_muscles text[],
  equipment text,
  default_sets int,
  default_reps text,
  default_rpe text,
  default_rest text,
  notes text,
  created_at timestamptz default now()
);

alter table custom_exercises enable row level security;

create policy "Users can view own exercises"
  on custom_exercises for select
  using (auth.uid() = user_id);

create policy "Users can insert own exercises"
  on custom_exercises for insert
  with check (auth.uid() = user_id);

create policy "Users can update own exercises"
  on custom_exercises for update
  using (auth.uid() = user_id);

create policy "Users can delete own exercises"
  on custom_exercises for delete
  using (auth.uid() = user_id);

-- 4. custom_workouts — user-created or modified workout templates
create table if not exists custom_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  workout_type text,
  exercises jsonb,
  is_template boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table custom_workouts enable row level security;

create policy "Users can view own workouts"
  on custom_workouts for select
  using (auth.uid() = user_id);

create policy "Users can insert own workouts"
  on custom_workouts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own workouts"
  on custom_workouts for update
  using (auth.uid() = user_id);

create policy "Users can delete own workouts"
  on custom_workouts for delete
  using (auth.uid() = user_id);

-- 5. bodyweight_logs — tracks user bodyweight over time
create table if not exists bodyweight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  date date not null,
  weight numeric not null,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table bodyweight_logs enable row level security;

create policy "Users can view own bodyweight"
  on bodyweight_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own bodyweight"
  on bodyweight_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own bodyweight"
  on bodyweight_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete own bodyweight"
  on bodyweight_logs for delete
  using (auth.uid() = user_id);

-- 6. program_customizations — stores permanent exercise swaps
create table if not exists program_customizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  original_exercise_id text not null,
  custom_exercise_json jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, original_exercise_id)
);

alter table program_customizations enable row level security;

create policy "Users can view own customizations"
  on program_customizations for select
  using (auth.uid() = user_id);

create policy "Users can insert own customizations"
  on program_customizations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own customizations"
  on program_customizations for update
  using (auth.uid() = user_id);

create policy "Users can delete own customizations"
  on program_customizations for delete
  using (auth.uid() = user_id);

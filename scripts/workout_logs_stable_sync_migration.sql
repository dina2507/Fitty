-- ============================================================
-- Fitty workout_logs stable sync migration
-- Run this in Supabase SQL editor before/with app rollout.
-- ============================================================

alter table if exists workout_logs
  add column if not exists updated_at timestamptz default now();

alter table if exists workout_logs
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

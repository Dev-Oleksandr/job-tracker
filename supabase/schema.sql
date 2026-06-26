-- Job Tracker — Supabase schema (dark redesign data model)
-- Paste this whole file into Supabase → SQL Editor → Run.
-- NOTE: this DROPs and recreates the table. Safe now (no data yet); if you
-- already have rows you want to keep, back them up first.

drop table if exists public.applications cascade;

create table public.applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  company      text not null default '',
  role         text default '',
  status       text default 'applied',   -- applied | prescreen | testtask | interview | offer | rejected
  source       text default '',          -- djinni | dou | linkedin | telegram | other | ''
  source_other text default '',          -- custom label when source = 'other' (<=30 chars)
  salary       text default '',
  date_applied date,
  link         text default '',
  contact      text default '',
  notes        text default '',
  history      jsonb not null default '[]'::jsonb,  -- [{ "status": "...", "date": "YYYY-MM-DD" }, ...]
  updated_at   timestamptz default now(),
  created_at   timestamptz default now()
);

create index applications_user_date_idx
  on public.applications (user_id, date_applied desc);

alter table public.applications enable row level security;

create policy "own rows - select" on public.applications for select
  using (auth.uid() = user_id);
create policy "own rows - insert" on public.applications for insert
  with check (auth.uid() = user_id);
create policy "own rows - update" on public.applications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows - delete" on public.applications for delete
  using (auth.uid() = user_id);

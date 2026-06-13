-- Run this in the Supabase SQL Editor (Database > SQL Editor > New query)

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  bucket text not null default 'someday', -- 'today' | 'week' | 'nextweek' | 'someday'
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists pipeline (
  id uuid primary key default gen_random_uuid(),
  name text default '',
  follow_up_date date,
  next_action text default '',
  notes text default '',
  contact_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Since this is a single-user app with no login, we allow the anon key
-- full access. Do NOT reuse this pattern for multi-user apps.
alter table tasks enable row level security;
alter table pipeline enable row level security;

create policy "Allow all for anon" on tasks
  for all using (true) with check (true);

create policy "Allow all for anon" on pipeline
  for all using (true) with check (true);

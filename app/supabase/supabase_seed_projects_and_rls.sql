-- =========================================================
-- Supabase fix: seed projects + allow the app to read/write projects
-- Run this in Supabase Dashboard -> SQL Editor -> Run
-- =========================================================

-- 1) Ensure projects table has the columns the app uses
create table if not exists public.projects (
  id uuid primary key,
  name text not null,
  description text default '',
  manager text default '',
  is_active boolean default false,
  created_at timestamptz default now()
);

alter table public.projects add column if not exists description text default '';
alter table public.projects add column if not exists manager text default '';
alter table public.projects add column if not exists is_active boolean default false;
alter table public.projects add column if not exists created_at timestamptz default now();

-- 2) Insert default projects used by the system
insert into public.projects (id, name, description, manager, is_active, created_at)
values
  (
    '80600000-0000-0000-0000-000000000806',
    'כביש 806 צלמון שלב א׳',
    'פרויקט 806 - צלמון שלב א׳',
    'א.ש. רונן הנדסה אזרחית בע״מ',
    true,
    now()
  ),
  (
    '90900000-0000-0000-0000-000000000909',
    'שם הפרויקט כפי שמופיע במערכת',
    'פרויקט 909',
    '',
    false,
    now()
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  manager = excluded.manager;

-- 3) Keep only one active project
update public.projects
set is_active = false
where id <> '80600000-0000-0000-0000-000000000806';

update public.projects
set is_active = true
where id = '80600000-0000-0000-0000-000000000806';

-- 4) RLS policies for browser app using Supabase anon key
-- This project currently uses NEXT_PUBLIC_SUPABASE_ANON_KEY in the client,
-- so the anon role must be allowed to read/write the app tables.
alter table public.projects enable row level security;

drop policy if exists "app_read_projects" on public.projects;
drop policy if exists "app_insert_projects" on public.projects;
drop policy if exists "app_update_projects" on public.projects;
drop policy if exists "app_delete_projects" on public.projects;

create policy "app_read_projects"
on public.projects for select
to anon, authenticated
using (true);

create policy "app_insert_projects"
on public.projects for insert
to anon, authenticated
with check (true);

create policy "app_update_projects"
on public.projects for update
to anon, authenticated
using (true)
with check (true);

create policy "app_delete_projects"
on public.projects for delete
to anon, authenticated
using (true);

-- 5) Quick check: you should see the projects below after running
select id, name, manager, is_active, created_at
from public.projects
order by is_active desc, created_at desc;

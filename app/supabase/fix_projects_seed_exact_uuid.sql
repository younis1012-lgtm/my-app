-- =========================================================
-- FIX: ensure the exact project UUIDs used by the app exist
-- Run in Supabase Dashboard -> SQL Editor -> New query -> Run
-- =========================================================

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

-- These IDs must match app/page.tsx exactly.
insert into public.projects (id, name, description, manager, is_active, created_at)
values
  (
    '80600000-0000-0000-0000-000000000000',
    'כביש 806 צלמון שלב א׳',
    'פרויקט ברירת מחדל לפי הרשאת משתמש 806',
    'א.ש. רונן הנדסה אזרחית בע"מ',
    true,
    now()
  ),
  (
    '90900000-0000-0000-0000-000000000000',
    'פרויקט 909',
    'פרויקט ברירת מחדל לפי הרשאת משתמש 909',
    '',
    false,
    now()
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  manager = excluded.manager,
  is_active = excluded.is_active;

-- Keep the old seed IDs too, if they already exist, but make the current exact 806 project active.
update public.projects set is_active = false where id <> '80600000-0000-0000-0000-000000000000';
update public.projects set is_active = true where id = '80600000-0000-0000-0000-000000000000';

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

-- Allow preliminary_records write/read from the app as well.
alter table if exists public.preliminary_records enable row level security;

drop policy if exists "app_read_preliminary_records" on public.preliminary_records;
drop policy if exists "app_insert_preliminary_records" on public.preliminary_records;
drop policy if exists "app_update_preliminary_records" on public.preliminary_records;
drop policy if exists "app_delete_preliminary_records" on public.preliminary_records;

create policy "app_read_preliminary_records"
on public.preliminary_records for select
to anon, authenticated
using (true);

create policy "app_insert_preliminary_records"
on public.preliminary_records for insert
to anon, authenticated
with check (true);

create policy "app_update_preliminary_records"
on public.preliminary_records for update
to anon, authenticated
using (true)
with check (true);

create policy "app_delete_preliminary_records"
on public.preliminary_records for delete
to anon, authenticated
using (true);

select id, name, is_active
from public.projects
where id in (
  '80600000-0000-0000-0000-000000000000',
  '90900000-0000-0000-0000-000000000000'
)
order by is_active desc, name;

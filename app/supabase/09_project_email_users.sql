create table if not exists public.project_email_users (
  id text primary key,
  project_id text not null,
  name text not null default '',
  role text not null default '',
  company text not null default '',
  email text not null default '',
  phone text not null default '',
  smtp_app_password text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.project_email_users
  alter column id type text using id::text;

alter table public.project_email_users
  add column if not exists smtp_app_password text not null default '';

create index if not exists project_email_users_project_id_idx
  on public.project_email_users(project_id);

alter table public.project_email_users enable row level security;

drop policy if exists "project_email_users_app_read" on public.project_email_users;
drop policy if exists "project_email_users_app_write" on public.project_email_users;

create policy "project_email_users_app_read"
  on public.project_email_users for select
  using (true);

create policy "project_email_users_app_write"
  on public.project_email_users for all
  using (true)
  with check (true);

-- Requires 05_supabase_auth_rls.sql. Safe to rerun after 10_central_email.sql.
-- Preserve all rows and the authenticated, project-scoped mailbox policies.
begin;
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
drop policy if exists "project_email_users_authorized_read" on public.project_email_users;
drop policy if exists "project_email_users_admin_write" on public.project_email_users;
create policy "project_email_users_authorized_read" on public.project_email_users
  for select to authenticated using (
    exists (select 1 from public.project_members pm where pm.project_id::text = project_email_users.project_id
      and pm.user_id = auth.uid() and pm.active and pm.role in ('admin','readwrite'))
  );
create policy "project_email_users_admin_write" on public.project_email_users
  for all to authenticated using (
    exists (select 1 from public.project_members pm where pm.project_id::text = project_email_users.project_id
      and pm.user_id = auth.uid() and pm.active and pm.role = 'admin')
  ) with check (
    exists (select 1 from public.project_members pm where pm.project_id::text = project_email_users.project_id
      and pm.user_id = auth.uid() and pm.active and pm.role = 'admin')
  );

commit;

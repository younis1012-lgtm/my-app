-- Requires 05_supabase_auth_rls.sql. Run as database owner before enabling mail.
create table if not exists public.email_history (
  id uuid primary key,
  project_id uuid not null references public.projects(id),
  user_id uuid not null references auth.users(id),
  module text not null,
  record_id text not null,
  record_ids text[] not null,
  sender_email text not null,
  subject text not null,
  body text not null,
  to_addresses text[] not null,
  cc_addresses text[] not null default '{}',
  bcc_addresses text[] not null default '{}',
  attachment_names text[] not null default '{}',
  status text not null check (status in ('sending','sent','partial','failed','unknown')),
  message_id text,
  accepted text[] not null default '{}',
  rejected text[] not null default '{}',
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists email_history_record_idx on public.email_history(project_id,module,record_id,created_at desc);
create index if not exists email_history_records_idx on public.email_history using gin(record_ids);
alter table public.email_history enable row level security;
-- Mail metadata and BCC are exposed only through the authorized server endpoints.
revoke all on public.email_history from anon, authenticated;
grant all on public.email_history to service_role;

-- Remove the former anonymous access to project mailbox credentials.
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

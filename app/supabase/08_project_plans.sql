-- Project plans / drawing register.
-- Run after 05_supabase_auth_rls.sql.

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  plan_no text default '',
  revision text default '',
  title text default '',
  discipline text default '',
  date text default '',
  status text default '',
  notes text default '',
  attachments jsonb not null default '[]'::jsonb,
  saved_at timestamptz not null default now()
);

create index if not exists plans_project_id_idx
  on public.plans(project_id);

create index if not exists plans_saved_at_idx
  on public.plans(saved_at);

alter table public.plans enable row level security;

drop policy if exists "plans_read_by_member" on public.plans;
drop policy if exists "plans_write_by_member" on public.plans;
drop policy if exists "plans_update_by_member" on public.plans;
drop policy if exists "plans_delete_by_admin" on public.plans;

create policy "plans_read_by_member"
  on public.plans for select
  using (public.current_user_can_read(project_id));

create policy "plans_write_by_member"
  on public.plans for insert
  with check (public.current_user_can_write(project_id));

create policy "plans_update_by_member"
  on public.plans for update
  using (public.current_user_can_write(project_id))
  with check (public.current_user_can_write(project_id));

create policy "plans_delete_by_admin"
  on public.plans for delete
  using (public.current_user_project_role(project_id) = 'admin');

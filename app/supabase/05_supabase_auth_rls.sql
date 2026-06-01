-- Supabase Auth + strict RLS upgrade for Netivei Israel roles.
-- Run this after 04_netivei_compliance_foundation.sql.
--
-- Flow:
-- 1. Create users in Supabase Authentication.
-- 2. Insert a row in project_members for every user/project/role.
-- 3. Enable the strict policies below.
--
-- Roles:
-- admin      = Administrator
-- readwrite  = Read & Write
-- readonly   = Read Only

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  role public.netivei_access_role not null default 'readonly',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id)
);

create index if not exists project_members_user_idx
  on public.project_members(user_id);
create index if not exists project_members_project_idx
  on public.project_members(project_id);
create index if not exists project_members_role_idx
  on public.project_members(role);

alter table public.project_members enable row level security;

create or replace function public.current_user_project_role(target_project_id uuid)
returns public.netivei_access_role
language sql
stable
security definer
set search_path = public
as $$
  select pm.role
  from public.project_members pm
  where pm.user_id = auth.uid()
    and pm.project_id = target_project_id
    and pm.active = true
  order by
    case pm.role
      when 'admin' then 1
      when 'readwrite' then 2
      else 3
    end
  limit 1
$$;

create or replace function public.current_user_can_read(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.user_id = auth.uid()
      and pm.project_id = target_project_id
      and pm.active = true
      and pm.role in ('admin', 'readwrite', 'readonly')
  )
$$;

create or replace function public.current_user_can_write(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.user_id = auth.uid()
      and pm.project_id = target_project_id
      and pm.active = true
      and pm.role in ('admin', 'readwrite')
  )
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.user_id = auth.uid()
      and pm.active = true
      and pm.role = 'admin'
  )
$$;

drop policy if exists "project_members_read_own_or_admin" on public.project_members;
drop policy if exists "project_members_admin_write" on public.project_members;
create policy "project_members_read_own_or_admin"
  on public.project_members for select
  using (user_id = auth.uid() or public.current_user_is_admin());
create policy "project_members_admin_write"
  on public.project_members for all
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Replace permissive policies on the main project data tables with role-aware policies.
drop policy if exists "Allow all projects" on public.projects;
drop policy if exists "app_read_projects" on public.projects;
drop policy if exists "app_insert_projects" on public.projects;
drop policy if exists "app_update_projects" on public.projects;
drop policy if exists "app_delete_projects" on public.projects;
create policy "projects_read_by_member"
  on public.projects for select
  using (public.current_user_can_read(id));
create policy "projects_insert_by_admin"
  on public.projects for insert
  with check (public.current_user_is_admin());
create policy "projects_update_by_admin"
  on public.projects for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
create policy "projects_delete_by_admin"
  on public.projects for delete
  using (public.current_user_is_admin());

drop policy if exists "Allow all checklists" on public.checklists;
create policy "checklists_read_by_member"
  on public.checklists for select
  using (public.current_user_can_read(project_id));
create policy "checklists_write_by_member"
  on public.checklists for insert
  with check (public.current_user_can_write(project_id));
create policy "checklists_update_by_member"
  on public.checklists for update
  using (public.current_user_can_write(project_id))
  with check (public.current_user_can_write(project_id));
create policy "checklists_delete_by_admin"
  on public.checklists for delete
  using (public.current_user_project_role(project_id) = 'admin');

drop policy if exists "Allow all nonconformances" on public.nonconformances;
create policy "nonconformances_read_by_member"
  on public.nonconformances for select
  using (public.current_user_can_read(project_id));
create policy "nonconformances_write_by_member"
  on public.nonconformances for insert
  with check (public.current_user_can_write(project_id));
create policy "nonconformances_update_by_member"
  on public.nonconformances for update
  using (public.current_user_can_write(project_id))
  with check (public.current_user_can_write(project_id));
create policy "nonconformances_delete_by_admin"
  on public.nonconformances for delete
  using (public.current_user_project_role(project_id) = 'admin');

drop policy if exists "Allow all trial_sections" on public.trial_sections;
create policy "trial_sections_read_by_member"
  on public.trial_sections for select
  using (public.current_user_can_read(project_id));
create policy "trial_sections_write_by_member"
  on public.trial_sections for insert
  with check (public.current_user_can_write(project_id));
create policy "trial_sections_update_by_member"
  on public.trial_sections for update
  using (public.current_user_can_write(project_id))
  with check (public.current_user_can_write(project_id));
create policy "trial_sections_delete_by_admin"
  on public.trial_sections for delete
  using (public.current_user_project_role(project_id) = 'admin');

drop policy if exists "Allow all preliminary_records" on public.preliminary_records;
create policy "preliminary_records_read_by_member"
  on public.preliminary_records for select
  using (public.current_user_can_read(project_id));
create policy "preliminary_records_write_by_member"
  on public.preliminary_records for insert
  with check (public.current_user_can_write(project_id));
create policy "preliminary_records_update_by_member"
  on public.preliminary_records for update
  using (public.current_user_can_write(project_id))
  with check (public.current_user_can_write(project_id));
create policy "preliminary_records_delete_by_admin"
  on public.preliminary_records for delete
  using (public.current_user_project_role(project_id) = 'admin');

drop policy if exists "Allow all supervision_reports" on public.supervision_reports;
drop policy if exists "supervision_reports_select_all" on public.supervision_reports;
drop policy if exists "supervision_reports_insert_all" on public.supervision_reports;
drop policy if exists "supervision_reports_update_all" on public.supervision_reports;
drop policy if exists "supervision_reports_delete_all" on public.supervision_reports;
create policy "supervision_reports_read_by_member"
  on public.supervision_reports for select
  using (public.current_user_can_read(project_id));
create policy "supervision_reports_write_by_member"
  on public.supervision_reports for insert
  with check (public.current_user_can_write(project_id));
create policy "supervision_reports_update_by_member"
  on public.supervision_reports for update
  using (public.current_user_can_write(project_id))
  with check (public.current_user_can_write(project_id));
create policy "supervision_reports_delete_by_admin"
  on public.supervision_reports for delete
  using (public.current_user_project_role(project_id) = 'admin');

drop policy if exists "control_processes_select_all" on public.control_processes;
drop policy if exists "control_processes_insert_all" on public.control_processes;
drop policy if exists "control_processes_update_all" on public.control_processes;
drop policy if exists "control_processes_delete_all" on public.control_processes;
create policy "control_processes_read_by_member"
  on public.control_processes for select
  using (public.current_user_can_read(project_id));
create policy "control_processes_write_by_member"
  on public.control_processes for insert
  with check (public.current_user_can_write(project_id));
create policy "control_processes_update_by_member"
  on public.control_processes for update
  using (public.current_user_can_write(project_id))
  with check (public.current_user_can_write(project_id));
create policy "control_processes_delete_by_admin"
  on public.control_processes for delete
  using (public.current_user_project_role(project_id) = 'admin');

-- Document registry / audit / report schedules.
drop policy if exists "document_registry_app_read" on public.document_registry;
drop policy if exists "document_registry_app_write" on public.document_registry;
create policy "document_registry_read_by_member"
  on public.document_registry for select
  using (public.current_user_can_read(project_id));
create policy "document_registry_write_by_member"
  on public.document_registry for insert
  with check (public.current_user_can_write(project_id));
create policy "document_registry_update_by_member"
  on public.document_registry for update
  using (public.current_user_can_write(project_id))
  with check (public.current_user_can_write(project_id));
create policy "document_registry_delete_by_admin"
  on public.document_registry for delete
  using (public.current_user_project_role(project_id) = 'admin');

drop policy if exists "audit_logs_app_read" on public.audit_logs;
drop policy if exists "audit_logs_app_insert" on public.audit_logs;
create policy "audit_logs_read_by_member"
  on public.audit_logs for select
  using (project_id is null or public.current_user_can_read(project_id));
create policy "audit_logs_insert_by_writer"
  on public.audit_logs for insert
  with check (project_id is null or public.current_user_can_write(project_id));

drop policy if exists "report_schedules_app_read" on public.report_schedules;
drop policy if exists "report_schedules_app_write" on public.report_schedules;
create policy "report_schedules_read_by_member"
  on public.report_schedules for select
  using (public.current_user_can_read(project_id));
create policy "report_schedules_write_by_admin"
  on public.report_schedules for all
  using (public.current_user_project_role(project_id) = 'admin')
  with check (public.current_user_project_role(project_id) = 'admin');

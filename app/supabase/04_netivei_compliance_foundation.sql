-- Netivei Israel compliance foundation.
-- Run in Supabase SQL Editor after the existing schema scripts.
--
-- This script adds the data model required for:
-- 1. Administrator / Read & Write / Read Only permissions.
-- 2. Project structure tree.
-- 3. Central document registry.
-- 4. Audit log.
-- 5. Report schedule registry.
--
-- Important:
-- The current browser app still uses NEXT_PUBLIC_SUPABASE_ANON_KEY.
-- For strict production security, connect users through Supabase Auth and put
-- app_role + project_ids in auth.jwt() app_metadata before enabling strict RLS.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'netivei_access_role'
      and n.nspname = 'public'
  ) then
    create type public.netivei_access_role as enum (
      'admin',
      'readwrite',
      'readonly'
    );
  end if;
end $$;

create table if not exists public.project_access_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password text not null default '',
  display_name text not null default '',
  role public.netivei_access_role not null default 'readwrite',
  code text,
  project_name text,
  signature text default '',
  signature_file_name text default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (username)
);

alter table public.project_access_users
  add column if not exists active boolean not null default true,
  add column if not exists signature_file_name text default '';

alter table public.project_access_users
  alter column role type public.netivei_access_role
  using (
    case
      when role::text in ('admin', 'administrator') then 'admin'::public.netivei_access_role
      when role::text in ('readonly', 'read_only', 'read-only') then 'readonly'::public.netivei_access_role
      else 'readwrite'::public.netivei_access_role
    end
  );

create table if not exists public.project_structure_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.project_structure_nodes(id) on delete cascade,
  node_type text not null check (node_type in ('project', 'road', 'site', 'structure', 'section', 'element', 'activity')),
  name text not null,
  code text default '',
  from_chainage text default '',
  to_chainage text default '',
  side text default '',
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_structure_nodes_project_idx
  on public.project_structure_nodes(project_id);
create index if not exists project_structure_nodes_parent_idx
  on public.project_structure_nodes(parent_id);

create table if not exists public.document_registry (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  structure_node_id uuid references public.project_structure_nodes(id) on delete set null,
  related_table text default '',
  related_id uuid,
  document_type text not null default 'general',
  title text not null,
  file_name text not null,
  file_mime_type text default '',
  storage_bucket text not null default 'project-documents',
  storage_path text not null,
  version integer not null default 1,
  status text not null default 'active',
  uploaded_by text default '',
  uploaded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists document_registry_project_idx
  on public.document_registry(project_id);
create index if not exists document_registry_node_idx
  on public.document_registry(structure_node_id);
create index if not exists document_registry_related_idx
  on public.document_registry(related_table, related_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  actor_name text not null default '',
  actor_role public.netivei_access_role not null default 'readwrite',
  action text not null,
  entity_table text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists audit_logs_project_created_idx
  on public.audit_logs(project_id, created_at desc);
create index if not exists audit_logs_entity_idx
  on public.audit_logs(entity_table, entity_id);

create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  report_type text not null check (report_type in ('daily', 'weekly', 'monthly', 'on_demand')),
  title text not null,
  recipients jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_schedules_project_idx
  on public.report_schedules(project_id);

-- Link main QA records to the project tree.
alter table public.checklists
  add column if not exists structure_node_id uuid references public.project_structure_nodes(id) on delete set null;
alter table public.nonconformances
  add column if not exists structure_node_id uuid references public.project_structure_nodes(id) on delete set null;
alter table public.trial_sections
  add column if not exists structure_node_id uuid references public.project_structure_nodes(id) on delete set null;
alter table public.preliminary_records
  add column if not exists structure_node_id uuid references public.project_structure_nodes(id) on delete set null;

-- Supabase Storage bucket for central documents.
insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do nothing;

-- RLS is enabled here. Policies remain compatible with the current app by
-- permitting anon/authenticated access. Replace these with strict auth.jwt()
-- policies after Supabase Auth is connected.
alter table public.project_access_users enable row level security;
alter table public.project_structure_nodes enable row level security;
alter table public.document_registry enable row level security;
alter table public.audit_logs enable row level security;
alter table public.report_schedules enable row level security;

drop policy if exists "project_access_users_app_read" on public.project_access_users;
drop policy if exists "project_access_users_app_write" on public.project_access_users;
create policy "project_access_users_app_read"
  on public.project_access_users for select
  using (true);
create policy "project_access_users_app_write"
  on public.project_access_users for all
  using (true)
  with check (true);

drop policy if exists "project_structure_nodes_app_read" on public.project_structure_nodes;
drop policy if exists "project_structure_nodes_app_write" on public.project_structure_nodes;
create policy "project_structure_nodes_app_read"
  on public.project_structure_nodes for select
  using (true);
create policy "project_structure_nodes_app_write"
  on public.project_structure_nodes for all
  using (true)
  with check (true);

drop policy if exists "document_registry_app_read" on public.document_registry;
drop policy if exists "document_registry_app_write" on public.document_registry;
create policy "document_registry_app_read"
  on public.document_registry for select
  using (true);
create policy "document_registry_app_write"
  on public.document_registry for all
  using (true)
  with check (true);

drop policy if exists "audit_logs_app_read" on public.audit_logs;
drop policy if exists "audit_logs_app_insert" on public.audit_logs;
create policy "audit_logs_app_read"
  on public.audit_logs for select
  using (true);
create policy "audit_logs_app_insert"
  on public.audit_logs for insert
  with check (true);

drop policy if exists "report_schedules_app_read" on public.report_schedules;
drop policy if exists "report_schedules_app_write" on public.report_schedules;
create policy "report_schedules_app_read"
  on public.report_schedules for select
  using (true);
create policy "report_schedules_app_write"
  on public.report_schedules for all
  using (true)
  with check (true);

drop policy if exists "project_documents_app_read" on storage.objects;
drop policy if exists "project_documents_app_write" on storage.objects;
create policy "project_documents_app_read"
  on storage.objects for select
  using (bucket_id = 'project-documents');
create policy "project_documents_app_write"
  on storage.objects for all
  using (bucket_id = 'project-documents')
  with check (bucket_id = 'project-documents');

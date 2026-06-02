-- Project structure hierarchy and record links.
-- Run after 05_supabase_auth_rls.sql.

create table if not exists public.project_structure_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  parent_id uuid references public.project_structure_nodes(id) on delete restrict,
  node_type text not null check (node_type in ('road', 'site', 'structure', 'section', 'element', 'activity')),
  name text not null,
  code text,
  from_chainage text,
  to_chainage text,
  side text,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_structure_nodes_project_id_idx
  on public.project_structure_nodes(project_id);

create index if not exists project_structure_nodes_parent_id_idx
  on public.project_structure_nodes(parent_id);

alter table public.checklists
  add column if not exists structure_node_id uuid references public.project_structure_nodes(id) on delete set null;

alter table public.nonconformances
  add column if not exists structure_node_id uuid references public.project_structure_nodes(id) on delete set null;

alter table public.trial_sections
  add column if not exists structure_node_id uuid references public.project_structure_nodes(id) on delete set null;

alter table public.preliminary_records
  add column if not exists structure_node_id uuid references public.project_structure_nodes(id) on delete set null;

alter table public.rfi_records
  add column if not exists structure_node_id uuid references public.project_structure_nodes(id) on delete set null;

alter table public.control_processes
  add column if not exists structure_node_id uuid references public.project_structure_nodes(id) on delete set null;

alter table public.supervision_reports
  add column if not exists structure_node_id uuid references public.project_structure_nodes(id) on delete set null;

alter table public.document_registry
  add column if not exists structure_node_id uuid references public.project_structure_nodes(id) on delete set null;

create index if not exists checklists_structure_node_id_idx
  on public.checklists(structure_node_id);

create index if not exists nonconformances_structure_node_id_idx
  on public.nonconformances(structure_node_id);

create index if not exists trial_sections_structure_node_id_idx
  on public.trial_sections(structure_node_id);

create index if not exists preliminary_records_structure_node_id_idx
  on public.preliminary_records(structure_node_id);

create index if not exists rfi_records_structure_node_id_idx
  on public.rfi_records(structure_node_id);

create index if not exists control_processes_structure_node_id_idx
  on public.control_processes(structure_node_id);

create index if not exists supervision_reports_structure_node_id_idx
  on public.supervision_reports(structure_node_id);

create index if not exists document_registry_structure_node_id_idx
  on public.document_registry(structure_node_id);

alter table public.project_structure_nodes enable row level security;

drop policy if exists project_structure_nodes_read on public.project_structure_nodes;
create policy project_structure_nodes_read
  on public.project_structure_nodes
  for select
  using (public.current_user_can_read(project_id));

drop policy if exists project_structure_nodes_write on public.project_structure_nodes;
create policy project_structure_nodes_write
  on public.project_structure_nodes
  for all
  using (public.current_user_can_write(project_id))
  with check (public.current_user_can_write(project_id));

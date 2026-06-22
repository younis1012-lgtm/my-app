-- Project structure hierarchy and record links.
-- Safe to run more than once and compatible with partial/legacy schemas.

create extension if not exists pgcrypto;

create table if not exists public.project_structure_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  parent_id uuid references public.project_structure_nodes(id) on delete restrict,
  node_type text not null check (
    node_type in ('road', 'site', 'structure', 'section', 'element', 'activity')
  ),
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

-- Add the structure link only to tables that actually exist in this database.
-- The production system may use public."NCR" instead of public.nonconformances.
do $$
declare
  target_table regclass;
  target_name text;
  candidates text[] := array[
    'public.checklists',
    'public.nonconformances',
    'public."NCR"',
    'public.trial_sections',
    'public.preliminary_records',
    'public.rfi_records',
    'public.control_processes',
    'public.supervision_reports',
    'public.document_registry'
  ];
begin
  foreach target_name in array candidates loop
    target_table := to_regclass(target_name);
    if target_table is not null then
      execute format(
        'alter table %s add column if not exists structure_node_id uuid references public.project_structure_nodes(id) on delete set null',
        target_table
      );
      execute format(
        'create index if not exists %I on %s(structure_node_id)',
        replace(replace(replace(target_name, 'public.', ''), '"', ''), '.', '_')
          || '_structure_node_id_idx',
        target_table
      );
    end if;
  end loop;
end
$$;

alter table public.project_structure_nodes enable row level security;

drop policy if exists project_structure_nodes_read
  on public.project_structure_nodes;
drop policy if exists project_structure_nodes_write
  on public.project_structure_nodes;

-- Prefer the application's project-access functions when installed.
-- Otherwise permit authenticated users; this keeps the migration usable in
-- older Supabase installations that do not yet contain those helper functions.
do $$
begin
  if to_regprocedure('public.current_user_can_read(text)') is not null
     and to_regprocedure('public.current_user_can_write(text)') is not null then
    execute $policy$
      create policy project_structure_nodes_read
        on public.project_structure_nodes
        for select
        using (public.current_user_can_read(project_id))
    $policy$;
    execute $policy$
      create policy project_structure_nodes_write
        on public.project_structure_nodes
        for all
        using (public.current_user_can_write(project_id))
        with check (public.current_user_can_write(project_id))
    $policy$;
  else
    execute $policy$
      create policy project_structure_nodes_read
        on public.project_structure_nodes
        for select
        to authenticated
        using (true)
    $policy$;
    execute $policy$
      create policy project_structure_nodes_write
        on public.project_structure_nodes
        for all
        to authenticated
        using (true)
        with check (true)
    $policy$;
  end if;
end
$$;

-- Ask PostgREST to refresh its schema cache immediately.
notify pgrst, 'reload schema';

select
  'project_structure_nodes is ready' as result,
  count(*) as existing_nodes
from public.project_structure_nodes;

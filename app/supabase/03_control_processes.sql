-- Supabase table for Netivei Israel / Neti control processes
-- Run this in Supabase SQL Editor once.
create table if not exists public.control_processes (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  process_no text not null,
  title text not null,
  work_type text default '',
  spec_section text default '',
  location text default '',
  from_section text default '',
  to_section text default '',
  status text not null default 'טיוטה',
  checklist_ids jsonb not null default '[]'::jsonb,
  rfi_ids jsonb not null default '[]'::jsonb,
  nonconformance_ids jsonb not null default '[]'::jsonb,
  required_documents jsonb not null default '[]'::jsonb,
  audit_log jsonb not null default '[]'::jsonb,
  approval jsonb,
  locked_at timestamptz,
  saved_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists control_processes_project_id_idx on public.control_processes(project_id);
create index if not exists control_processes_status_idx on public.control_processes(status);
create index if not exists control_processes_saved_at_idx on public.control_processes(saved_at desc);

alter table public.control_processes enable row level security;

-- Simple permissive policy for projects that already use anon/service access.
-- If your Supabase project already has strict auth, replace this with your standard project policy.
drop policy if exists "control_processes_select_all" on public.control_processes;
drop policy if exists "control_processes_insert_all" on public.control_processes;
drop policy if exists "control_processes_update_all" on public.control_processes;
drop policy if exists "control_processes_delete_all" on public.control_processes;

create policy "control_processes_select_all" on public.control_processes for select using (true);
create policy "control_processes_insert_all" on public.control_processes for insert with check (true);
create policy "control_processes_update_all" on public.control_processes for update using (true) with check (true);
create policy "control_processes_delete_all" on public.control_processes for delete using (true);

-- Optional: add linkage columns to existing tables.
alter table public.checklists add column if not exists control_process_id uuid references public.control_processes(id) on delete set null;
alter table public.rfi_records add column if not exists control_process_id uuid references public.control_processes(id) on delete set null;
alter table public.nonconformances add column if not exists control_process_id uuid references public.control_processes(id) on delete set null;

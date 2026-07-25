create table if not exists public.hold_points (
  id uuid primary key,
  project_id text not null,
  serial_no integer not null,
  reference_no text not null default '',
  name text not null,
  structure_node_id uuid null,
  element text not null default '',
  status text not null default 'נוצרה, לא הושלמה',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hold_points_project_id_idx
  on public.hold_points (project_id);

create unique index if not exists hold_points_project_serial_idx
  on public.hold_points (project_id, serial_no);

alter table public.hold_points enable row level security;

drop policy if exists "hold_points_select_authenticated" on public.hold_points;
create policy "hold_points_select_authenticated"
  on public.hold_points for select
  to authenticated
  using (true);

drop policy if exists "hold_points_insert_authenticated" on public.hold_points;
create policy "hold_points_insert_authenticated"
  on public.hold_points for insert
  to authenticated
  with check (true);

drop policy if exists "hold_points_update_authenticated" on public.hold_points;
create policy "hold_points_update_authenticated"
  on public.hold_points for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "hold_points_delete_authenticated" on public.hold_points;
create policy "hold_points_delete_authenticated"
  on public.hold_points for delete
  to authenticated
  using (true);

create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  manager text default '',
  is_active boolean default false,
  created_at timestamptz default now()
);

create table if not exists checklists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  template_key text not null,
  title text not null,
  category text default '',
  location text default '',
  date text default '',
  contractor text default '',
  notes text default '',
  items jsonb default '[]'::jsonb,
  saved_at timestamptz default now()
);

create table if not exists nonconformances (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  location text default '',
  date text default '',
  raised_by text default '',
  severity text default 'בינונית',
  status text default 'פתוח',
  description text default '',
  action_required text default '',
  notes text default '',
  saved_at timestamptz default now()
);

create table if not exists trial_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  location text default '',
  date text default '',
  spec text default '',
  result text default '',
  approved_by text default '',
  status text default 'טיוטה',
  notes text default '',
  saved_at timestamptz default now()
);

create table if not exists preliminary_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  subtype text not null,
  title text not null,
  date text default '',
  status text default 'טיוטה',
  supplier jsonb,
  subcontractor jsonb,
  material jsonb,
  saved_at timestamptz default now()
);

alter table projects enable row level security;
alter table checklists enable row level security;
alter table nonconformances enable row level security;
alter table trial_sections enable row level security;
alter table preliminary_records enable row level security;

drop policy if exists "Allow all projects" on projects;
create policy "Allow all projects" on projects for all using (true) with check (true);
drop policy if exists "Allow all checklists" on checklists;
create policy "Allow all checklists" on checklists for all using (true) with check (true);
drop policy if exists "Allow all nonconformances" on nonconformances;
create policy "Allow all nonconformances" on nonconformances for all using (true) with check (true);
drop policy if exists "Allow all trial_sections" on trial_sections;
create policy "Allow all trial_sections" on trial_sections for all using (true) with check (true);
drop policy if exists "Allow all preliminary_records" on preliminary_records;
create policy "Allow all preliminary_records" on preliminary_records for all using (true) with check (true);

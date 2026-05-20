create table if not exists supervision_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text default '',
  report_no text default '',
  date text,
  location text default '',
  author text default '',
  status text default 'פתוח',
  treatment text default '',
  treatment_date text,
  notes text default '',
  attachments jsonb default '[]'::jsonb,
  saved_at timestamptz default now()
);

alter table supervision_reports enable row level security;

drop policy if exists "Allow all supervision_reports" on supervision_reports;
create policy "Allow all supervision_reports"
  on supervision_reports
  for all
  using (true)
  with check (true);

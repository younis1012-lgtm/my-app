create table if not exists public.project_email_users (
  id uuid primary key,
  project_id text not null,
  name text not null default '',
  role text not null default '',
  company text not null default '',
  email text not null default '',
  phone text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists project_email_users_project_id_idx
  on public.project_email_users(project_id);

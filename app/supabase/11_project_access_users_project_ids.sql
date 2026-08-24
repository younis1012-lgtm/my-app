-- Persist the projects assigned to each legacy access user.
-- Run once in the Supabase SQL editor before deploying the matching app version.
alter table public.project_access_users
  add column if not exists project_ids uuid[] not null default '{}';

create index if not exists project_access_users_project_ids_idx
  on public.project_access_users using gin (project_ids);

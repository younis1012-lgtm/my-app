-- Quality-control users are professional writers even when an older/default
-- project_members row still carries the readonly access level.
-- The professional assignment is scoped to the same project and login email.

create or replace function public.current_user_can_write(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.project_members pm
      where pm.user_id = auth.uid()
        and pm.project_id = target_project_id
        and pm.active = true
        and pm.role in ('admin', 'readwrite')
    )
    or exists (
      select 1
      from public.project_email_users peu
      where peu.project_id = target_project_id::text
        and peu.active = true
        and lower(trim(peu.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
        and (
          lower(peu.role) like '%בקר%איכות%'
          or lower(peu.role) like '%בקרת%איכות%'
          or lower(peu.role) like '%quality control%'
          or lower(peu.role) like '%quality controller%'
          or lower(peu.role) ~ '(^|[^a-z])qc([^a-z]|$)'
        )
    )
$$;

comment on function public.current_user_can_write(uuid) is
  'Allows project admins/read-write members and active quality controllers assigned by email to the same project.';

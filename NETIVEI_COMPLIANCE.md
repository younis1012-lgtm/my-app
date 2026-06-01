# Netivei Israel Compliance Workplan

This project now includes the first compliance foundation for the Netivei Israel information-system requirements in section `00.02.04.08`.

## Implemented Foundation

- Application roles were expanded to `Administrator`, `Read & Write`, and `Read Only`.
- Existing legacy `user` records are treated as `Read & Write`.
- Read-only users are blocked from save/update/delete operations in the main save wrapper.
- Supabase foundation script added:
  - `project_access_users`
  - `project_members`
  - `project_structure_nodes`
  - `document_registry`
  - `audit_logs`
  - `report_schedules`
  - `project-documents` storage bucket

Run this script in Supabase:

```text
app/supabase/04_netivei_compliance_foundation.sql
```

Then, after creating users in Supabase Authentication, run:

```text
app/supabase/05_supabase_auth_rls.sql
```

## Still Required For Full Approval

- Create Supabase Auth users and add rows to `project_members`.
- Run `05_supabase_auth_rls.sql` only after the membership rows are ready.
- Add UI screens for project structure tree and central document registry.
- Write audit log entries from every create/update/delete action.
- Add automatic daily/weekly/monthly report generation.
- Configure Supabase backup and restore procedures.
- Prepare administrator and user manuals.
- Define the laboratory certificate import/API process with the project laboratory.

## Recommended Rollout Order

1. Run the SQL foundation script in Supabase.
2. Create Supabase Auth users.
3. Add `project_members` rows for each user/project/role.
4. Run the strict RLS script.
5. Add the project structure tree for the active project.
6. Move attachments to the central `project-documents` storage bucket.
7. Enable audit writes for each module.
8. Add scheduled report automation.

## Example Project Member Row

```sql
insert into public.project_members (user_id, project_id, role)
values (
  'AUTH_USER_UUID',
  'PROJECT_UUID',
  'readwrite'
);
```

Use `admin`, `readwrite`, or `readonly`.

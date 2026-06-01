# Netivei Israel Compliance Workplan

This project now includes the first compliance foundation for the Netivei Israel information-system requirements in section `00.02.04.08`.

## Implemented Foundation

- Application roles were expanded to `Administrator`, `Read & Write`, and `Read Only`.
- Existing legacy `user` records are treated as `Read & Write`.
- Read-only users are blocked from save/update/delete operations in the main save wrapper.
- Supabase foundation script added:
  - `project_access_users`
  - `project_structure_nodes`
  - `document_registry`
  - `audit_logs`
  - `report_schedules`
  - `project-documents` storage bucket

Run this script in Supabase:

```text
app/supabase/04_netivei_compliance_foundation.sql
```

## Still Required For Full Approval

- Connect Supabase Auth and replace permissive temporary RLS policies with strict role/project policies.
- Add UI screens for project structure tree and central document registry.
- Write audit log entries from every create/update/delete action.
- Add automatic daily/weekly/monthly report generation.
- Configure Supabase backup and restore procedures.
- Prepare administrator and user manuals.
- Define the laboratory certificate import/API process with the project laboratory.

## Recommended Rollout Order

1. Run the SQL foundation script in Supabase.
2. Verify existing users in `project_access_users` and assign roles.
3. Add the project structure tree for the active project.
4. Move attachments to the central `project-documents` storage bucket.
5. Enable audit writes for each module.
6. Add scheduled report automation.
7. Replace temporary RLS policies with strict Supabase Auth policies.

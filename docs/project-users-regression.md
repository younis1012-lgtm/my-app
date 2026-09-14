# Project user directory regression

The mail rollout (`374bde5`, followed by `b3a3814`) replaced open mailbox policies with authenticated project membership policies. The mail directory reads through the authorized server and merges `project_access_users`; the user screen previously read only `project_email_users` directly. It also saved the entire browser cache across projects, so one unauthorized project could reject the batch. Its error message incorrectly advised rerunning the old permissive schema.

The user screen now loads the same authorized directory. Only an active project admin receives editable stored mailbox rows, including inactive rows; other members receive the same public contact fields as the mail composer. Legacy name, scalar ID and array ID matching share a helper with the access management display. This matching is for directory visibility, not authorization: explicit inactive membership remains a denial.

Unedited directory contacts remain references; saving does not automatically insert them into `project_email_users`. Editing a contact explicitly creates a mailbox entry with its own UUID. Existing stored IDs and mailbox credentials are preserved. Saves require a fresh authenticated admin membership and include only the selected project. No delete operation or data backfill is introduced. Existing browser-only removal behavior is outside this repair.

Both `app/supabase/09_project_email_users.sql` and its older duplicate now install the same authenticated, project-scoped policies as `10_central_email.sql`, transactionally. They require `05_supabase_auth_rls.sql`. Rerunning 09 must never reopen anonymous mailbox access.

## Release verification

1. Deploy the reviewed branch to a preview and log in again as the affected project administrator. An old browser-only login is insufficient for the protected directory.
2. Compare the Majdal Kurum user screen and mail recipients. Include a name-only assignment, an empty `project_ids` with `project_id`, and a name assignment alongside an older ID. Check another project does not leak into the list.
3. Save an existing mailbox row while the browser also has another project's users cached. Verify the existing ID, secret and other project's rows remain unchanged. An unchanged legacy-only contact must not create a row.
4. Check a viewer/editor can view contacts but cannot edit mailboxes; an inactive member cannot read the directory. Test a failed directory request: edits must stay disabled and a clear error must appear.
5. If RLS still denies the administrator, inspect the live database before changing anything. Repository SQL does not prove which policies production has installed. The following is read-only and does not display mailbox passwords:

```sql
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'project_email_users';

select id, name from public.projects where name like '%אלכרום%';
-- Substitute the verified project UUID; verify the affected authenticated user ID separately.
select user_id, project_id, role, active
from public.project_members
where project_id = '<verified-project-uuid>'::uuid;
```

Do not invent memberships, recreate users, disable RLS, or run an older permissive 09 to hide the error. If policies differ, the database owner should review the corrected 09 against production before applying it. This PR does not run SQL against production and does not establish the live database's state.

## Automated verification

Run `node --test tests/*.test.cjs`. Tests cover legacy matching, shared mail/management results, non-admin secret exclusion, revoked membership, directory failure, reference-only contacts, preserved IDs/secrets and project-scoped writes. SQL checks are static consistency checks, not a live Postgres policy test.

The repository has existing TypeScript diagnostics and configures `ignoreBuildErrors: true`. Compare diagnostics with the base commit rather than treating a successful build as a clean typecheck.

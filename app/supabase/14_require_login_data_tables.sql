-- 14: נתוני המערכת נגישים רק למשתמשים מחוברים
-- להריץ ב-Supabase > SQL Editor אחרי 13, ואחרי שבדקת שההתחברות למערכת עובדת.
--
-- מה זה עושה:
-- * מבטל את ההרשאות הפתוחות ("כל אחד יכול לקרוא ולכתוב") בטבלאות הנתונים.
-- * קריאה – רק משתמש מחובר שיש לו שיוך פעיל לפרויקט כלשהו במערכת.
-- * כתיבה ומחיקה – רק משתמש מחובר עם הרשאת עריכה (מנהל / קריאה וכתיבה / בקר איכות).
-- * בלי התחברות (המפתח הציבורי לבד) אי אפשר יותר לקרוא או לשנות נתונים.
--
-- ההפרדה בין פרויקטים ממשיכה להתבצע במערכת עצמה כמו היום.
-- אם משהו מפסיק לעבוד – להריץ את 14_rollback_open_data_tables.sql כדי לחזור למצב הקודם.

create or replace function public.yk_current_user_has_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.project_members pm
      where pm.user_id = auth.uid() and pm.active = true
    )
    or exists (
      select 1 from public.project_email_users eu
      where eu.active = true
        and lower(eu.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
$$;

create or replace function public.yk_current_user_can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.project_members pm
      where pm.user_id = auth.uid() and pm.active = true
        and pm.role::text in ('admin', 'readwrite')
    )
    or exists (
      select 1 from public.project_email_users eu
      where eu.active = true
        and lower(eu.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and (coalesce(eu.role, '') || ' ' || coalesce(eu.name, '') || ' ' || coalesce(eu.company, ''))
          ~* '(quality control|quality controller|qc|electrical inspector|בקרת? איכות|בקר.*(חשמל|גינון|תנועה|תשתיות|תקשורת|תאורה))'
    )
  )
$$;

revoke all on function public.yk_current_user_has_access() from public;
revoke all on function public.yk_current_user_can_write() from public;
grant execute on function public.yk_current_user_has_access() to authenticated;
grant execute on function public.yk_current_user_can_write() to authenticated;

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'projects', 'checklists', 'NCR', 'nonconformances', 'preliminary_records', 'rfi_records',
    'trial_sections', 'attachments', 'plans', 'hold_points', 'project_legends',
    'project_structure_nodes', 'control_processes', 'supervision_reports',
    'lab_email_events', 'project_lab_senders', 'record_links'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'הטבלה % לא קיימת – דילוג', t;
      continue;
    end if;
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.yk_current_user_has_access())', 'yk_read_' || t, t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.yk_current_user_can_write())', 'yk_insert_' || t, t);
    execute format('create policy %I on public.%I for update to authenticated using (public.yk_current_user_can_write()) with check (public.yk_current_user_can_write())', 'yk_update_' || t, t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.yk_current_user_can_write())', 'yk_delete_' || t, t);
    raise notice 'הטבלה % מוגנת – רק משתמשים מחוברים', t;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- בדיקה: רשימת הטבלאות וההרשאות החדשות
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and policyname like 'yk\_%'
order by tablename, cmd;

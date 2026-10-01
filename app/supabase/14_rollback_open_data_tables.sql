-- ביטול של 14 – רק אם אחרי הרצת 14 המערכת לא מציגה נתונים או לא שומרת.
-- מחזיר את טבלאות הנתונים למצב הפתוח הקודם. (לא נוגע בטבלאות המשתמשים שנסגרו ב-13.)

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'projects', 'checklists', 'NCR', 'nonconformances', 'preliminary_records', 'rfi_records',
    'trial_sections', 'attachments', 'plans', 'hold_points', 'project_legends',
    'project_structure_nodes', 'control_processes', 'supervision_reports',
    'lab_email_events', 'project_lab_senders'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t and policyname like 'yk\_%' loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    execute format('create policy %I on public.%I for all using (true) with check (true)', 'open_all_' || t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';

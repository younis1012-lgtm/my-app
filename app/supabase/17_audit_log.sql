-- 17: תיעוד שינויים (היסטוריה) לכל הרשומות במערכת
-- להריץ פעם אחת ב-Supabase > SQL Editor.
--
-- כל יצירה, עדכון, אישור, ביטול אישור, מחיקה ושליחה במייל נרשמים אוטומטית בטבלת audit_log,
-- ישירות בבסיס הנתונים. אף משתמש (גם לא מנהל) לא יכול לערוך או למחוק את ההיסטוריה.

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  project_id text,
  record_type text not null,
  record_id text not null,
  action text not null,
  actor_id uuid,
  actor_name text,
  changes jsonb not null default '[]'::jsonb,
  reason text,
  snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_record_idx on public.audit_log(record_id, created_at desc);
create index if not exists audit_log_project_idx on public.audit_log(project_id, created_at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
drop policy if exists "yk_read_audit_log" on public.audit_log;
do $$
begin
  if to_regprocedure('public.yk_current_user_has_access()') is not null then
    create policy "yk_read_audit_log" on public.audit_log for select to authenticated using (public.yk_current_user_has_access());
  else
    create policy "yk_read_audit_log" on public.audit_log for select to authenticated using (true);
  end if;
end $$;

-- שם המשתמש שביצע את הפעולה, מתוך ההתחברות
create or replace function public.yk_audit_actor_name(fallback text default null)
returns text
language plpgsql
stable
as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
begin
  return coalesce(
    nullif(claims -> 'user_metadata' ->> 'full_name', ''),
    nullif(claims -> 'user_metadata' ->> 'name', ''),
    nullif(claims -> 'app_metadata' ->> 'legacy_username', ''),
    case when coalesce(claims ->> 'email', '') like '%@users.yk-quality.invalid' then null else nullif(claims ->> 'email', '') end,
    nullif(fallback, ''),
    'מערכת'
  );
end $$;

-- ערך קצר ובטוח להצגה (בלי קבצים מוטמעים)
create or replace function public.yk_audit_text(value jsonb)
returns text
language sql
immutable
as $$
  select case
    when value is null or value = 'null'::jsonb then ''
    when jsonb_typeof(value) in ('object', 'array') then '[נתונים]'
    when left(value #>> '{}', 5) = 'data:' then '[קובץ]'
    else left(value #>> '{}', 200)
  end
$$;

create or replace function public.yk_audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_j jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_j jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_j jsonb := coalesce(new_j, old_j);
  changes jsonb := '[]'::jsonb;
  skip text[] := array['saved_at', 'updated_at', 'created_at', 'items', 'images', 'attachments', 'attachment', 'documents', 'signature', 'audit_log'];
  heavy text[] := array['images', 'attachments', 'attachment', 'documents', 'signature', 'items', 'certificates', 'requiredDocuments', 'dataUrl'];
  k text;
  ov jsonb;
  nv jsonb;
  old_status text;
  new_status text;
  act text;
  item jsonb;
  old_item jsonb;
  idx int;
  f text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(new_j) loop
      continue when k = any(skip);
      ov := old_j -> k;
      nv := new_j -> k;
      continue when ov is not distinct from nv;
      if k = 'approval' then
        if (ov ->> 'status') is distinct from (nv ->> 'status') then
          changes := changes || jsonb_build_array(jsonb_build_object('field', 'סטטוס אישור', 'from', coalesce(ov ->> 'status', ''), 'to', coalesce(nv ->> 'status', '')));
        end if;
        if (ov -> 'signatures') is distinct from (nv -> 'signatures') then
          changes := changes || jsonb_build_array(jsonb_build_object('field', 'חתימות', 'from', '', 'to', 'עודכנו'));
        end if;
      elsif k = 'details' and jsonb_typeof(ov) = 'object' and jsonb_typeof(nv) = 'object' then
        for f in select distinct key from (select jsonb_object_keys(ov) as key union select jsonb_object_keys(nv)) keys loop
          continue when f = any(heavy) or f like '\_%' or f in ('savedAt', 'updatedAt', 'approval');
          if (ov -> f) is distinct from (nv -> f) then
            changes := changes || jsonb_build_array(jsonb_build_object('field', f, 'from', public.yk_audit_text(ov -> f), 'to', public.yk_audit_text(nv -> f)));
          end if;
        end loop;
      else
        changes := changes || jsonb_build_array(jsonb_build_object('field', k, 'from', public.yk_audit_text(ov), 'to', public.yk_audit_text(nv)));
      end if;
    end loop;

    -- סעיפי רשימת תיוג: סטטוס, הערות, תאריך ביצוע, אחראי וקבצים לכל סעיף
    if jsonb_typeof(new_j -> 'items') = 'array' and (old_j -> 'items') is distinct from (new_j -> 'items') then
      idx := 0;
      for item in select value from jsonb_array_elements(new_j -> 'items') loop
        idx := idx + 1;
        select value into old_item from jsonb_array_elements(coalesce(old_j -> 'items', '[]'::jsonb)) where value ->> 'id' = item ->> 'id' limit 1;
        if old_item is null then
          changes := changes || jsonb_build_array(jsonb_build_object('field', 'סעיף ' || idx, 'from', '', 'to', 'נוסף: ' || left(coalesce(item ->> 'description', ''), 80)));
          continue;
        end if;
        foreach f in array array['status', 'notes', 'remarks', 'executionDate', 'responsible', 'inspector'] loop
          if (old_item -> f) is distinct from (item -> f) then
            changes := changes || jsonb_build_array(jsonb_build_object('field', 'סעיף ' || idx || ' – ' || f, 'from', public.yk_audit_text(old_item -> f), 'to', public.yk_audit_text(item -> f)));
          end if;
        end loop;
        if jsonb_array_length(coalesce(old_item -> 'attachments', '[]'::jsonb)) <> jsonb_array_length(coalesce(item -> 'attachments', '[]'::jsonb)) then
          changes := changes || jsonb_build_array(jsonb_build_object('field', 'סעיף ' || idx || ' – קבצים', 'from', jsonb_array_length(coalesce(old_item -> 'attachments', '[]'::jsonb))::text, 'to', jsonb_array_length(coalesce(item -> 'attachments', '[]'::jsonb))::text));
        end if;
      end loop;
    end if;

    if (old_j -> 'images') is distinct from (new_j -> 'images') or (old_j -> 'attachments') is distinct from (new_j -> 'attachments') then
      changes := changes || jsonb_build_array(jsonb_build_object('field', 'קבצים מצורפים', 'from', '', 'to', 'עודכנו'));
    end if;

    -- שמירה בלי שינוי בפועל לא נרשמת
    if jsonb_array_length(changes) = 0 then
      return null;
    end if;

    old_status := coalesce(old_j -> 'approval' ->> 'status', old_j ->> 'status', '');
    new_status := coalesce(new_j -> 'approval' ->> 'status', new_j ->> 'status', '');
    act := case
      when new_status in ('approved', 'מאושר', 'סגור', 'שוחררה') and old_status is distinct from new_status then 'approve'
      when old_status in ('approved', 'מאושר', 'סגור', 'שוחררה') and old_status is distinct from new_status then 'reopen'
      else 'update'
    end;
  elsif tg_op = 'INSERT' then
    act := 'create';
  else
    act := 'delete';
  end if;

  insert into public.audit_log (project_id, record_type, record_id, action, actor_id, actor_name, changes, snapshot)
  values (
    row_j ->> 'project_id',
    tg_table_name,
    coalesce(row_j ->> 'id', ''),
    act,
    auth.uid(),
    public.yk_audit_actor_name(coalesce(new_j -> 'details' ->> '_editedBy', old_j -> 'details' ->> '_editedBy')),
    changes,
    case when tg_op = 'DELETE' then old_j - 'items' - 'images' - 'attachments' - 'documents' else null end
  );
  return null;
exception when others then
  -- תיעוד לעולם לא יחסום שמירה
  raise warning 'audit failed: %', sqlerrm;
  return null;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'checklists', 'NCR', 'nonconformances', 'trial_sections', 'rfi_records', 'supervision_reports',
    'preliminary_records', 'control_processes', 'plans', 'hold_points', 'project_structure_nodes'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    execute format('drop trigger if exists yk_audit on public.%I', t);
    execute format('create trigger yk_audit after insert or update or delete on public.%I for each row execute function public.yk_audit_row()', t);
  end loop;
end $$;

-- שליחת מייל נרשמת בהיסטוריה של הרשומה
create or replace function public.yk_audit_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nj jsonb := to_jsonb(new);
  rid text;
  recipients text;
  sender text;
begin
  -- שם השולח לפי המשתמש ששלח (השליחה עצמה נעשית בשרת)
  begin
    execute 'select coalesce(raw_user_meta_data->>''full_name'', raw_user_meta_data->>''name'', raw_app_meta_data->>''legacy_username'', email) from auth.users where id::text = $1'
      into sender using nj ->> 'user_id';
  exception when others then
    sender := null;
  end;
  select string_agg(value, ', ') into recipients
  from jsonb_array_elements_text(case when jsonb_typeof(nj -> 'to_addresses') = 'array' then nj -> 'to_addresses' else '[]'::jsonb end);
  for rid in
    select distinct x from (
      select nj ->> 'record_id' as x
      union all
      select jsonb_array_elements_text(case when jsonb_typeof(nj -> 'record_ids') = 'array' then nj -> 'record_ids' else '[]'::jsonb end)
    ) ids where coalesce(x, '') <> ''
  loop
    insert into public.audit_log (project_id, record_type, record_id, action, actor_id, actor_name, changes)
    values (
      nj ->> 'project_id', coalesce(nj ->> 'module', ''), rid, 'email',
      case when coalesce(nj ->> 'user_id', '') ~ '^[0-9a-f-]{36}$' then (nj ->> 'user_id')::uuid else null end,
      public.yk_audit_actor_name(sender),
      jsonb_build_array(jsonb_build_object('field', 'נמענים', 'from', '', 'to', left(coalesce(recipients, ''), 200)))
    );
  end loop;
  return null;
exception when others then
  raise warning 'audit email failed: %', sqlerrm;
  return null;
end $$;

do $$
begin
  if to_regclass('public.email_history') is not null then
    drop trigger if exists yk_audit_email on public.email_history;
    create trigger yk_audit_email after insert on public.email_history for each row execute function public.yk_audit_email();
  end if;
end $$;

-- פתיחת רשומה מאושרת לעריכה: נרשמת עם הסיבה, רק למשתמש עם הרשאת עריכה
create or replace function public.yk_log_unlock(p_record_type text, p_record_id text, p_project_id text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'יש להתחבר';
  end if;
  if to_regprocedure('public.yk_current_user_can_write()') is not null and not public.yk_current_user_can_write() then
    raise exception 'אין הרשאה לפתוח רשומה מאושרת';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'יש לציין סיבה';
  end if;
  insert into public.audit_log (project_id, record_type, record_id, action, actor_id, actor_name, reason)
  values (p_project_id, p_record_type, p_record_id, 'unlock', auth.uid(), public.yk_audit_actor_name(), left(trim(p_reason), 500));
end $$;

revoke all on function public.yk_log_unlock(text, text, text, text) from public, anon;
grant execute on function public.yk_log_unlock(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

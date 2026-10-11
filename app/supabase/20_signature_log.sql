-- 20: יומן חתימות (אחרי קבצים 17 ו-19)
-- להריץ פעם אחת ב-Supabase > SQL Editor.
--
-- כל חתימה בסעיף של רשימת תיוג, וכל חתימת אישור ברשומה (QC / QA / מנהל עבודה וכו'),
-- נרשמת אוטומטית בטבלת audit_log ע"י בסיס הנתונים עצמו:
--   • מי היה מחובר בפועל (מזהה החשבון ושמו) – לא ניתן לזיוף מהדפדפן;
--   • תאריך ושעה לפי השרת;
--   • השם שנרשם בחתימה;
--   • "טביעת אצבע" של תוכן הסעיף / הרשומה ברגע החתימה.
-- ביטול חתימה נרשם גם הוא. אף משתמש (גם לא מנהל) לא יכול לערוך או למחוק את היומן.
-- הטופס עצמו וה-PDF לא משתנים. היומן מוצג בכפתור "היסטוריה" של הרשומה.

create or replace function public.yk_signature_signed(sig jsonb)
returns boolean
language sql
immutable
as $$
  select sig is not null
    and jsonb_typeof(sig) = 'object'
    and coalesce(sig ->> 'signature', '') <> ''
$$;

create or replace function public.yk_audit_signatures()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_j jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  new_j jsonb := to_jsonb(new);
  changes jsonb := '[]'::jsonb;
  item jsonb;
  old_item jsonb;
  idx int := 0;
  ns jsonb;
  os jsonb;
  label text;
  new_list jsonb;
  old_list jsonb;
  pos int;
  fingerprint text;
begin
  -- 1) חתימות בסעיפי רשימת תיוג
  if jsonb_typeof(new_j -> 'items') = 'array' then
    for item in select value from jsonb_array_elements(new_j -> 'items') loop
      idx := idx + 1;
      old_item := null;
      if old_j is not null and jsonb_typeof(old_j -> 'items') = 'array' then
        select value into old_item from jsonb_array_elements(old_j -> 'items') where value ->> 'id' = item ->> 'id' limit 1;
      end if;
      ns := item -> 'signature';
      os := old_item -> 'signature';
      label := 'סעיף ' || idx || ' – ' || coalesce(nullif(ns ->> 'role', ''), nullif(os ->> 'role', ''), nullif(item ->> 'responsible', ''), 'חתימה');
      if public.yk_signature_signed(ns)
         and (not public.yk_signature_signed(os)
              or (os ->> 'signerName') is distinct from (ns ->> 'signerName')
              or md5(coalesce(os ->> 'signature', '')) <> md5(coalesce(ns ->> 'signature', ''))) then
        fingerprint := left(md5((item - 'signature' - 'attachments')::text), 12);
        changes := changes || jsonb_build_array(jsonb_build_object(
          'field', label,
          'from', case when public.yk_signature_signed(os) then coalesce(os ->> 'signerName', '') else '' end,
          'to', 'נחתם: ' || coalesce(nullif(ns ->> 'signerName', ''), '(ללא שם)') || ' · טביעה ' || fingerprint
        ));
      elsif public.yk_signature_signed(os) and not public.yk_signature_signed(ns) then
        changes := changes || jsonb_build_array(jsonb_build_object(
          'field', label,
          'from', coalesce(os ->> 'signerName', ''),
          'to', 'החתימה בוטלה'
        ));
      end if;
    end loop;
  end if;

  -- 2) חתימות אישור ברשומה (approval.signatures – ברמת הרשומה או בתוך details)
  new_list := coalesce(new_j -> 'approval' -> 'signatures', new_j -> 'details' -> 'approval' -> 'signatures');
  old_list := coalesce(old_j -> 'approval' -> 'signatures', old_j -> 'details' -> 'approval' -> 'signatures');
  if jsonb_typeof(new_list) = 'array' then
    pos := 0;
    for ns in select value from jsonb_array_elements(new_list) loop
      pos := pos + 1;
      os := null;
      if jsonb_typeof(old_list) = 'array' then
        select value into os from jsonb_array_elements(old_list)
        where coalesce(value ->> 'role', '') = coalesce(ns ->> 'role', '') limit 1;
      end if;
      label := 'אישור – ' || coalesce(nullif(ns ->> 'role', ''), 'חתימה ' || pos);
      if public.yk_signature_signed(ns)
         and (not public.yk_signature_signed(os)
              or (os ->> 'signerName') is distinct from (ns ->> 'signerName')
              or md5(coalesce(os ->> 'signature', '')) <> md5(coalesce(ns ->> 'signature', ''))) then
        fingerprint := left(md5((new_j - 'saved_at' - 'updated_at' - 'approval' - 'audit_log' - 'images' - 'attachments')::text), 12);
        changes := changes || jsonb_build_array(jsonb_build_object(
          'field', label,
          'from', case when public.yk_signature_signed(os) then coalesce(os ->> 'signerName', '') else '' end,
          'to', 'נחתם: ' || coalesce(nullif(ns ->> 'signerName', ''), '(ללא שם)') || ' · טביעה ' || fingerprint
        ));
      elsif public.yk_signature_signed(os) and not public.yk_signature_signed(ns) then
        changes := changes || jsonb_build_array(jsonb_build_object('field', label, 'from', coalesce(os ->> 'signerName', ''), 'to', 'החתימה בוטלה'));
      end if;
    end loop;
  end if;

  if jsonb_array_length(changes) = 0 then
    return null;
  end if;

  insert into public.audit_log (project_id, record_type, record_id, action, actor_id, actor_name, changes)
  values (
    new_j ->> 'project_id',
    tg_table_name,
    coalesce(new_j ->> 'id', ''),
    'sign',
    auth.uid(),
    public.yk_audit_actor_name(null),
    changes
  );
  return null;
exception when others then
  -- התיעוד לעולם לא יחסום שמירה
  raise warning 'signature audit failed: %', sqlerrm;
  return null;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'checklists', 'NCR', 'nonconformances', 'trial_sections', 'rfi_records', 'supervision_reports',
    'preliminary_records', 'control_processes', 'hold_points'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    execute format('drop trigger if exists yk_audit_signatures on public.%I', t);
    execute format('create trigger yk_audit_signatures after insert or update on public.%I for each row execute function public.yk_audit_signatures()', t);
  end loop;
end $$;

-- בדיקה: באילו טבלאות יומן החתימות פעיל
select event_object_table as table_name, string_agg(event_manipulation, ', ' order by event_manipulation) as logged_on
from information_schema.triggers
where trigger_name = 'yk_audit_signatures'
group by event_object_table
order by event_object_table;

-- ===== ביטול (רק אם צריך) =====
-- do $$ declare t text; begin
--   foreach t in array array['checklists','NCR','nonconformances','trial_sections','rfi_records','supervision_reports','preliminary_records','control_processes','hold_points'] loop
--     if to_regclass(format('public.%I', t)) is not null then execute format('drop trigger if exists yk_audit_signatures on public.%I', t); end if;
--   end loop; end $$;

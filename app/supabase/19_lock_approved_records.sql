-- 19: נעילת רשומות מאושרות ברמת בסיס הנתונים (אחרי קובץ 17)
-- להריץ פעם אחת ב-Supabase > SQL Editor.
--
-- עד היום הנעילה הייתה רק במסך. מעכשיו גם בסיס הנתונים עצמו דוחה:
--   • שינוי תוכן של רשומה מאושרת – אלא אם נפתחה לעריכה עם סיבה (yk_log_unlock) ב-30 הדקות האחרונות;
--   • מחיקה של רשומה מאושרת – קודם פותחים אותה לעריכה (האישור מתבטל), ורק אז אפשר למחוק.
-- שמירה חוזרת בלי שינוי תוכן (רק saved_at) מותרת.
-- פעולות שרת (service_role) ועבודה ישירה ב-SQL Editor אינן נחסמות.
-- ביטול: להריץ את הבלוק "ביטול" שבסוף הקובץ.

create or replace function public.yk_record_is_approved(p_table text, p_row jsonb)
returns boolean
language sql
immutable
as $$
  select case
    when p_row is null then false
    when p_table = 'supervision_reports' then
      coalesce(p_row ->> 'status', '') = 'מאושר'
      or coalesce(p_row -> 'approval' ->> 'status', '') = 'approved'
    else
      coalesce(p_row -> 'approval' ->> 'status', '') = 'approved'
      or coalesce(p_row ->> 'status', '') in ('approved', 'מאושר')
  end
$$;

-- האם הרשומה נפתחה לעריכה (עם סיבה) לאחרונה – קורא מיומן השינויים שאינו נגיש לעריכה
create or replace function public.yk_recent_unlock(p_record_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.audit_log
    where record_id = p_record_id
      and action = 'unlock'
      and created_at > now() - interval '30 minutes'
  )
$$;

revoke all on function public.yk_recent_unlock(text) from public, anon;
grant execute on function public.yk_recent_unlock(text) to authenticated;

create or replace function public.yk_lock_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  old_j jsonb;
  new_j jsonb;
begin
  -- רק משתמשי האפליקציה נבדקים; שרת (service_role) ו-SQL Editor (postgres) לא נחסמים
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  old_j := to_jsonb(old);
  if not public.yk_record_is_approved(tg_table_name, old_j) then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'רשומה מאושרת אינה ניתנת למחיקה. יש לפתוח אותה לעריכה עם סיבה, ורק אז למחוק.'
      using errcode = '42501';
  end if;

  new_j := to_jsonb(new);
  if (old_j - 'saved_at' - 'updated_at') = (new_j - 'saved_at' - 'updated_at') then
    return new;
  end if;

  if public.yk_recent_unlock(old_j ->> 'id') then
    return new;
  end if;

  raise exception 'רשומה מאושרת נעולה לשינוי. יש לפתוח אותה לעריכה עם סיבה (כפתור "פתיחה לעריכה").'
    using errcode = '42501';
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'checklists', 'NCR', 'nonconformances', 'trial_sections', 'supervision_reports',
    'preliminary_records', 'control_processes'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    execute format('drop trigger if exists yk_lock_guard on public.%I', t);
    execute format('create trigger yk_lock_guard before update or delete on public.%I for each row execute function public.yk_lock_guard()', t);
  end loop;
end $$;

-- בדיקה: באילו טבלאות הנעילה פעילה
select event_object_table as table_name, string_agg(event_manipulation, ', ' order by event_manipulation) as blocked_on
from information_schema.triggers
where trigger_name = 'yk_lock_guard'
group by event_object_table
order by event_object_table;

-- ===== ביטול (רק אם צריך) =====
-- do $$ declare t text; begin
--   foreach t in array array['checklists','NCR','nonconformances','trial_sections','supervision_reports','preliminary_records','control_processes'] loop
--     if to_regclass(format('public.%I', t)) is not null then execute format('drop trigger if exists yk_lock_guard on public.%I', t); end if;
--   end loop; end $$;

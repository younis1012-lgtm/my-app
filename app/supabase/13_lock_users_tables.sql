-- 13: סגירת טבלאות המשתמשים לגישה מהדפדפן
-- להריץ פעם אחת ב-Supabase > SQL Editor, אחרי שהגרסה החדשה של האתר עלתה ב-Vercel.
--
-- אחרי ההרצה:
-- * טבלת משתמשי המערכת (project_access_users), טבלת אנשי הקשר והמייל (project_email_users)
--   והיסטוריית המיילים (email_history) נגישות רק לשרת של האתר.
-- * אי אפשר יותר לקרוא סיסמאות או סיסמאות מייל בעזרת המפתח הציבורי שבאתר.
-- * ההתחברות, ניהול המשתמשים ושליחת המיילים ממשיכים לעבוד דרך השרת.

do $$
declare
  t text;
  p record;
begin
  foreach t in array array['project_access_users', 'project_email_users', 'email_history'] loop
    if to_regclass('public.' || t) is null then
      raise notice 'הטבלה % לא קיימת – דילוג', t;
      continue;
    end if;
    -- מחיקת כל ההרשאות הפתוחות הקיימות על הטבלה
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    raise notice 'הטבלה % נסגרה לגישה מהדפדפן', t;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- בדיקה: אמורות לחזור 0 שורות (אין הרשאות פתוחות על הטבלאות האלה)
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('project_access_users', 'project_email_users', 'email_history');

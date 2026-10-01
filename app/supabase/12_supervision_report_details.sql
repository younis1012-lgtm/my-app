-- דוחות פיקוח עליון: פרטי ביקור, הערות המתכנן, טיפול כולל, קישורים ואישור בקרת איכות.
-- להריץ פעם אחת ב-Supabase → SQL Editor. בטוח להרצה חוזרת.
alter table public.supervision_reports
  add column if not exists details jsonb not null default '{}'::jsonb;

-- רענון זיכרון המטמון של ה-API כדי שהעמודה תהיה זמינה מיד
notify pgrst, 'reload schema';

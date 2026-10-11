-- 21: החלפת סיסמה חובה בכניסה הראשונה
-- להריץ פעם אחת ב-Supabase > SQL Editor.
--
-- משתמש שמנהל קבע לו סיסמה (משתמש חדש או איפוס סיסמה) יחויב לקבוע סיסמה משלו
-- בכניסה הראשונה, לפני שיוכל לעבוד. כך הסיסמה הזמנית שנשלחה בהזמנה במייל מפסיקה לעבוד
-- ורק המשתמש עצמו יודע את הסיסמה שלו.

alter table public.project_access_users
  add column if not exists must_change_password boolean not null default false;

-- בדיקה
select count(*) as users, count(*) filter (where must_change_password) as must_change
from public.project_access_users;

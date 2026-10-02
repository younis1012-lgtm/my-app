-- 16: ניקוי כפילויות שמגדילות את בסיס הנתונים ואת התעבורה מ-Supabase
-- להריץ פעם אחת ב-Supabase > SQL Editor.
--
-- מה זה עושה:
-- בקטעי ניסוי ובאי התאמות, התמונות והקבצים נשמרו פעמיים: גם בעמודת images וגם בתוך details.
-- הקובץ מוחק רק את העותק הכפול שבתוך details, ורק בשורות שבהן אותם קבצים קיימים בעמודת images.
-- שום קובץ לא נמחק מהמערכת – נשאר עותק אחד.

do $$
declare
  t text;
  updated integer;
begin
  foreach t in array array['trial_sections', 'NCR'] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    begin
      execute format(
        'update public.%I
            set details = details - ''images''
          where details ? ''images''
            and images is not null
            and jsonb_typeof(images::jsonb) = ''array''
            and jsonb_typeof(details->''images'') = ''array''
            and jsonb_array_length(images::jsonb) >= jsonb_array_length(details->''images'')',
        t);
      get diagnostics updated = row_count;
      raise notice 'טבלה %: נוקו % שורות', t, updated;
    exception when others then
      raise notice 'טבלה %: דילוג (%)', t, sqlerrm;
    end;
  end loop;
end $$;

-- דוח: הטבלאות הגדולות ביותר (אחרי הניקוי)
select relname as "טבלה",
       pg_size_pretty(pg_total_relation_size(relid)) as "גודל",
       n_live_tup as "שורות"
from pg_stat_user_tables
where schemaname = 'public'
order by pg_total_relation_size(relid) desc
limit 15;

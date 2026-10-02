-- 18: שחזור היסטוריה לרשומות שקיימות מלפני תחילת התיעוד (אחרי קובץ 17)
-- להריץ פעם אחת ב-Supabase > SQL Editor. הרצה חוזרת לא יוצרת כפילויות.
--
-- לכל רשומה קיימת נוספת שורת פתיחה "קיימת לפני תחילת התיעוד", ואחריה מה שאפשר לשחזר מהנתונים:
-- חתימות (מי חתם ומתי), אישור בקרת איכות בדוח פיקוח, ומיילים שנשלחו דרך המערכת.
-- כל שורה משוחזרת מסומנת "שוחזר מנתונים קיימים" – כדי שלא תיראה כתיעוד שנרשם בזמן אמת.

do $$
declare
  t text;
  r record;
  j jsonb;
  rid text;
  created timestamptz;
  sig jsonb;
  signed_at timestamptz;
  last_saved text;
  inserted int := 0;
begin
  foreach t in array array[
    'checklists', 'NCR', 'nonconformances', 'trial_sections', 'rfi_records', 'supervision_reports',
    'preliminary_records', 'control_processes', 'plans', 'hold_points'
  ] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    for r in execute format('select to_jsonb(x) - ''items'' - ''images'' - ''attachments'' - ''documents'' as j from public.%I x', t) loop
      j := r.j;
      rid := j ->> 'id';
      continue when coalesce(rid, '') = '';
      continue when exists (select 1 from public.audit_log where record_id = rid and action = 'baseline');

      begin
        created := coalesce((j ->> 'created_at')::timestamptz, (j ->> 'saved_at')::timestamptz, now());
      exception when others then
        created := now();
      end;
      begin
        last_saved := to_char((j ->> 'saved_at')::timestamptz at time zone 'Asia/Jerusalem', 'DD/MM/YYYY HH24:MI');
      exception when others then
        last_saved := null;
      end;

      insert into public.audit_log (project_id, record_type, record_id, action, actor_name, changes, reason, created_at)
      values (
        j ->> 'project_id', t, rid, 'baseline',
        coalesce(nullif(j -> 'details' ->> 'openedName', ''), nullif(j ->> 'created_by', ''), nullif(j ->> 'author', ''), 'לא ידוע'),
        jsonb_build_array(
          jsonb_build_object('field', 'נוצרה / נשמרה לראשונה', 'from', '', 'to', to_char(created at time zone 'Asia/Jerusalem', 'DD/MM/YYYY HH24:MI')),
          jsonb_build_object('field', 'שמירה אחרונה לפני התיעוד', 'from', '', 'to', coalesce(last_saved, '—'))
        ),
        'שוחזר מנתונים קיימים',
        created
      );
      inserted := inserted + 1;

      -- חתימות שכבר קיימות ברשומה
      if jsonb_typeof(j -> 'approval' -> 'signatures') = 'array' then
        for sig in select value from jsonb_array_elements(j -> 'approval' -> 'signatures') loop
          continue when coalesce(sig ->> 'signerName', '') = '' or coalesce(sig ->> 'signedAt', '') = '';
          begin
            signed_at := (sig ->> 'signedAt')::timestamptz;
          exception when others then
            signed_at := created;
          end;
          insert into public.audit_log (project_id, record_type, record_id, action, actor_name, changes, reason, created_at)
          values (
            j ->> 'project_id', t, rid, 'approve', sig ->> 'signerName',
            jsonb_build_array(jsonb_build_object('field', 'חתימה', 'from', '', 'to', coalesce(sig ->> 'role', '') || ' · ' || (sig ->> 'signedAt'))),
            'שוחזר מנתונים קיימים',
            signed_at
          );
        end loop;
      end if;

      -- אישור בקרת איכות בדוח פיקוח עליון
      if t = 'supervision_reports' and coalesce(j -> 'details' ->> 'qcApprovedBy', '') <> '' then
        begin
          signed_at := (j -> 'details' ->> 'qcApprovedAt')::timestamptz;
        exception when others then
          signed_at := created;
        end;
        insert into public.audit_log (project_id, record_type, record_id, action, actor_name, changes, reason, created_at)
        values (j ->> 'project_id', t, rid, 'approve', j -> 'details' ->> 'qcApprovedBy',
                jsonb_build_array(jsonb_build_object('field', 'אישור בקרת איכות', 'from', '', 'to', coalesce(j -> 'details' ->> 'qcApprovedAt', ''))),
                'שוחזר מנתונים קיימים', coalesce(signed_at, created));
      end if;
    end loop;
  end loop;
  raise notice 'נוספו % שורות פתיחה', inserted;
end $$;

-- מיילים שנשלחו לפני תחילת התיעוד
do $$
declare
  e record;
  nj jsonb;
  rid text;
  recipients text;
  sender text;
  sent_at timestamptz;
begin
  if to_regclass('public.email_history') is null then
    return;
  end if;
  for e in select to_jsonb(h) - 'body' as j from public.email_history h loop
    nj := e.j;
    begin
      sent_at := coalesce((nj ->> 'created_at')::timestamptz, now());
    exception when others then
      sent_at := now();
    end;
    select string_agg(value, ', ') into recipients
    from jsonb_array_elements_text(case when jsonb_typeof(nj -> 'to_addresses') = 'array' then nj -> 'to_addresses' else '[]'::jsonb end);
    begin
      execute 'select coalesce(raw_user_meta_data->>''full_name'', raw_user_meta_data->>''name'', raw_app_meta_data->>''legacy_username'', email) from auth.users where id::text = $1'
        into sender using nj ->> 'user_id';
    exception when others then
      sender := null;
    end;
    for rid in
      select distinct x from (
        select nj ->> 'record_id' as x
        union all
        select jsonb_array_elements_text(case when jsonb_typeof(nj -> 'record_ids') = 'array' then nj -> 'record_ids' else '[]'::jsonb end)
      ) ids where coalesce(x, '') <> ''
    loop
      continue when exists (select 1 from public.audit_log where record_id = rid and action = 'email' and created_at between sent_at - interval '10 seconds' and sent_at + interval '10 seconds');
      insert into public.audit_log (project_id, record_type, record_id, action, actor_name, changes, reason, created_at)
      values (nj ->> 'project_id', coalesce(nj ->> 'module', ''), rid, 'email', coalesce(sender, 'לא ידוע'),
              jsonb_build_array(jsonb_build_object('field', 'נמענים', 'from', '', 'to', left(coalesce(recipients, ''), 200))),
              'שוחזר מנתונים קיימים', sent_at);
    end loop;
  end loop;
end $$;

-- בדיקה: כמה שורות שוחזרו
select action, count(*) from public.audit_log where reason = 'שוחזר מנתונים קיימים' group by action order by action;

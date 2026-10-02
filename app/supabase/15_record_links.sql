-- 15: קישור בין רשומות (פאנל "רשומות מקושרות")
-- להריץ פעם אחת ב-Supabase > SQL Editor.
-- כל שורה היא קישור דו-כיווני בין שתי רשומות באותו פרויקט
-- (רשימת תיוג, אי התאמה, קטע ניסוי, RFI, דוח פיקוח, נקודת עצירה, בקרה מקדימה, תעודת ייחוס, תוכנית, פריט בעץ הפרויקט).

create table if not exists public.record_links (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  a_type text not null,
  a_id text not null,
  b_type text not null,
  b_id text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists record_links_project_idx on public.record_links(project_id);
create index if not exists record_links_a_idx on public.record_links(a_type, a_id);
create index if not exists record_links_b_idx on public.record_links(b_type, b_id);
create unique index if not exists record_links_pair_idx
  on public.record_links(project_id, a_type, a_id, b_type, b_id);

alter table public.record_links enable row level security;
revoke all on public.record_links from anon;
grant select, insert, update, delete on public.record_links to authenticated;

drop policy if exists "yk_read_record_links" on public.record_links;
drop policy if exists "yk_insert_record_links" on public.record_links;
drop policy if exists "yk_update_record_links" on public.record_links;
drop policy if exists "yk_delete_record_links" on public.record_links;

do $$
begin
  -- אם הורץ כבר קובץ 14 – אותן הרשאות כמו בשאר טבלאות הנתונים
  if to_regprocedure('public.yk_current_user_has_access()') is not null
     and to_regprocedure('public.yk_current_user_can_write()') is not null then
    create policy "yk_read_record_links" on public.record_links for select to authenticated using (public.yk_current_user_has_access());
    create policy "yk_insert_record_links" on public.record_links for insert to authenticated with check (public.yk_current_user_can_write());
    create policy "yk_update_record_links" on public.record_links for update to authenticated using (public.yk_current_user_can_write()) with check (public.yk_current_user_can_write());
    create policy "yk_delete_record_links" on public.record_links for delete to authenticated using (public.yk_current_user_can_write());
  else
    -- אחרת: כל משתמש מחובר
    create policy "yk_read_record_links" on public.record_links for select to authenticated using (true);
    create policy "yk_insert_record_links" on public.record_links for insert to authenticated with check (true);
    create policy "yk_update_record_links" on public.record_links for update to authenticated using (true) with check (true);
    create policy "yk_delete_record_links" on public.record_links for delete to authenticated using (true);
  end if;
end $$;

notify pgrst, 'reload schema';

-- תיקון סופי לשגיאת: invalid input syntax for type uuid: "project-806"
-- הופך את מזהה הפרויקט בטבלת פרטי הפרויקט לטקסט, כדי לתמוך גם במזהים כמו project-806 וגם ב-UUID.

alter table if exists public.project_legends disable row level security;

-- מוחק את הטבלה כי כרגע היא ריקה אצלך. אם בעתיד יהיו נתונים, לא להריץ DROP בלי גיבוי.
drop table if exists public.project_legends cascade;

create table public.project_legends (
  project_id text primary key,
  project_name text not null default '',
  project_management text not null default '',
  contractor text not null default '',
  quality_assurance text not null default '',
  quality_control text not null default '',
  work_manager text not null default '',
  surveyor text not null default '',
  supervisor text not null default '',
  extra_factors jsonb not null default '[]'::jsonb,
  updated_at timestamp not null default now()
);

alter table public.project_legends enable row level security;

drop policy if exists "app_select_project_legends" on public.project_legends;
drop policy if exists "app_insert_project_legends" on public.project_legends;
drop policy if exists "app_update_project_legends" on public.project_legends;
drop policy if exists "app_delete_project_legends" on public.project_legends;

create policy "app_select_project_legends"
on public.project_legends for select
to anon, authenticated
using (true);

create policy "app_insert_project_legends"
on public.project_legends for insert
to anon, authenticated
with check (true);

create policy "app_update_project_legends"
on public.project_legends for update
to anon, authenticated
using (true)
with check (true);

create policy "app_delete_project_legends"
on public.project_legends for delete
to anon, authenticated
using (true);

select 'project_legends fixed: project_id is now text' as result;

-- שדרוג טבלת RFI: מספור, יומן שינויים, ומעקב משתמשים
-- להריץ ב-Supabase SQL Editor לפני העלאת הקוד החדש.

create sequence if not exists public.rfi_records_rfi_number_seq;

alter table public.rfi_records
  add column if not exists rfi_number integer,
  add column if not exists created_by text,
  add column if not exists updated_by text,
  add column if not exists updated_at timestamptz,
  add column if not exists audit_log jsonb default '[]'::jsonb;

alter table public.rfi_records
  alter column rfi_number set default nextval('public.rfi_records_rfi_number_seq');

update public.rfi_records
set audit_log = '[]'::jsonb
where audit_log is null;

update public.rfi_records
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

-- נותן מספרים גם ל-RFI קיימים שאין להם מספר אוטומטי
update public.rfi_records
set rfi_number = nextval('public.rfi_records_rfi_number_seq')
where rfi_number is null;

create index if not exists idx_rfi_records_project_id on public.rfi_records(project_id);
create index if not exists idx_rfi_records_updated_at on public.rfi_records(updated_at desc);
create index if not exists idx_rfi_records_rfi_number on public.rfi_records(rfi_number);

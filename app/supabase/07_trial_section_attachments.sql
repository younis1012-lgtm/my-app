alter table public.trial_sections
  add column if not exists images jsonb default '[]'::jsonb,
  add column if not exists approval jsonb,
  add column if not exists details jsonb default '{}'::jsonb;


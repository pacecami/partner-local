create table public.leads (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  month text not null,        -- format: 'YYYY-MM'
  name text not null,
  count integer not null check (count >= 0),
  created_at timestamptz default now(),
  unique (partner_id, month, name)
);

alter table public.leads enable row level security;

create policy "admins full access on leads" on public.leads
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create index leads_partner_month on public.leads (partner_id, month desc);

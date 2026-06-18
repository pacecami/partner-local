create table public.partner_leads (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  month date not null, -- stored as first day of the month
  lead_count integer not null check (lead_count >= 0),
  price numeric(10, 2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partner_leads enable row level security;

create policy "admins manage leads" on public.partner_leads
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "partners read own leads" on public.partner_leads
  for select
  using (exists (select 1 from public.profiles where id = auth.uid() and partner_id = partner_leads.partner_id));

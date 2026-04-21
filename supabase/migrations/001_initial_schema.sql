-- Partners
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ga4_property_id text,
  created_at timestamptz default now()
);

-- Profiles (linked to auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete set null,
  role text not null check (role in ('admin', 'partner')),
  created_at timestamptz default now()
);

-- Campaigns
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active', 'planned', 'ended')),
  start_date date not null,
  end_date date not null,
  monthly_budget integer,
  placements jsonb default '[]',
  created_at timestamptz default now()
);

-- RLS
alter table public.partners enable row level security;
alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;

-- Admins see everything; partners see only their own partner row
create policy "admins read all partners" on public.partners
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "partners read own partner" on public.partners
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and partner_id = partners.id)
  );

create policy "admins write partners" on public.partners
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Profiles
create policy "read own profile" on public.profiles
  for select using (id = auth.uid());

create policy "admins read all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles p2 where p2.id = auth.uid() and p2.role = 'admin')
  );

create policy "admins write profiles" on public.profiles
  for all using (
    exists (select 1 from public.profiles p2 where p2.id = auth.uid() and p2.role = 'admin')
  );

-- Campaigns
create policy "admins read all campaigns" on public.campaigns
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "partners read own campaigns" on public.campaigns
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and partner_id = campaigns.partner_id)
  );

create policy "admins write campaigns" on public.campaigns
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Auto-create profile when new user signs up (via trigger)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  -- Default role is 'partner'; admins are set manually
  insert into public.profiles (id, role)
  values (new.id, 'partner')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

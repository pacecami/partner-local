-- Ensure RLS is enabled on all public tables
alter table if exists public.partners enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.campaigns enable row level security;

-- Drop and recreate policies to ensure they exist (idempotent)
do $$
begin
  -- Partners policies
  drop policy if exists "admins read all partners" on public.partners;
  drop policy if exists "partners read own partner" on public.partners;
  drop policy if exists "admins write partners" on public.partners;

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

  -- Profiles policies
  drop policy if exists "read own profile" on public.profiles;
  drop policy if exists "admins read all profiles" on public.profiles;
  drop policy if exists "admins write profiles" on public.profiles;

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

  -- Campaigns policies
  drop policy if exists "admins read all campaigns" on public.campaigns;
  drop policy if exists "partners read own campaigns" on public.campaigns;
  drop policy if exists "admins write campaigns" on public.campaigns;

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
end $$;

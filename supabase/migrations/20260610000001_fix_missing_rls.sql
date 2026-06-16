-- Enable RLS on all tables missing it
alter table if exists public.fixed_placements enable row level security;
alter table if exists public.admin_emails enable row level security;
alter table if exists public.planning_entries enable row level security;
alter table if exists public.settings enable row level security;
alter table if exists public.subscription_periods enable row level security;
alter table if exists public.admin_tokens enable row level security;

-- fixed_placements: admins full access, partners read own
drop policy if exists "admins manage fixed_placements" on public.fixed_placements;
drop policy if exists "partners read own fixed_placements" on public.fixed_placements;

create policy "admins manage fixed_placements" on public.fixed_placements
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "partners read own fixed_placements" on public.fixed_placements
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and partner_id = fixed_placements.partner_id)
  );

-- admin_emails: admins only (contains sensitive data)
drop policy if exists "admins manage admin_emails" on public.admin_emails;

create policy "admins manage admin_emails" on public.admin_emails
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- planning_entries: admins full access, partners read own
drop policy if exists "admins manage planning_entries" on public.planning_entries;
drop policy if exists "partners read own planning_entries" on public.planning_entries;

create policy "admins manage planning_entries" on public.planning_entries
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- planning_entries has no partner_id — partners have no direct access

-- settings: admins only
drop policy if exists "admins manage settings" on public.settings;

create policy "admins manage settings" on public.settings
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- subscription_periods: admins full access, partners read own
drop policy if exists "admins manage subscription_periods" on public.subscription_periods;
drop policy if exists "partners read own subscription_periods" on public.subscription_periods;

create policy "admins manage subscription_periods" on public.subscription_periods
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "partners read own subscription_periods" on public.subscription_periods
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and partner_id = subscription_periods.partner_id)
  );

-- admin_tokens: admins only (sensitive credentials)
drop policy if exists "admins manage admin_tokens" on public.admin_tokens;

create policy "admins manage admin_tokens" on public.admin_tokens
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

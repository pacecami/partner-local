-- Split banner/inapp Visninger og Kliks op på iOS og Android
alter table public.campaigns add column impressions_ios integer;
alter table public.campaigns add column clicks_ios integer;
alter table public.campaigns add column impressions_android integer;
alter table public.campaigns add column clicks_android integer;

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS ga4_groups_1 text,
  ADD COLUMN IF NOT EXISTS ga4_groups_2 text,
  ADD COLUMN IF NOT EXISTS ga4_groups_3 text,
  ADD COLUMN IF NOT EXISTS ga4_groups_4 text;

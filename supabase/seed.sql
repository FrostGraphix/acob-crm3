insert into public.sites (code, name, region)
values
  ('musha', 'Musha', 'Primary service territory'),
  ('ogufa', 'Ogufa', 'Primary service territory'),
  ('umaisha', 'Umaisha', 'Primary service territory'),
  ('tunga', 'Tunga', 'Primary service territory'),
  ('kyakale', 'Kyakale', 'Primary service territory')
on conflict (code) do update
set
  name = excluded.name,
  region = excluded.region,
  is_active = true,
  updated_at = timezone('utc', now());

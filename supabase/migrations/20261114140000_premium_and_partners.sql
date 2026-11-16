-- Premium switch and partner banners (sponsors).
-- For now only admins and moderators count as premium and can see banners
-- marked "concept", so new features can be tested and shown to businesses
-- before members see them. Safe to run more than once.

-- 1. Premium switch. Later this also returns true for paying Supporters.
create or replace function public.has_premium()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.has_staff_role();
$$;
grant execute on function public.has_premium() to authenticated;

-- 2. Partner banners.
create table if not exists public.partner_banners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  headline text not null default '' check (char_length(headline) <= 80),
  cta_label text not null default 'Learn more' check (char_length(cta_label) between 1 and 24),
  link_url text not null default '' check (link_url = '' or link_url ~* '^https://'),
  image_url text not null check (char_length(image_url) between 10 and 500),
  -- Empty means: show for every sport.
  sport text check (sport is null or char_length(sport) <= 60),
  status text not null default 'concept' check (status in ('concept', 'live')),
  starts_on date,
  ends_on date,
  sort_order integer not null default 0,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partner_banners enable row level security;

drop policy if exists "Live partner banners are visible, the team sees all" on public.partner_banners;
create policy "Live partner banners are visible, the team sees all"
on public.partner_banners for select
using (
  public.has_staff_role()
  or (
    status = 'live'
    and (starts_on is null or starts_on <= current_date)
    and (ends_on is null or ends_on >= current_date)
  )
);

drop policy if exists "The team adds partner banners" on public.partner_banners;
create policy "The team adds partner banners"
on public.partner_banners for insert
with check (public.has_staff_role());

drop policy if exists "The team edits partner banners" on public.partner_banners;
create policy "The team edits partner banners"
on public.partner_banners for update
using (public.has_staff_role())
with check (public.has_staff_role());

drop policy if exists "The team removes partner banners" on public.partner_banners;
create policy "The team removes partner banners"
on public.partner_banners for delete
using (public.has_staff_role());

revoke all on public.partner_banners from anon;
grant select, insert, update, delete on public.partner_banners to authenticated;

-- 3. Views and taps, at most one of each per member per banner per day
-- (keeps the table small and the numbers honest).
create table if not exists public.partner_banner_events (
  banner_id uuid not null references public.partner_banners(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('view', 'tap')),
  day date not null default current_date,
  primary key (banner_id, user_id, kind, day)
);

alter table public.partner_banner_events enable row level security;

drop policy if exists "Members log their own banner views and taps" on public.partner_banner_events;
create policy "Members log their own banner views and taps"
on public.partner_banner_events for insert
with check (user_id = auth.uid());

drop policy if exists "The team reads banner numbers" on public.partner_banner_events;
create policy "The team reads banner numbers"
on public.partner_banner_events for select
using (public.has_staff_role());

revoke all on public.partner_banner_events from anon;
grant select, insert on public.partner_banner_events to authenticated;

-- 4. Banner images: public bucket, compressed JPEGs up to 2 MB, team uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-banners', 'partner-banners', true, 2097152, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view partner banner images" on storage.objects;
drop policy if exists "The team uploads partner banner images" on storage.objects;
drop policy if exists "The team removes partner banner images" on storage.objects;

create policy "Anyone can view partner banner images"
on storage.objects for select
using (bucket_id = 'partner-banners');

create policy "The team uploads partner banner images"
on storage.objects for insert
with check (bucket_id = 'partner-banners' and public.has_staff_role());

create policy "The team removes partner banner images"
on storage.objects for delete
using (bucket_id = 'partner-banners' and public.has_staff_role());

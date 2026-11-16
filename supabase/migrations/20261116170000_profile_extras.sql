-- Pro: a cover photo on your profile and up to 5 favourite spots.
-- Everyone signed in can see them; only premium members can set them.
-- Safe to run more than once.

create table if not exists public.profile_extras (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  cover_url text check (cover_url is null or char_length(cover_url) <= 500),
  favourite_spots text[] not null default '{}' check (cardinality(favourite_spots) <= 5),
  updated_at timestamptz not null default now()
);

alter table public.profile_extras enable row level security;

drop policy if exists "Members see profile extras" on public.profile_extras;
create policy "Members see profile extras"
on public.profile_extras for select using (auth.uid() is not null);

drop policy if exists "Premium members add their profile extras" on public.profile_extras;
create policy "Premium members add their profile extras"
on public.profile_extras for insert
with check (user_id = auth.uid() and public.has_premium());

drop policy if exists "Premium members change their profile extras" on public.profile_extras;
create policy "Premium members change their profile extras"
on public.profile_extras for update
using (user_id = auth.uid())
with check (user_id = auth.uid() and public.has_premium());

revoke all on public.profile_extras from anon;
grant select, insert, update on public.profile_extras to authenticated;

-- Cover photos: public bucket, compressed JPEGs up to 2 MB, own folder only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-covers', 'profile-covers', true, 2097152, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view profile covers" on storage.objects;
drop policy if exists "Premium members upload their own cover" on storage.objects;
drop policy if exists "Members remove their own cover" on storage.objects;

create policy "Anyone can view profile covers"
on storage.objects for select using (bucket_id = 'profile-covers');

create policy "Premium members upload their own cover"
on storage.objects for insert
with check (
  bucket_id = 'profile-covers'
  and auth.uid()::text = (storage.foldername(name))[1]
  and public.has_premium()
);

create policy "Members remove their own cover"
on storage.objects for delete
using (bucket_id = 'profile-covers' and auth.uid()::text = (storage.foldername(name))[1]);

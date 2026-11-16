-- Pro: Stories. Members share a short story with a photo about a trip or
-- session. Everyone signed in can read them; premium members can post.
-- Stories can be reported; the team can hide or delete them.
-- Safe to run more than once.

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  body text not null check (char_length(body) between 10 and 2000),
  photo_url text check (photo_url is null or char_length(photo_url) <= 500),
  sport text check (sport is null or char_length(sport) <= 60),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_stories_created on public.stories(created_at desc);

alter table public.stories enable row level security;

drop policy if exists "Members read stories" on public.stories;
create policy "Members read stories"
on public.stories for select
using (
  auth.uid() is not null
  and (not hidden or author_id = auth.uid() or public.has_staff_role())
  and not public.is_blocked_from_current_user(author_id)
);

drop policy if exists "Premium members post stories" on public.stories;
create policy "Premium members post stories"
on public.stories for insert
with check (author_id = auth.uid() and public.has_premium());

drop policy if exists "Authors and the team remove stories" on public.stories;
create policy "Authors and the team remove stories"
on public.stories for delete
using (author_id = auth.uid() or public.has_staff_role());

drop policy if exists "The team hides stories" on public.stories;
create policy "The team hides stories"
on public.stories for update
using (public.has_staff_role())
with check (public.has_staff_role());

revoke all on public.stories from anon;
grant select, insert, update, delete on public.stories to authenticated;

-- Story photos: public bucket, compressed JPEGs up to 2 MB, own folder only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-photos', 'story-photos', true, 2097152, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view story photos" on storage.objects;
drop policy if exists "Premium members upload story photos" on storage.objects;
drop policy if exists "Authors and the team remove story photos" on storage.objects;

create policy "Anyone can view story photos"
on storage.objects for select using (bucket_id = 'story-photos');

create policy "Premium members upload story photos"
on storage.objects for insert
with check (
  bucket_id = 'story-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
  and public.has_premium()
);

create policy "Authors and the team remove story photos"
on storage.objects for delete
using (bucket_id = 'story-photos' and (auth.uid()::text = (storage.foldername(name))[1] or public.has_staff_role()));

-- Reports: stories can be reported too.
alter table public.moderation_reports
  drop constraint if exists moderation_reports_target_type_check;
alter table public.moderation_reports
  add constraint moderation_reports_target_type_check
  check (target_type in ('profile', 'activity', 'personal_record', 'story'));

create or replace function public.submit_moderation_report(
  target_type text,
  target_id text,
  report_reason text,
  report_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  reporter uuid := auth.uid();
  target_user uuid;
  report_evidence jsonb;
  new_report_id uuid;
begin
  if reporter is null then
    raise exception 'Sign in before submitting a report.';
  end if;

  if report_reason is null or report_reason not in (
    'inappropriate_or_sexual_content',
    'harassment_or_bullying',
    'spam_or_scam',
    'fake_profile',
    'safety_concern',
    'other'
  ) then
    raise exception 'Choose a valid report reason.';
  end if;

  if char_length(coalesce(report_note, '')) > 1000 then
    raise exception 'Report notes must be 1000 characters or fewer.';
  end if;

  if target_type = 'profile' then
    select profiles.id,
      jsonb_build_object(
        'id', profiles.id,
        'first_name', profiles.first_name,
        'suburb', profiles.suburb,
        'bio', profiles.bio,
        'photo_url', profiles.photo_url,
        'selfie_verified', profiles.selfie_verified
      )
    into target_user, report_evidence
    from public.profiles
    where profiles.id::text = target_id;
  elsif target_type = 'activity' then
    select activities.host_id,
      jsonb_build_object(
        'id', activities.id,
        'host_id', activities.host_id,
        'title', activities.title,
        'sport_id', activities.sport_id,
        'starts_at', activities.starts_at,
        'meeting_point', activities.meeting_point,
        'suburb', activities.suburb,
        'notes', activities.notes,
        'cover_image_url', activities.cover_image_url
      )
    into target_user, report_evidence
    from public.activities
    where activities.id::text = target_id;
  elsif target_type = 'story' then
    select stories.author_id,
      jsonb_build_object(
        'id', stories.id,
        'title', stories.title,
        'body', stories.body,
        'photo_url', stories.photo_url
      )
    into target_user, report_evidence
    from public.stories
    where stories.id::text = target_id;
  else
    raise exception 'This type of content cannot be reported yet.';
  end if;

  if report_evidence is null then
    raise exception 'The reported profile or activity could not be found.';
  end if;

  if target_user = reporter then
    raise exception 'You cannot report your own profile or activity.';
  end if;

  insert into public.moderation_reports (
    reporter_id,
    target_type,
    target_id,
    target_user_id,
    reason,
    note,
    evidence
  )
  values (
    reporter,
    target_type,
    target_id,
    target_user,
    report_reason,
    coalesce(report_note, ''),
    report_evidence
  )
  returning id into new_report_id;

  return new_report_id;
end;
$$;

revoke all on function public.submit_moderation_report(text, text, text, text) from public, anon;
grant execute on function public.submit_moderation_report(text, text, text, text) to authenticated;

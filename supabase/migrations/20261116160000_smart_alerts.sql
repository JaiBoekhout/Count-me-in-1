-- Pro: smart alerts. "Tell me when there is spearfishing within 10 km on a
-- weekend." When a new activity goes live, matching members get a
-- notification (and a push via the notifications webhook).
-- Safe to run more than once.

create table if not exists public.activity_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  sport text check (sport is null or char_length(sport) <= 60),
  -- Rounded to about 1 km; null with radius_km null means anywhere.
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  place_label text not null default '' check (char_length(place_label) <= 120),
  radius_km integer check (radius_km between 1 and 500),
  weekend_only boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_alerts_user on public.activity_alerts(user_id);

alter table public.activity_alerts enable row level security;

drop policy if exists "Members see their own alerts" on public.activity_alerts;
create policy "Members see their own alerts"
on public.activity_alerts for select using (user_id = auth.uid());

drop policy if exists "Premium members add alerts" on public.activity_alerts;
create policy "Premium members add alerts"
on public.activity_alerts for insert
with check (user_id = auth.uid() and public.has_premium()
  and (select count(*) from public.activity_alerts where user_id = auth.uid()) < 10);

drop policy if exists "Members remove their own alerts" on public.activity_alerts;
create policy "Members remove their own alerts"
on public.activity_alerts for delete using (user_id = auth.uid());

revoke all on public.activity_alerts from anon;
grant select, insert, delete on public.activity_alerts to authenticated;

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'participant_left', 'invite', 'invite_accepted', 'invite_declined',
    'activity_cancelled', 'pr_confirmed', 'pr_flagged', 'pr_verified',
    'friend_request', 'friend_accepted',
    'activity_approved', 'activity_rejected', 'sport_suggested',
    'role_changed', 'profile_updated', 'staff_message', 'staff_message_reply',
    'staff_message_revoked', 'removed_from_activity', 'activity_updated',
    'activity_reminder', 'activity_alert'
  ));

-- Is this member premium (staff or an active Pro period)? For triggers,
-- where auth.uid() is the host, not the alert owner.
create or replace function public.member_has_premium(member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (select 1 from public.user_roles where user_id = member_id and role in ('moderator', 'admin'))
    or exists (select 1 from public.premium_grants where user_id = member_id and now() between starts_at and ends_at);
$$;
revoke all on function public.member_has_premium(uuid) from public, anon, authenticated;

create or replace function public.notify_activity_alerts()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  sport_name text;
  zone text;
  local_start timestamp;
begin
  -- Only live activities: new and approved, or just approved by a moderator.
  if coalesce(new.review_status, 'approved') <> 'approved' then return new; end if;
  if tg_op = 'UPDATE' and coalesce(old.review_status, 'approved') = 'approved' then return new; end if;
  if new.starts_at <= now() then return new; end if;

  select name into sport_name from public.sports where id = new.sport_id;
  zone := public.place_time_zone(new.suburb);
  local_start := new.starts_at at time zone zone;

  insert into public.notifications (user_id, actor_id, activity_id, type, body)
  select distinct alert.user_id, new.host_id, new.id, 'activity_alert',
    left(
      'New ' || coalesce(sport_name, 'activity') || ': ' || new.title || ', '
        || to_char(local_start, 'Dy DD Mon, HH12:MI AM') || ' at ' || new.meeting_point || '.',
      500
    )
  from public.activity_alerts alert
  where alert.user_id <> new.host_id
    and (alert.sport is null or alert.sport = sport_name)
    and (not alert.weekend_only or extract(isodow from local_start) in (6, 7))
    and (
      alert.radius_km is null
      or alert.latitude is null
      or (
        new.latitude is not null and new.longitude is not null
        and 2 * 6371 * asin(sqrt(
          power(sin(radians(new.latitude - alert.latitude) / 2), 2)
          + cos(radians(alert.latitude)) * cos(radians(new.latitude))
            * power(sin(radians(new.longitude - alert.longitude) / 2), 2)
        )) <= alert.radius_km
      )
    )
    and public.member_has_premium(alert.user_id)
    and not public.is_blocked_pair(alert.user_id, new.host_id);
  return new;
end;
$$;

-- Blocked in either direction (used so blocked members never get alerts).
create or replace function public.is_blocked_pair(first_id uuid, second_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = first_id and blocked_user_id = second_id)
       or (blocker_id = second_id and blocked_user_id = first_id)
  );
$$;
revoke all on function public.is_blocked_pair(uuid, uuid) from public, anon, authenticated;

drop trigger if exists activity_alerts_on_insert on public.activities;
create trigger activity_alerts_on_insert
after insert on public.activities
for each row execute function public.notify_activity_alerts();

drop trigger if exists activity_alerts_on_approve on public.activities;
create trigger activity_alerts_on_approve
after update of review_status on public.activities
for each row execute function public.notify_activity_alerts();

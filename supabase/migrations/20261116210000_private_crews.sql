-- Pro: private crews. A crew is a fixed group of mates (for example your
-- Saturday dive crew). The owner invites friends; an activity can be posted
-- for one crew only, and then only that crew, the host and the team see it.
-- Safe to run more than once.

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'accepted')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

create index if not exists idx_crew_members_user on public.crew_members(user_id);

alter table public.activities
  add column if not exists crew_id uuid references public.crews(id) on delete cascade;

create index if not exists idx_activities_crew on public.activities(crew_id);

-- Accepted member (the owner is always an accepted member).
create or replace function public.is_crew_member(target_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1 from public.crew_members
    where crew_id = target_crew_id and user_id = auth.uid() and status = 'accepted'
  );
$$;
grant execute on function public.is_crew_member(uuid) to authenticated;

create or replace function public.is_crew_owner(target_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (select 1 from public.crews where id = target_crew_id and owner_id = auth.uid());
$$;
grant execute on function public.is_crew_owner(uuid) to authenticated;

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;

drop policy if exists "Members see their crews" on public.crews;
create policy "Members see their crews"
on public.crews for select
using (
  owner_id = auth.uid()
  or exists (select 1 from public.crew_members m where m.crew_id = crews.id and m.user_id = auth.uid())
  or public.has_staff_role()
);

drop policy if exists "Premium members start crews" on public.crews;
create policy "Premium members start crews"
on public.crews for insert
with check (owner_id = auth.uid() and public.has_premium()
  and (select count(*) from public.crews where owner_id = auth.uid()) < 10);

drop policy if exists "Owners rename crews" on public.crews;
create policy "Owners rename crews"
on public.crews for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Owners delete crews" on public.crews;
create policy "Owners delete crews"
on public.crews for delete using (owner_id = auth.uid());

drop policy if exists "Crew members see each other" on public.crew_members;
create policy "Crew members see each other"
on public.crew_members for select
using (user_id = auth.uid() or public.is_crew_member(crew_id) or public.is_crew_owner(crew_id) or public.has_staff_role());

-- Adding members goes through invite_to_crew (owner only, friends only).
drop policy if exists "Owners remove members, members leave" on public.crew_members;
create policy "Owners remove members, members leave"
on public.crew_members for delete
using (user_id = auth.uid() or public.is_crew_owner(crew_id));

revoke all on public.crews from anon;
revoke all on public.crew_members from anon;
grant select, insert, update, delete on public.crews to authenticated;
grant select, delete on public.crew_members to authenticated;

-- The owner becomes an accepted member automatically.
create or replace function public.add_crew_owner()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  insert into public.crew_members (crew_id, user_id, status, invited_by)
  values (new.id, new.owner_id, 'accepted', new.owner_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists crew_add_owner on public.crews;
create trigger crew_add_owner after insert on public.crews
for each row execute function public.add_crew_owner();

-- Notifications for invites.
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
    'activity_reminder', 'activity_alert', 'crew_invite'
  ));

create or replace function public.invite_to_crew(target_crew_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  crew_row public.crews%rowtype;
  owner_name text;
begin
  select * into crew_row from public.crews where id = target_crew_id;
  if not found or crew_row.owner_id <> auth.uid() then
    raise exception 'Only the crew owner can invite people.';
  end if;
  if (select count(*) from public.crew_members where crew_id = target_crew_id) >= 30 then
    raise exception 'A crew can have up to 30 members.';
  end if;
  if not exists (
    select 1 from public.friend_requests
    where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = target_user_id)
        or (requester_id = target_user_id and addressee_id = auth.uid()))
  ) then
    raise exception 'You can only invite friends to your crew.';
  end if;
  insert into public.crew_members (crew_id, user_id, status, invited_by)
  values (target_crew_id, target_user_id, 'invited', auth.uid())
  on conflict do nothing;
  if found then
    select first_name into owner_name from public.profiles where id = auth.uid();
    insert into public.notifications (user_id, actor_id, type, body)
    values (target_user_id, auth.uid(), 'crew_invite',
      left(coalesce(owner_name, 'A mate') || ' invited you to the crew ' || crew_row.name || '.', 500));
  end if;
end;
$$;
revoke all on function public.invite_to_crew(uuid, uuid) from public, anon;
grant execute on function public.invite_to_crew(uuid, uuid) to authenticated;

create or replace function public.respond_to_crew_invite(target_crew_id uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if accept then
    update public.crew_members set status = 'accepted'
    where crew_id = target_crew_id and user_id = auth.uid() and status = 'invited';
  else
    delete from public.crew_members
    where crew_id = target_crew_id and user_id = auth.uid() and status = 'invited';
  end if;
end;
$$;
revoke all on function public.respond_to_crew_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_to_crew_invite(uuid, boolean) to authenticated;

-- Crew-only activities: an extra (restrictive) rule on top of the existing
-- ones, so nothing else about who sees activities changes.
drop policy if exists "Crew activities only for the crew" on public.activities;
create policy "Crew activities only for the crew"
on public.activities
as restrictive
for select
using (
  crew_id is null
  or host_id = auth.uid()
  or public.is_crew_member(crew_id)
  or public.has_staff_role()
);

-- Only premium crew members can post an activity for their crew.
create or replace function public.check_crew_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.crew_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.crew_id is not distinct from old.crew_id then return new; end if;
  if not exists (
    select 1 from public.crew_members
    where crew_id = new.crew_id and user_id = new.host_id and status = 'accepted'
  ) then
    raise exception 'You can only post for a crew you are in.';
  end if;
  if not public.member_has_premium(new.host_id) then
    raise exception 'Crew-only activities are part of Pro.';
  end if;
  return new;
end;
$$;

drop trigger if exists activity_check_crew on public.activities;
create trigger activity_check_crew
before insert or update of crew_id on public.activities
for each row execute function public.check_crew_activity();

-- Smart alerts: never for crew-only activities.
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
  -- Crew-only activities are private: no alerts for people outside the crew.
  if new.crew_id is not null then return new; end if;

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

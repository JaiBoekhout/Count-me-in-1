-- 1. Check-in stays open until 24 hours after the start (no longer only
--    on the calendar day), and closes after that.
-- 2. Reminder 1 hour before an activity starts, for the host and everyone
--    going. A scheduled job in the database (pg_cron, free on Supabase)
--    checks every 5 minutes; the push goes out via the notifications webhook.
-- Safe to run more than once.

create or replace function public.confirm_activity_meetup(
  target_activity_id uuid,
  scanned_code uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
  scanned_user_id uuid;
  activity_host_id uuid;
  activity_start timestamptz;
  activity_zone text;
  existing_partner_id uuid;
  confirmed_time timestamptz := now();
begin
  if viewer_id is null then
    raise exception 'Sign in before confirming a meetup.';
  end if;

  select host_id, starts_at, public.place_time_zone(suburb)
  into activity_host_id, activity_start, activity_zone
  from public.activities
  where id = target_activity_id
  for update;

  if not found then
    raise exception 'This activity could not be found.';
  end if;

  -- Open from the start of the activity day (in the place's time zone)
  -- until 24 hours after the start time.
  if (now() at time zone activity_zone)::date < (activity_start at time zone activity_zone)::date then
    raise exception 'Check-in opens on the activity day.';
  end if;
  if now() > activity_start + interval '24 hours' then
    raise exception 'Check-in closed 24 hours after the start of the activity.';
  end if;

  if viewer_id <> activity_host_id and not exists (
    select 1
    from public.activity_join_requests
    where activity_id = target_activity_id
      and user_id = viewer_id
      and status = 'accepted'
  ) then
    raise exception 'Only the host and accepted participants can check in.';
  end if;

  select user_id into scanned_user_id
  from public.activity_checkin_codes
  where activity_id = target_activity_id
    and code = scanned_code;

  if scanned_user_id is null or scanned_user_id = viewer_id then
    raise exception 'Scan another accepted participant''s code for this activity.';
  end if;

  if scanned_user_id <> activity_host_id and not exists (
    select 1
    from public.activity_join_requests
    where activity_id = target_activity_id
      and user_id = scanned_user_id
      and status = 'accepted'
  ) then
    raise exception 'That check-in code is not for an accepted participant.';
  end if;

  select partner_id into existing_partner_id
  from public.activity_meetup_confirmations
  where activity_id = target_activity_id and user_id = viewer_id;

  if existing_partner_id is not null then
    if existing_partner_id = scanned_user_id
      and exists (
        select 1
        from public.activity_meetup_confirmations
        where activity_id = target_activity_id
          and user_id = scanned_user_id
          and partner_id = viewer_id
      ) then
      return (
        select confirmed_at
        from public.activity_meetup_confirmations
        where activity_id = target_activity_id and user_id = viewer_id
      );
    end if;
    raise exception 'A meetup has already been confirmed for you for this activity.';
  end if;

  if exists (
    select 1
    from public.activity_meetup_confirmations
    where activity_id = target_activity_id and user_id = scanned_user_id
  ) then
    raise exception 'A meetup has already been confirmed for that participant.';
  end if;

  insert into public.activity_meetup_confirmations
    (activity_id, user_id, partner_id, confirmed_at)
  values
    (target_activity_id, viewer_id, scanned_user_id, confirmed_time),
    (target_activity_id, scanned_user_id, viewer_id, confirmed_time);

  return confirmed_time;
end;
$$;

revoke all on function public.confirm_activity_meetup(uuid, uuid) from public, anon;
grant execute on function public.confirm_activity_meetup(uuid, uuid) to authenticated;

-- Reminders -----------------------------------------------------------------

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
    'activity_reminder'
  ));

alter table public.activities
  add column if not exists reminder_sent_at timestamptz;

create or replace function public.send_activity_reminders()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  sent integer := 0;
  activity_row record;
begin
  for activity_row in
    select id, host_id, title, starts_at, meeting_point, suburb
    from public.activities
    where reminder_sent_at is null
      and starts_at > now()
      and starts_at <= now() + interval '65 minutes'
    for update skip locked
  loop
    insert into public.notifications (user_id, actor_id, activity_id, type, body)
    select member.user_id, activity_row.host_id, activity_row.id, 'activity_reminder',
      left(
        activity_row.title || ' starts at '
          || to_char(activity_row.starts_at at time zone public.place_time_zone(activity_row.suburb), 'HH12:MI AM')
          || '. Meet at ' || activity_row.meeting_point || '.',
        500
      )
    from (
      select activity_row.host_id as user_id
      union
      select user_id
      from public.activity_join_requests
      where activity_id = activity_row.id and status = 'accepted'
    ) as member
    -- Respect "Activity reminder · 1 hour before" in Notification settings.
    where not exists (
      select 1 from public.notification_preferences pref
      where pref.user_id = member.user_id and pref.reminder_hour_before = false
    );

    update public.activities set reminder_sent_at = now() where id = activity_row.id;
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;

revoke all on function public.send_activity_reminders() from public, anon, authenticated;

-- Changing the start time sends a new reminder for the new time.
create or replace function public.reset_activity_reminder()
returns trigger
language plpgsql
as $$
begin
  if new.starts_at is distinct from old.starts_at then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists activity_reset_reminder on public.activities;
create trigger activity_reset_reminder
before update on public.activities
for each row
execute function public.reset_activity_reminder();

-- Run every 5 minutes.
create extension if not exists pg_cron with schema extensions;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'activity-reminders') then
    perform cron.unschedule('activity-reminders');
  end if;
  perform cron.schedule('activity-reminders', '*/5 * * * *', 'select public.send_activity_reminders()');
end;
$$;

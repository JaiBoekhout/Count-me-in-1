-- Admins give members Pro (for example as a thank-you or for testing), see
-- who has Pro and why, and can end a Pro period. Safe to run more than once.

-- Allow reason 'gift' (admin) next to 'referral' (invite challenge).
alter table public.premium_grants drop constraint if exists premium_grants_reason_check;
alter table public.premium_grants add constraint premium_grants_reason_check
  check (reason in ('referral', 'gift', 'paid'));

alter table public.premium_grants
  add column if not exists granted_by uuid references public.profiles(id) on delete set null,
  add column if not exists note text not null default '' check (char_length(note) <= 200);

-- Admin gives Pro until a date.
create or replace function public.admin_grant_pro(target_user_id uuid, until_date date, grant_note text default '')
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.has_admin_role() then
    raise exception 'Only admins can give Pro.';
  end if;
  if until_date is null or until_date <= current_date then
    raise exception 'Choose an end date in the future.';
  end if;
  insert into public.premium_grants (user_id, reason, starts_at, ends_at, granted_by, note)
  values (target_user_id, 'gift', now(), (until_date + 1)::timestamptz, auth.uid(), left(coalesce(grant_note, ''), 200));
end;
$$;
revoke all on function public.admin_grant_pro(uuid, date, text) from public, anon;
grant execute on function public.admin_grant_pro(uuid, date, text) to authenticated;

-- Admin ends a Pro period now (any reason).
create or replace function public.admin_end_pro(grant_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.has_admin_role() then
    raise exception 'Only admins can end Pro.';
  end if;
  update public.premium_grants set ends_at = now() where id = grant_id and ends_at > now();
end;
$$;
revoke all on function public.admin_end_pro(uuid) from public, anon;
grant execute on function public.admin_end_pro(uuid) to authenticated;

-- Overview for admins: every Pro period that is active or ended in the last 90 days.
create or replace function public.admin_pro_members()
returns table (
  grant_id uuid, user_id uuid, first_name text, photo_url text,
  reason text, starts_at timestamptz, ends_at timestamptz, note text, active boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.has_admin_role() then
    raise exception 'Only admins can see Pro members.';
  end if;
  return query
  select g.id, g.user_id, p.first_name, p.photo_url, g.reason, g.starts_at, g.ends_at, g.note,
    now() between g.starts_at and g.ends_at
  from public.premium_grants g
  join public.profiles p on p.id = g.user_id
  where g.ends_at > now() - interval '90 days'
  order by (now() between g.starts_at and g.ends_at) desc, g.ends_at desc;
end;
$$;
revoke all on function public.admin_pro_members() from public, anon;
grant execute on function public.admin_pro_members() to authenticated;

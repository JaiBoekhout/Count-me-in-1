-- Invite challenge: get 4 mates to join with your personal invite link and
-- you get 1 year of Pro (Supporter) for free, counted from the day the 4th
-- mate finished signing up. A mate counts once his email is confirmed and his
-- profile is complete. Safe to run more than once.

alter table public.profiles
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_profiles_referred_by on public.profiles(referred_by);

-- Free Pro periods (from this challenge now, maybe other reasons later).
create table if not exists public.premium_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('referral', 'gift')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_premium_grants_one_referral
on public.premium_grants(user_id) where reason = 'referral';

alter table public.premium_grants enable row level security;

drop policy if exists "Members see their own Pro periods" on public.premium_grants;
create policy "Members see their own Pro periods"
on public.premium_grants for select
using (user_id = auth.uid() or public.has_staff_role());

revoke all on public.premium_grants from anon;
grant select on public.premium_grants to authenticated;

-- Number of mates that count for a member.
create or replace function public.referral_count(target_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select count(*)::integer
  from public.profiles mate
  join auth.users account on account.id = mate.id
  where mate.referred_by = target_user_id
    and mate.onboarding_complete
    and account.email_confirmed_at is not null;
$$;
revoke all on function public.referral_count(uuid) from public, anon, authenticated;

-- Gives the year of Pro once the 4th mate counts.
create or replace function public.check_referral_reward(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if target_user_id is null then return; end if;
  if public.referral_count(target_user_id) >= 4 then
    insert into public.premium_grants (user_id, reason, starts_at, ends_at)
    values (target_user_id, 'referral', now(), now() + interval '1 year')
    on conflict do nothing;
  end if;
end;
$$;
revoke all on function public.check_referral_reward(uuid) from public, anon, authenticated;

-- A new member says who invited him (from the link he opened). Only once,
-- only within 14 days of creating the account, never yourself.
create or replace function public.claim_referral(referrer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
  created timestamptz;
begin
  if viewer_id is null or referrer_id is null or referrer_id = viewer_id then
    return false;
  end if;
  if not exists (select 1 from public.profiles where id = referrer_id) then
    return false;
  end if;
  select created_at into created from auth.users where id = viewer_id;
  if created is null or created < now() - interval '14 days' then
    return false;
  end if;
  update public.profiles
  set referred_by = referrer_id
  where id = viewer_id and referred_by is null;
  if not found then
    return false;
  end if;
  perform public.check_referral_reward(referrer_id);
  return true;
end;
$$;
revoke all on function public.claim_referral(uuid) from public, anon;
grant execute on function public.claim_referral(uuid) to authenticated;

-- Also check when an invited mate finishes onboarding later.
create or replace function public.referral_profile_completed()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.referred_by is not null and new.onboarding_complete
    and (old.onboarding_complete is distinct from true) then
    perform public.check_referral_reward(new.referred_by);
  end if;
  return new;
end;
$$;

drop trigger if exists profile_referral_completed on public.profiles;
create trigger profile_referral_completed
after update of onboarding_complete on public.profiles
for each row
execute function public.referral_profile_completed();

-- Your own progress, for the Invite a mate panel.
create or replace function public.my_referral_progress()
returns table (mates integer, pro_until timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select
    public.referral_count(auth.uid()),
    (select max(ends_at) from public.premium_grants where user_id = auth.uid() and reason = 'referral');
$$;
revoke all on function public.my_referral_progress() from public, anon;
grant execute on function public.my_referral_progress() to authenticated;

-- A Pro period counts as premium (together with admins and moderators).
create or replace function public.has_premium()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.has_staff_role()
    or exists (
      select 1 from public.premium_grants
      where user_id = auth.uid() and now() between starts_at and ends_at
    );
$$;
grant execute on function public.has_premium() to authenticated;

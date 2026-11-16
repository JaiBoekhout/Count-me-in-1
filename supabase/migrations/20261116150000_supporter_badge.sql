-- Which members are Supporters (an active Pro period), so their profile can
-- show the Supporter badge. Admins and moderators are not shown as Supporters.
-- Safe to run more than once.

create or replace function public.supporter_ids(member_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select distinct user_id
  from public.premium_grants
  where user_id = any(member_ids)
    and now() between starts_at and ends_at;
$$;
revoke all on function public.supporter_ids(uuid[]) from public, anon;
grant execute on function public.supporter_ids(uuid[]) to authenticated;

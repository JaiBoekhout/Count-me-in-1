-- Premium (Supporter) switch. Every Supporter feature asks this one function
-- whether the current member has premium. For now only admins and moderators
-- do, so the team can test. Later, paying members are added here too.
-- Safe to run more than once.

create or replace function public.has_premium()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('moderator', 'admin')
  );
$$;

revoke all on function public.has_premium() from public, anon;
grant execute on function public.has_premium() to authenticated;

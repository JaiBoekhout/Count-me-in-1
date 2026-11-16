-- "How did you find us?" in onboarding, for marketing, plus a simple
-- overview for admins (More > Moderation > Insights). Safe to run more than once.

alter table public.profiles
  add column if not exists heard_from text check (heard_from is null or char_length(heard_from) <= 80);

create or replace function public.admin_insights()
returns table (label text, members integer)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.has_admin_role() then
    raise exception 'Only admins can see insights.';
  end if;
  return query
  select 'total'::text, count(*)::integer from public.profiles where onboarding_complete
  union all
  select 'new_7_days', count(*)::integer from public.profiles p join auth.users u on u.id = p.id
    where p.onboarding_complete and u.created_at > now() - interval '7 days'
  union all
  select 'new_30_days', count(*)::integer from public.profiles p join auth.users u on u.id = p.id
    where p.onboarding_complete and u.created_at > now() - interval '30 days'
  union all
  select 'source:' || coalesce(nullif(heard_from, ''), 'Not answered'), count(*)::integer
  from public.profiles where onboarding_complete
  group by coalesce(nullif(heard_from, ''), 'Not answered');
end;
$$;
revoke all on function public.admin_insights() from public, anon;
grant execute on function public.admin_insights() to authenticated;

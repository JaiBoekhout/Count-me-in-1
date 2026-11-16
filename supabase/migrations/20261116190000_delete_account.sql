-- Delete your own account (More > Privacy and safety > Delete my account).
-- Removes the login; profile, sports, activities you host, join requests,
-- chats, PRs, patches, stories and the rest follow through the foreign keys
-- (on delete cascade). Photos are removed by the app before this runs.
-- Safe to run more than once.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'Sign in before deleting your account.';
  end if;
  delete from auth.users where id = viewer_id;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

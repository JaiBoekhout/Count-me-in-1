-- Admins manage sports in the app (More > Moderation > Sports): add a sport
-- with an icon, change its icon, or remove a sport nobody uses yet.
-- Adding was already admin-only; this adds changing and removing.
-- Safe to run more than once.

drop policy if exists "Admins can change sports" on public.sports;
create policy "Admins can change sports"
on public.sports for update
using (public.has_admin_role())
with check (public.has_admin_role());

drop policy if exists "Admins can remove sports" on public.sports;
create policy "Admins can remove sports"
on public.sports for delete
using (public.has_admin_role());

grant insert, update, delete on public.sports to authenticated;

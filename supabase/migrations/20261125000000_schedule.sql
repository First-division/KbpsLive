create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'editor'))
);

create table public.shows (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  day text not null check (length(trim(day)) between 1 and 80),
  time text not null check (length(trim(time)) between 1 and 80),
  icon text not null default 'music' check (icon in ('child', 'microphone', 'star', 'music')),
  active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000)
);

alter table public.profiles enable row level security;
alter table public.shows enable row level security;

-- This function avoids recursive profiles policies; it only answers for the caller.
create function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;
revoke all on function public.current_staff_role() from public;
grant execute on function public.current_staff_role() to anon, authenticated;

revoke all on public.shows, public.profiles from public, anon, authenticated;
grant select on public.shows to anon, authenticated;
grant insert, update, delete on public.shows to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

create policy "Public can read active shows" on public.shows
  for select to anon, authenticated using (active);
create policy "Staff can read all shows" on public.shows
  for select to authenticated using ((select public.current_staff_role()) in ('admin', 'editor'));
create policy "Staff can create shows" on public.shows
  for insert to authenticated with check ((select public.current_staff_role()) in ('admin', 'editor'));
create policy "Staff can update shows" on public.shows
  for update to authenticated
  using ((select public.current_staff_role()) in ('admin', 'editor'))
  with check ((select public.current_staff_role()) in ('admin', 'editor'));
create policy "Admins can delete shows" on public.shows
  for delete to authenticated using ((select public.current_staff_role()) = 'admin');

create policy "Users can read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Admins can read profiles" on public.profiles
  for select to authenticated using ((select public.current_staff_role()) = 'admin');
create policy "Admins can create profiles" on public.profiles
  for insert to authenticated with check ((select public.current_staff_role()) = 'admin');
create policy "Admins can update profiles" on public.profiles
  for update to authenticated
  using ((select public.current_staff_role()) = 'admin')
  with check ((select public.current_staff_role()) = 'admin');
create policy "Admins can delete profiles" on public.profiles
  for delete to authenticated using ((select public.current_staff_role()) = 'admin');

insert into public.shows (id, name, day, time, icon, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'TCH Children', 'Weekdays', '7:00 AM', 'child', 10),
  ('00000000-0000-4000-8000-000000000002', 'Student Broadcasts', 'Mon–Fri', '8:30 AM – 3:30 PM', 'microphone', 20),
  ('00000000-0000-4000-8000-000000000003', 'Senior Live Show', 'Mon–Fri', '12:30 – 1:55 PM', 'star', 30),
  ('00000000-0000-4000-8000-000000000004', 'Rockin'' Blues', 'Friday', '4:00 PM', 'music', 40),
  ('00000000-0000-4000-8000-000000000005', 'Sunday Morning Country Oldies', 'Sunday', '7:00 – 11:00 AM', 'music', 50)
on conflict (id) do nothing;

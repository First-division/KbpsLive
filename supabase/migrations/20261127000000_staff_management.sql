alter table public.profiles add column active boolean not null default true;

create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid()) and active
$$;

-- Role changes go through one serialized operation so administrators cannot
-- accidentally revoke the last administrator, including simultaneous changes.
revoke insert, update, delete on public.profiles from authenticated;
drop policy "Admins can create profiles" on public.profiles;
drop policy "Admins can update profiles" on public.profiles;
drop policy "Admins can delete profiles" on public.profiles;

create function public.list_staff()
returns table (id uuid, email text, role text, active boolean, invited_at timestamptz, email_confirmed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_staff_role() is distinct from 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query
    select p.id, u.email::text, p.role, p.active, u.invited_at, u.email_confirmed_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by u.email, p.id;
end;
$$;

create table public.approved_google_staff (
  email text primary key check (email = lower(trim(email)) and length(email) between 3 and 254),
  role text not null check (role in ('admin', 'editor')),
  active boolean not null default true,
  user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.approved_google_staff enable row level security;
revoke all on public.approved_google_staff from public, anon, authenticated;

create function public.approve_google_staff(staff_email text, staff_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare normalized_email text := lower(trim(staff_email));
begin
  perform pg_catalog.pg_advisory_xact_lock(794515022);
  if public.current_staff_role() is distinct from 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if normalized_email is null or length(normalized_email) > 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or staff_role is null or staff_role not in ('admin', 'editor') then
    raise exception 'Invalid email or role' using errcode = '22023';
  end if;
  if exists (
    select 1 from auth.users u join public.profiles p on p.id = u.id
    where lower(u.email) = normalized_email
  ) then
    raise exception 'This email already belongs to a staff account; manage that account instead' using errcode = '22023';
  end if;
  insert into public.approved_google_staff (email, role) values (normalized_email, staff_role);
end;
$$;

create function public.list_google_approvals()
returns table (email text, role text, active boolean, user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_staff_role() is distinct from 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query select a.email, a.role, a.active, a.user_id from public.approved_google_staff a order by a.email;
end;
$$;

create function public.claim_google_staff()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_row public.approved_google_staff%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(794515022);
  select a.* into match_row
  from public.approved_google_staff a
  join auth.identities i on i.user_id = auth.uid()
    and i.provider = 'google'
    and lower(i.identity_data->>'email') = a.email
    and i.identity_data->>'email_verified' = 'true'
  where a.active and (a.user_id is null or a.user_id = auth.uid())
  order by a.created_at limit 1 for update of a;
  if not found then return; end if;
  -- Existing accounts and their roles must not be changed by an email match.
  if exists (select 1 from public.profiles where id = auth.uid()) and match_row.user_id is null then
    return;
  end if;
  update public.approved_google_staff set user_id = auth.uid() where email = match_row.email;
  insert into public.profiles (id, role, active) values (auth.uid(), match_row.role, true)
  on conflict (id) do update set role = excluded.role, active = true;
end;
$$;

create function public.set_google_approval_access(staff_email text, new_role text, new_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare entry public.approved_google_staff%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(794515022);
  if public.current_staff_role() is distinct from 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if new_role is null or new_role not in ('admin', 'editor') or new_active is null then
    raise exception 'Invalid staff access request' using errcode = '22023';
  end if;
  select * into entry from public.approved_google_staff where email = lower(trim(staff_email)) for update;
  if not found then raise exception 'Approval not found' using errcode = '22023'; end if;
  if entry.user_id = auth.uid() then raise exception 'You cannot change your own access' using errcode = '42501'; end if;
  if entry.user_id is not null then
    perform public.set_staff_access(entry.user_id, new_role, new_active);
  end if;
  update public.approved_google_staff set role = new_role, active = new_active where email = entry.email;
end;
$$;

-- Enable this Auth hook before enabling signup. Google metadata is verified
-- again against auth.identities when an approval is claimed.
create function public.restrict_staff_signup(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if event->'user'->'app_metadata'->>'provider' = 'google'
    and exists (
      select 1 from public.approved_google_staff a
      where a.active and a.email = lower(event->'user'->>'email')
    ) then return '{}'::jsonb; end if;
  return '{"error":{"http_code":403,"message":"This account is not approved for staff access."}}'::jsonb;
end;
$$;
revoke all on function public.restrict_staff_signup(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.restrict_staff_signup(jsonb) to supabase_auth_admin;

create function public.set_staff_access(target_id uuid, new_role text, new_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(794515022);
  if public.current_staff_role() is distinct from 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if target_id is null or new_role is null or new_role not in ('admin', 'editor') or new_active is null then
    raise exception 'Invalid staff access request' using errcode = '22023';
  end if;
  if target_id = auth.uid() then
    raise exception 'You cannot change your own access' using errcode = '42501';
  end if;
  select * into target from public.profiles where id = target_id for update;
  if found and target.active and target.role = 'admin' and (not new_active or new_role <> 'admin')
    and (select count(*) from public.profiles where active and role = 'admin') <= 1 then
    raise exception 'At least one active administrator is required' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = target_id) then
    raise exception 'User does not exist' using errcode = '22023';
  end if;
  insert into public.profiles (id, role, active) values (target_id, new_role, new_active)
  on conflict (id) do update set role = excluded.role, active = excluded.active;
  update public.approved_google_staff set role = new_role, active = new_active where user_id = target_id;
end;
$$;

revoke all on function public.list_staff() from public, anon;
revoke all on function public.set_staff_access(uuid, text, boolean) from public, anon;
grant execute on function public.list_staff() to authenticated;
grant execute on function public.set_staff_access(uuid, text, boolean) to authenticated;
revoke all on function public.approve_google_staff(text, text), public.list_google_approvals(),
  public.claim_google_staff(), public.set_google_approval_access(text, text, boolean) from public, anon;
grant execute on function public.approve_google_staff(text, text), public.list_google_approvals(),
  public.claim_google_staff(), public.set_google_approval_access(text, text, boolean) to authenticated;

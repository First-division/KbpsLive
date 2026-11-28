-- Run only against an isolated test database after both CMS migrations.
-- Fixtures and changes are rolled back; never run against production.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000101', 'admin@example.invalid'),
  ('00000000-0000-4000-8000-000000000102', 'editor@example.invalid'),
  ('00000000-0000-4000-8000-000000000103', 'google@example.invalid'),
  ('00000000-0000-4000-8000-000000000104', 'unverified@example.invalid'),
  ('00000000-0000-4000-8000-000000000105', 'unknown@example.invalid');
insert into auth.identities (id, user_id, provider_id, provider, identity_data) values
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000103', 'google-103', 'google', '{"email":"google@example.invalid","email_verified":true}'),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000104', 'google-104', 'google', '{"email":"unverified@example.invalid","email_verified":false}'),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000105', 'google-105', 'google', '{"email":"unknown@example.invalid","email_verified":true}');
insert into public.profiles (id, role) values
  ('00000000-0000-4000-8000-000000000101', 'admin'),
  ('00000000-0000-4000-8000-000000000102', 'editor');
insert into public.shows (id, name, day, time, active)
values ('00000000-0000-4000-8000-000000000301', 'Hidden test', 'Monday', 'Noon', false);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
set local role authenticated;
select public.approve_google_staff('Google@example.invalid', 'editor');
select public.approve_google_staff('unverified@example.invalid', 'editor');

reset role;
do $$
begin
  if public.restrict_staff_signup('{"user":{"email":"google@example.invalid","app_metadata":{"provider":"google"}}}') <> '{}'::jsonb then
    raise exception 'Approved Google signup was rejected';
  end if;
  if not (public.restrict_staff_signup('{"user":{"email":"unknown@example.invalid","app_metadata":{"provider":"google"}}}') ? 'error')
    or not (public.restrict_staff_signup('{"user":{"email":"google@example.invalid","app_metadata":{"provider":"email"}}}') ? 'error') then
    raise exception 'Signup hook did not reject an unapproved signup';
  end if;
end;
$$;

set local role authenticated;
do $$
begin
  begin
    perform public.set_staff_access('00000000-0000-4000-8000-000000000101', 'editor', false);
    raise exception 'Administrator could change their own access';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.approve_google_staff('editor@example.invalid', 'admin');
    raise exception 'Existing staff account could be approved for a different role';
  exception when invalid_parameter_value then null;
  end;
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000102';
    raise exception 'Direct profile mutation succeeded';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local role anon;
do $$
begin
  if exists (select 1 from public.shows where id = '00000000-0000-4000-8000-000000000301') then
    raise exception 'Anonymous users can read hidden shows';
  end if;
  begin
    perform public.list_google_approvals();
    raise exception 'Anonymous users can list approvals';
  exception when insufficient_privilege then null;
  end;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
do $$
begin
  begin
    perform public.approve_google_staff('other@example.invalid', 'admin');
    raise exception 'Editor could approve staff';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.list_staff();
    raise exception 'Editor could list staff';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_staff_access('00000000-0000-4000-8000-000000000102', 'admin', true);
    raise exception 'Editor could change roles';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000104', true);
select public.claim_google_staff();
do $$ begin
  if public.current_staff_role() is not null then raise exception 'Unverified Google email was granted access'; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000105', true);
select public.claim_google_staff();
do $$ begin
  if public.current_staff_role() is not null then raise exception 'Unapproved Google user was granted access'; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
select public.claim_google_staff();
do $$ begin
  if public.current_staff_role() is distinct from 'editor' then raise exception 'Approved Google user was not granted access'; end if;
  if (select count(*) from public.shows) < 1 then raise exception 'Editor could not read shows'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select public.set_google_approval_access('google@example.invalid', 'editor', false);
reset role;
do $$ begin
  if not (public.restrict_staff_signup('{"user":{"email":"google@example.invalid","app_metadata":{"provider":"google"}}}') ? 'error') then
    raise exception 'Revoked Google signup was allowed';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
select public.claim_google_staff();
do $$ begin
  if public.current_staff_role() is not null then raise exception 'Revoked staff regained access by claiming again'; end if;
  begin
    insert into public.shows (name, day, time) values ('Should fail', 'Monday', 'Noon');
    raise exception 'Revoked staff could edit';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select public.set_google_approval_access('google@example.invalid', 'admin', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
select public.claim_google_staff();
do $$ begin
  if public.current_staff_role() is distinct from 'admin' then raise exception 'Restored role was not applied'; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select public.set_staff_access('00000000-0000-4000-8000-000000000103', 'editor', false);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
select public.claim_google_staff();
do $$ begin
  if public.current_staff_role() is not null then raise exception 'Direct staff revocation was bypassed'; end if;
end $$;

rollback;

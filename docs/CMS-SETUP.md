# Schedule CMS setup

The schedule is the first slice of the [CMS plan](CMS-PLAN.md). These instructions cover setup and hand-off; verify the status of each deployment separately. Do not put credentials, service-role keys, or database passwords in git, the app, or the admin site.

## What is included

- `supabase/migrations/20261125000000_schedule.sql` creates `shows` and `profiles`, enables row-level security (RLS), and seeds the existing schedule. The day and time fields are display labels, so the existing ranges and weekdays are preserved. Dates, time-zone calculations, and automatic show switching are not implemented.
- `admin/` is a separate website for invited staff. Editors and admins can add/edit shows, change display order, and show/hide them; only admins can delete. Hiding every show intentionally produces an empty schedule.
- The admin's Light and Dark buttons are available before and after sign-in. The choice is saved in that browser; initially it follows the device's color preference.
- The app fetches only visible shows when Explore gains focus and every 60 seconds while it is focused. It stores the last valid response on the device and falls back to the bundled schedule if no cache exists. An empty response is a valid schedule. A configured app displays a notice when a refresh fails.

The schedule is public information. Avoid personal or sensitive information in show labels. Student names, photos, and recordings require the school's privacy rules and approval before any future content features are enabled.

## 1. Create and secure the backend

1. A station-owned account creates a Supabase project; enable MFA for project owners. Keep the project region and data policies consistent with school requirements.
2. In Authentication, enable email/password and **disable public sign-ups**. Configure the site URL and redirect allow list to the exact HTTPS admin URL. Review Supabase's email templates and delivery limits. Invites and password recovery links must redirect to this admin site.
3. Apply the migration once using the Supabase SQL editor or migration tooling. It creates new tables; inspect any existing schema first. The five seeded rows mirror the bundled schedule; review them with station staff before making them public.
4. Invite the first trusted administrator through Supabase Authentication. After their auth user exists, find their UUID in the Authentication dashboard, then run this in the trusted SQL editor, replacing the placeholder with that UUID:

   ```sql
   insert into public.profiles (id, role)
   values ('REPLACE-WITH-AUTH-USER-UUID', 'admin')
   on conflict (id) do update set role = excluded.role;
   ```

   Before staff management is deployed, use the same procedure with `editor` for additional test users. Do not grant editors Supabase project/dashboard access: project access can bypass application RLS. Keep at least one trusted admin.
5. Before real content or staff accounts are used, verify the policies against the deployed project: anonymous users can read only active shows and cannot write; a signed-in user without a profile cannot write; editors can read hidden shows and create/update but cannot delete shows or change profiles; admins can manage shows and profiles. Check that public signup is disabled. Test using actual separate accounts and public API credentials, **not** the SQL editor or service-role key, which bypass RLS.

## 2. Configure and deploy the staff website

1. From `admin/`, run `npm ci`; copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project's URL and public anon/publishable key. These are embedded in the site and are not secrets. Never use a secret/service-role key.
2. Run `npm run dev` for local work, or `npm run build` to generate `admin/dist`. For hosting, set `admin` as the project root, `npm run build` as the build command, and `dist` as the output directory. Set the same two public environment variables in the hosting provider and use HTTPS.
3. Set the deployed URL in the Supabase Auth URL/redirect settings. Have an invited staff member follow the invitation link to the admin site, set a password, and sign in. The website has a password form for invite/recovery links; recovery emails are currently initiated from Supabase, not from the website.
4. Test add, edit, hide, order, and (as admin) delete with disposable shows. Lower order numbers appear first; ties are ordered by ID. Editors can make schedule changes visible immediately; there is no approval queue.

The website's System theme follows the device's light or dark appearance, including changes while the page is open. Light and Dark override the device setting; the selected preference is saved in the browser. Existing saved Light or Dark choices remain in effect until changed.

## 3. Connect the mobile app

1. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the same project URL and public key; `.env.example` lists the names. Expo embeds these values at build/update time. A local `.env.local` is ignored by git.
2. Create and distribute a new app build or compatible update using the project's normal release process. Existing TestFlight builds will not acquire this feature merely because the backend is configured.
3. In the new build, open Explore, make a change in the admin, and reopen Explore or wait up to a minute while it is open. Test offline after at least one successful fetch, and test a fresh install offline. If the project is not configured, the existing bundled schedule remains in use.

## Google staff access

The proposed flow needs no sending domain or invitation email. An administrator approves an exact Google account email and role, then shares the website link separately. The staff member signs in with Google. The database checks the Google identity's verified email before assigning a role. An existing password administrator remains able to sign in. Supabase may link login methods for the same email, so a linked password or other provider can also access the same staff account: protect those login methods and use MFA. Approval is not proof of employment or school authorization; an admin must verify the address independently.

In the existing KbpsLive project, the staff migration, Google provider, signup hook and admin redirect were configured for testing. Real unapproved Google and password signups were rejected. A Google test user approved as an editor signed in on a local test site. After restoration, the editor could create and update a hidden disposable show but could not delete it or list staff; anonymous users could not read it. After revocation, the existing session could not insert or update a show, claiming access again did not restore its role, and a fresh Google sign-in still had no staff role. The disposable show was removed, and the test account remains revoked. An admin could not change their own access.

These checks do not prove all role, identity-linking, last-admin, and concurrency cases. New sign-ups were disabled after testing; the Google provider and signup hook remained enabled, and the temporary local redirect was removed. Both `VITE_ENABLE_STAFF_MANAGEMENT` and `VITE_ENABLE_GOOGLE_SIGN_IN` default to false; verify the deployed build and Auth settings before onboarding. An older local `supabase/functions/invite-staff` prototype is not part of this Google flow and must not be deployed. A Google client secret appeared in a previous tool output; rotation is recommended before production use.

### Onboarding and offboarding in Google Testing mode

1. Google Testing mode requires each staff member to be added to the OAuth app's test-user list separately from station approval. Check Google's current test-user and verification limits before onboarding.
2. Verify the person's exact Google email and station authorization. An admin approves that address and an `editor` or `admin` role in Staff management, then shares the website link; no invitation email is sent. Give admin access only to trusted staff.
3. New users can create an account only while Supabase sign-ups are enabled and the Before User Created hook is active. The person signs in with the approved Google account. An editor can add and edit shows, including making them visible; only admins can delete shows or manage staff.
4. When a staff member leaves, an admin revokes access in Staff management. This denies subsequent staff operations without deleting their login or schedule content. Remove any separate Google test-user, Supabase dashboard, or other service access as appropriate. Restore access only after verifying the person and role again.
5. Keep an existing trusted password admin account and verify access before changing Auth settings. Sign-in methods linked to the same Supabase user share that user's staff role. The hook restricts new accounts only; it is not a substitute for RLS.

### Test-project setup

1. Retain a working password-admin account and backup. Apply the schedule migration and then `supabase/migrations/20261127000000_staff_management.sql` in a separate test project. The latter preserves existing profiles as active and restricts profile changes to admin-only database functions. Do not reapply the schedule migration to an existing project.
2. Set up a Google Cloud project, OAuth consent screen and web OAuth client following [Supabase's Google sign-in guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google). Add the test project's Supabase callback URL to the Google client, and configure its client ID and secret in the Supabase Google provider. Keep the secret out of the website, git and chat. If Google's consent screen is in testing mode, add each test account as a Google test user; review Google verification/publishing requirements before real onboarding.
3. Configure the Supabase Auth site URL and exact allowed redirect URLs for the test admin site. In Auth Hooks, select the Postgres **Before User Created** hook `public.restrict_staff_signup`. This hook limits creation to active approved Google emails; it does not run on sign-in or identity linking, so the role and RLS checks remain essential. Verify the hook is enabled and fails closed before changing sign-up settings.
4. With the hook active, enable new user sign-ups **in the test project only**: Supabase's global signup switch otherwise prevents new Google accounts. This setting affects all Auth providers in the project; the hook must deny unapproved Google and password registrations. Verify existing password sign-in still works. See [Supabase's hook documentation](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook) and [identity-linking documentation](https://supabase.com/docs/guides/auth/auth-identity-linking).
5. Build the test website with both feature flags set to `true`. Sign in as the existing administrator; approve an owner-controlled Google account as an editor. Independently share the test URL and complete the OAuth flow. Confirm the new profile is assigned only when the server-side Google identity contains the matching verified email; inspect the real identity data and hook event if the login fails. Do not weaken the verified-email check to make it work.
6. With separate real accounts and the public API key, test unapproved Google signups, password signup, users without a profile, existing password staff, identity linking, anonymous/editor access to management functions, role changes, revocation with an existing session and after re-sign-in, restoration, self-change, last-admin protection and concurrent changes. Check anonymous access to hidden shows and all show writes/deletes under each role. SQL editor and service-role access bypass RLS and cannot substitute for real client tests. Do not use real staff or schedules for testing.
7. After all tests pass, plan a live rollout: back up, apply any missing migration, configure the provider and hook while signups remain disabled, verify the hook, then enable signups and publish a build with both flags. Do not reapply a migration already installed in the target project or enable either flag separately. Verify the existing administrator before inviting anyone.

The signup hook applies only to new users. Authorization is enforced by profiles and RLS independently of the hook; sign-in alone never grants a role. An approval for an existing profile is rejected rather than silently changing its role. Manage existing staff in the staff-account list; linked sign-in methods share their existing role. Revocation immediately denies subsequent CMS database operations, but does not delete the login or content or revoke access to other services. An administrator may restore access. Project owners and service-role users bypass these protections.

`supabase/tests/staff_management.sql` contains transactional database checks for a disposable database. They test parts of the SQL logic and RLS using simulated identities; they do not prove Google OAuth, the actual Supabase Auth schema or concurrency work in the hosted service.

### Rollback

If tests or rollout fail, disable new sign-ups first, disable the Google provider, and redeploy the site with both feature flags false. Existing password staff and the original schedule remain available; the migration may remain in place. Do not remove the signup hook while signups are enabled. Reverting the database migration requires a reviewed backup and explicit restoration of the previous profile policies; do not casually drop the tables or functions.

## Operations and outstanding work

Export/back up the database regularly, confirm a restore procedure, and designate a school owner for access and billing. News, interviews, announcements, media storage, audit logging, and push notifications are not yet implemented. The plan's privacy decisions, Google configuration, production security verification, account ownership, and staff hand-off require the station.

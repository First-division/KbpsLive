# Schedule CMS setup

This is the first slice of the [CMS plan](CMS-PLAN.md), not a deployed service. A school/station owner must create the accounts and perform the steps below. Do not put credentials, service-role keys, or database passwords in git, the app, or the admin site.

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

   Use the same procedure with `editor` for students after inviting them. Currently, inviting staff and managing roles are **owner operations in Supabase**, not features of the website. Do not grant editors Supabase project/dashboard access: project access can bypass application RLS. Remove a departing user's profile and revoke their auth account/session. Keep at least one trusted admin.
5. Before real content or staff accounts are used, verify the policies against the deployed project: anonymous users can read only active shows and cannot write; a signed-in user without a profile cannot write; editors can read hidden shows and create/update but cannot delete shows or change profiles; admins can manage shows and profiles. Check that public signup is disabled. Test using actual separate accounts and public API credentials, **not** the SQL editor or service-role key, which bypass RLS.

## 2. Configure and deploy the staff website

1. From `admin/`, run `npm ci`; copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project's URL and public anon/publishable key. These are embedded in the site and are not secrets. Never use a secret/service-role key.
2. Run `npm run dev` for local work, or `npm run build` to generate `admin/dist`. For hosting, set `admin` as the project root, `npm run build` as the build command, and `dist` as the output directory. Set the same two public environment variables in the hosting provider and use HTTPS.
3. Set the deployed URL in the Supabase Auth URL/redirect settings. Have an invited staff member follow the invitation link to the admin site, set a password, and sign in. The website has a password form for invite/recovery links; recovery emails are currently initiated from Supabase, not from the website.
4. Test add, edit, hide, order, and (as admin) delete with disposable shows. Lower order numbers appear first; ties are ordered by ID. Editors can make schedule changes visible immediately; there is no approval queue.

## 3. Connect the mobile app

1. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the same project URL and public key; `.env.example` lists the names. Expo embeds these values at build/update time. A local `.env.local` is ignored by git.
2. Create and distribute a new app build or compatible update using the project's normal release process. Existing TestFlight builds will not acquire this feature merely because the backend is configured.
3. In the new build, open Explore, make a change in the admin, and reopen Explore or wait up to a minute while it is open. Test offline after at least one successful fetch, and test a fresh install offline. If the project is not configured, the existing bundled schedule remains in use.

## Operations and outstanding work

Export/back up the database regularly, confirm a restore procedure, and designate a school owner for access and billing. The admin does not yet include invitations, role management, news, interviews, announcements, media storage, audit logging, or push notifications. The plan's privacy decisions, deployment, RLS verification, account ownership, and staff hand-off require the station.

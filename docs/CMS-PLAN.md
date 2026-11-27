# KbpsLive CMS & Admin Plan

A step-by-step plan for letting station staff (teacher, student managers) edit the schedule, news, interviews, and announcements without shipping an app update.

## Where things are today

- Schedule is hard-coded in `constants/Station.ts` (`Station.schedule`).
- News and Interviews are just links to `benson.pps.net` pages (`Station.links.news`, `Station.links.interviews`), opened from `app/(tabs)/explore.tsx`.
- There is no backend. Changing anything requires a code change and a new build.

## Goal

Staff log in to a web admin page, edit content, and the app shows it right away.

## Implementation status

The schedule-only foundation is implemented in this repository: a Supabase migration with seeded shows and role-based RLS, an app reader with offline fallback, and a separate staff admin website. See [CMS setup](CMS-SETUP.md) for deployment, security checks, and hand-off. **It is not deployed or connected until a station-owned Supabase project and hosting are configured.** Listeners receive changes on opening the Explore tab and approximately once a minute while it remains focused.

News, interviews, announcements, media uploads, invitation/role management in the admin UI, and draft/publish workflows are not implemented yet. News and interview links remain unchanged. Schedule editors can make shows visible immediately; the draft/publish approval flow below is a later phase.

## Recommended approach: Supabase (hosted, free tier)

Chosen because it gives a database, login, roles, file storage, and an auto-generated API with no server to maintain. Alternatives: Firebase (similar), Sanity (best ready-made editor UI, no auth to build), Directus (self-hosted).

> Quickest path: **Sanity** gives you the admin UI for free; you only write the app-side fetching. Choose Supabase if you want to own the data and custom login roles.

## Recommended stack and plan

| Layer | Choice | Why |
| --- | --- | --- |
| Backend (DB, auth, storage, API) | Supabase (free tier) | No server to maintain; roles and row-level security built in |
| Mobile app | Existing Expo / React Native app + `@supabase/supabase-js` | No rewrite; content loads over the API |
| Admin site | Vite + React + TypeScript (or Next.js), using Supabase Auth | Same language as the app; simple forms for non-technical staff |
| Admin hosting | Vercel or Netlify (free tier) | Auto-deploys from git; HTTPS included |
| Media (images, interview audio) | Supabase Storage | Same login and access rules as the rest of the data |
| Push notifications (later) | `expo-notifications` + Supabase Edge Function | Fits the Expo setup |
| Rich text | Markdown (e.g. `react-markdown`) | Safer than raw HTML, easy for editors |

**Plan in one line:** build in small shippable steps, starting with the schedule only (backend, app reads it, simple admin page), then add news, interviews, and announcements, then roles, drafts, and hand-off.

**Why not the others:**
- **Sanity:** great ready-made editor, but custom roles and drafts are limited on the free tier and the content lives outside your control.
- **Firebase:** workable, but its non-relational data and pricing are harder to reason about for a handoff.
- **Directus / self-hosted:** needs a server someone has to keep updated, which is a bad fit once you graduate the project to a school.

**Fallback:** if you want something working in a weekend with no admin site, use Sanity and skip Phase 3.

## Phase 0: Decide (before coding)

- [ ] Who owns the backend account? Prefer a school/station-owned email, not a personal one.
- [ ] Who are the admins (teacher) and editors (students)?
- [ ] Which content is editable in v1? Suggested: schedule, news, interviews, announcement banner.
- [ ] Student privacy rules for names, photos, and audio of minors.

## Phase 1: Backend setup (Supabase)

1. Create a project at supabase.com.
2. Create tables:
   - `shows`: `id`, `name`, `day`, `time`, `icon`, `active`, `sort_order` (the current schedule has free-form day/time labels, not complete structured start/end times)
   - `news`: `id`, `title`, `body`, `image_url`, `published_at`, `status` (`draft`/`published`)
   - `interviews`: `id`, `title`, `guest`, `summary`, `media_url`, `thumbnail_url`, `published_at`, `status`
   - `announcements`: `id`, `message`, `link_url`, `starts_at`, `ends_at`
   - `profiles`: `id` (matches auth user), `role` (`admin`/`editor`)
3. Turn on **Auth** (email + password; disable public sign-ups so only invited users exist).
4. Turn on **Row Level Security** on every table:
   - Anyone can `SELECT` rows where `status = 'published'` (or `active = true`).
   - Only users with `role` of `admin` or `editor` can `INSERT`/`UPDATE`.
   - Only `admin` can `DELETE` and manage `profiles`.
5. Create a Storage bucket `media` for images (public read, staff-only write).
6. Seed `shows` with the current values from `constants/Station.ts`.

## Phase 2: Connect the app (read-only)

1. Install: `npx expo install @supabase/supabase-js @react-native-async-storage/async-storage`
2. Add `lib/supabase.ts` creating the client with the public anon key (stored in `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`; never ship the service-role key).
3. Add hooks following the existing pattern in `hooks/` (e.g. `useSchedule.ts`, `useNews.ts`, `useInterviews.ts`, `useAnnouncement.ts`).
4. Cache the last successful response in AsyncStorage and fall back to it when offline. Fall back to `Station.schedule` if nothing is cached, so the app never shows an empty screen.
5. Update `app/(tabs)/explore.tsx` to use the hooks; add detail screens for news/interviews instead of external links (keep the link as a fallback).
6. Show the announcement banner on the Live tab.
7. Add tests under `__tests__/` for the hooks (mock the client).

## Phase 3: Admin interface

Pick one:

- **A. Supabase Studio only (fastest):** invite staff to the Supabase dashboard. Works, but it is a database UI and intimidating for students.
- **B. Simple web admin (recommended):** a small Next.js or Vite + React app, hosted free on Vercel or Netlify.
  1. Login page using Supabase Auth.
  2. Pages: Schedule (add/edit/reorder/disable), News, Interviews, Announcement.
  3. Rich text or Markdown editor and image upload to the `media` bucket.
  4. Draft → Publish flow; editors save drafts, admins publish.
  5. Admin-only page to invite users and set roles.
- **C. In-app admin screen:** hidden behind login. More work and App Store review overhead; do this last, if ever.

## Phase 4: Nice-to-haves

- Push notifications (`expo-notifications`) when news or an interview is published or when a live event starts.
- Special events and one-off schedule overrides (date-specific).
- DJ/staff profiles, sponsor/underwriter spots.
- Basic analytics (listeners, popular content).
- Audit log of who changed what.

## Phase 5: Hand-off

- [ ] Move accounts (Supabase, hosting, domain, Apple/Google developer accounts) to school ownership.
- [ ] Write a one-page "how to update the schedule / post news" guide with screenshots.
- [ ] Train the teacher and student editors; create their accounts with the right roles.
- [ ] Document backup/export, and who to contact if something breaks.
- [ ] Agree on maintenance terms (free, yearly fee, or contract).

## Security checklist

- Public sign-ups disabled; admins are invited.
- RLS enabled and tested on every table (try reading/writing as a logged-out user).
- Only the anon key lives in the app; service-role key stays off the client and out of git.
- Enable 2FA on the admin/owner account.
- Sanitize or restrict rich text so editors cannot inject scripts or unsafe links.

## Suggested order of work

1. Backend + `shows` table + seed data
2. App reads schedule from backend (with offline fallback) → ship
3. Minimal web admin for schedule only
4. Add news, interviews, announcements
5. Roles, drafts, hand-off docs
6. Push notifications and extras

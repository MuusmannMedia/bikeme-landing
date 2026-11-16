# Bike Me Landing (Next.js + Tailwind)

Premium, minimal, localized landing page for Bike Me.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase-backed authenticated web app and localized public site
- Vercel-ready setup

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Open:

- `http://localhost:3000` (auto-redirects to a locale)
- Locale routes: `/en`, `/da`, `/de`, `/es`, `/it`, `/fr`, `/nl`

## Build & Run (Production)

```bash
npm run build
npm run start
```

## Verification

Run these checks locally:

```bash
npm install
npm run dev
npm run build
```

## i18n Routing

- Supported locales: `en`, `da`, `de`, `es`, `it`, `fr`, `nl`
- Middleware (`/middleware.ts`) detects browser language from `Accept-Language` and redirects to the best locale route.
- URLs are localized with a locale prefix (`/en`, `/da`, etc.).
- Language switcher is in the header.

## Where To Edit Things

- CTA and footer URLs/placeholders: [`lib/site-config.ts`](lib/site-config.ts)
- All translations and localized copy: [`lib/i18n.ts`](lib/i18n.ts)
- Locale list and language labels: [`lib/locales.ts`](lib/locales.ts)
- Landing page structure/sections: [`app/[locale]/page.tsx`](app/[locale]/page.tsx)

## Screenshots Replacement

- Placeholder screenshot slots are rendered in the Screenshots section.
- Target filenames are shown in each placeholder card as:
  - `/public/screenshots/shot-1.png`
  - `/public/screenshots/shot-2.png`
  - ... up to `/public/screenshots/shot-6.png`
- Folder already exists at `public/screenshots/`.
- To show real images, replace the placeholder card UI in [`app/[locale]/page.tsx`](app/[locale]/page.tsx) with `<Image />` elements or `<img>` tags using the same filenames.

## Deploy To Vercel

1. Push this folder to a Git repository.
2. In Vercel, import the repo as a new project.
3. Framework preset: Next.js (auto-detected).
4. Build command: `npm run build` (default).
5. Output directory: leave default (`.next`).
6. Deploy.

## Custom Domains

### Canonical domain

- Canonical domain should be `bikeme.one`.
- This is already reflected in metadata configuration (`CANONICAL_DOMAIN`) in [`lib/site-config.ts`](lib/site-config.ts).

### Redirect domain

- `bikeme.online` should 301 redirect to `https://bikeme.one`.
- Host-based permanent redirect is configured in [`vercel.json`](vercel.json).

### Suggested Vercel domain setup

1. Add `bikeme.one` to the Vercel project and mark it as **Primary**.
2. Add `bikeme.online` to the same project.
3. Ensure DNS for both domains points to Vercel.
4. Keep the `vercel.json` redirect in place so all `bikeme.online/*` traffic permanently redirects to `bikeme.one/*`.

## Placeholder Values Needed From You

Please provide these production values so placeholders can be replaced:

1. TestFlight URL (currently `https://testflight.apple.com/join/gYrqA8P1`)
2. Privacy policy URL (currently `https://bikeme.one/privacy`)
3. Terms URL (currently `https://bikeme.one/terms`)
4. Contact email (currently `hello@bikeme.one`)
5. Real app screenshots (currently `public/screenshots/app-01.PNG` through `app-06.PNG`)

## Notes

- Shared additive database contracts are in `backend/supabase/migrations/`; see `backend/README.md`. The archived iOS baseline is not a replay queue.
- No newsletter integration is included.
- The page uses lightweight CSS animations only (no Framer Motion dependency).

## Release boundaries

The visitor profile, visitor ride previews and membership applications are currently restricted to the exact test backend `bcskqapoagflshewvzzc` and blocked when `VERCEL_ENV=production`. Private club profile/image editing has the same restrictions and additionally requires `BIKE_ME_CLUB_PROFILE_EDIT_ENABLED=true`. Club ride push remains opt-in through the server-only `BIKE_ME_CLUB_RIDE_PUSH_ENABLED` variable and should remain unset/false for this candidate.

These guards are intentional. Publishing this commit does not enable those functions in production. Existing private clubs, membership management, rides, posts, chat and direct messages use their existing backend contracts, which must be checked against the target schema before release. Never point a production build at the test backend.

Local role stations, fixture journals and acceptance screenshots live under ignored `review/` or private temporary directories and are not deployment inputs. `.vercelignore` also excludes backend tooling and tests. Production needs only the existing public Supabase URL/publishable key and the normal authenticated user session; no service-role key belongs in the web deployment.

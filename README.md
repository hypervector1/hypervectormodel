# HypeVector V16.5 — Production Web App

This build turns the HypeVector dashboard into a live Next.js application backed by Supabase.

## What is functional

- Live `public.trends` ingestion through `/api/trends`
- V16.5 continuous momentum/evidence scoring
- BREAKOUT / RISING / EARLY / COOLING / FADING lifecycle states
- UNVERIFIED discovery state for trends without corroborating breakout evidence
- Search across names, categories, sources and model reasons
- Automatic refresh every 60 seconds
- Manual refresh
- Signal counts and evidence coverage
- Detail panels with velocity, acceleration, spread, adoption, events and publishers
- Local browser watchlist
- Alerts view for newly observed signals and breakouts
- Reports view with model coverage, average confidence and watchlist size
- Responsive desktop/mobile layout

## Supabase

Create `.env.local` locally or add the same variables in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

The service-role key is used only by the server route and must NEVER be prefixed with `NEXT_PUBLIC_` or committed to GitHub.

The app reads these columns from `public.trends`:

`id,name,category,source,score,velocity,acceleration,spread,adoption,longevity,status,first_seen,last_seen,metadata`

The model reads `metadata.breakout_prediction` when available.

## Local run

```bash
npm install
npm run dev
```

Then open http://localhost:3000

Production check:

```bash
npm run build
npm start
```

## Vercel

1. Push the project to GitHub.
2. Import the repository into Vercel as a Next.js project.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` under Project Settings → Environment Variables.
4. Deploy.
5. Add your custom domain under Project Settings → Domains.

## Important model note

The database currently contains more trends than trends with full breakout evidence. V16.5 intentionally does not label missing-evidence rows as FADING. Those rows appear under Discovery / UNVERIFIED until the evidence pipeline supplies corroboration.

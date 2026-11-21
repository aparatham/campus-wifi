# Campus Wifi

Live Wi-Fi signal strength (RSSI) and speed map for TKM College of Engineering, Kollam.

- **Everyone:** browse buildings and floors, switch between the *Signal (RSSI)* and *Speed (Mbps)* heatmaps, average them over 2–10 days, locate yourself on the map, and run a real speed test that updates the campus average.
- **Developers:** sign in, then use *Survey walk* to record real RSSI (Android app, or a value typed from the phone's Wi-Fi settings) plus an optional speed test at each spot.

## Stack

TanStack Start (React) · Tailwind · Supabase (database, auth, realtime) · Nitro Node server.

## Run locally

```sh
npm install
npm run dev
```

Environment variables (see `.env`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.

## Deploy on Render

`render.yaml` defines the web service (`npm ci && npm run build`, start `node .output/server/index.mjs`). Set the Supabase variables above in Render.

## Android app

See `android-app/README.md`.

## Database

Schema lives in `drizzle/migrations/`. Developer accounts are assigned by the email list in the migration's `assign_listed_developer()` function.

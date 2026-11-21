<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->


## Campus Wifi notes

- Only real measurements reach the database: RSSI from the Android `WifiScan` plugin (or typed from the phone's Wi-Fi settings, never simulated) and speed from `src/lib/speedtest.ts` (real transfers to Cloudflare). Browsers cannot read RSSI, so user speed tests update the speed layer only.
- Heatmaps average readings over a 2-10 day (or all-time) window in `src/lib/averaging.ts` (~3 m cells) before interpolating in `src/lib/survey.ts`. Reads are paginated because the API returns at most 1000 rows per request; new data arrives through Realtime subscriptions.
- Browser-only APIs (canvas, device sensors, geolocation) must stay inside effects or event handlers because routes are server-rendered.
- Deployed on Render with the Nitro `node-server` preset (`vite.config.ts`); the Android app in `android-app/` loads the deployed URL.

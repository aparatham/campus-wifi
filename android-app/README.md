# Campus Wifi – Android app

Wraps the deployed Campus Wifi website (Render) in an Android app and adds the native Wi-Fi scanner
that gives the survey walk real RSSI.

1. Deploy the web app on Render and put its https URL in `capacitor.config.json` → `server.url`.
2. `npm install`
3. `npx cap add android`
4. `npm run setup`   (installs the WifiScan plugin and permissions)
5. `npx cap sync android`
6. `npx cap open android`, wait for Gradle, then Build → Build APK(s) (or Run with a phone connected).

On the phone: turn Location ON, accept the permission prompts, and in Developer options turn OFF
"Wi-Fi scan throttling". Sign in with email + password inside the app.

The app ID is `edu.tkm.campuswifi`; keep it unchanged or update the Java package folder in `setup.mjs` to match.

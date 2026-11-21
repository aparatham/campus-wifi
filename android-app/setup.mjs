// Run after `npx cap add android`: installs the Wi-Fi plugin and the permissions it needs.
import fs from "node:fs";

const dir = "android/app/src/main/java/edu/tkm/campuswifi";
const manifest = "android/app/src/main/AndroidManifest.xml";
if (!fs.existsSync(dir)) {
  console.error("Android project not found. Run `npx cap add android` first (appId must stay edu.tkm.campuswifi).");
  process.exit(1);
}
for (const f of fs.readdirSync("plugin")) fs.copyFileSync(`plugin/${f}`, `${dir}/${f}`);

const perms = [
  ["android.permission.ACCESS_WIFI_STATE", ""],
  ["android.permission.CHANGE_WIFI_STATE", ""],
  ["android.permission.ACCESS_FINE_LOCATION", ""],
  ["android.permission.ACCESS_COARSE_LOCATION", ""],
  ["android.permission.NEARBY_WIFI_DEVICES", ' android:usesPermissionFlags="neverForLocation"'],
];
let xml = fs.readFileSync(manifest, "utf8");
const add = perms
  .filter(([n]) => !xml.includes(`"${n}"`))
  .map(([n, extra]) => `    <uses-permission android:name="${n}"${extra} />`)
  .join("\n");
if (add) xml = xml.replace("<application", `${add}\n    <application`);
fs.writeFileSync(manifest, xml);
console.log("Wi-Fi plugin and permissions installed. Now run: npx cap sync android");

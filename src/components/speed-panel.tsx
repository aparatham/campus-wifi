import { ArrowDown, ArrowUp, Gauge, MapPin, Navigation, Radio } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { WINDOW_OPTIONS } from "@/lib/averaging";
import type { HeatKind } from "@/lib/survey";
import type { SpeedResult, SpeedTest } from "@/lib/speedtest";
import type { GpsState } from "@/lib/use-gps";
import type { MapPoint } from "@/lib/wifi-map-data";

export type PanelStats = {
  readings: number;
  locations: number;
  days: number;
  avgRssi: number | null;
  tests: number;
  avgDown: number | null;
  avgUp: number | null;
  avgPing: number | null;
};

type Props = {
  layer: HeatKind;
  onLayer: (layer: HeatKind) => void;
  windowDays: number | null;
  onWindow: (days: number | null) => void;
  stats: PanelStats;
  speed: SpeedTest;
  gps: GpsState;
  spot: MapPoint | null;
  picking: boolean;
  onPick: () => void;
  onUseGps: () => void;
  areaLabel: string;
  onSave: (result: SpeedResult, point: MapPoint) => Promise<boolean>;
};

const fmt = (v: number | null, unit: string) =>
  v === null ? "—" : `${v.toFixed(v >= 100 ? 0 : 1)} ${unit}`;
const COOLDOWN_MS = 30_000;

export function SpeedPanel({
  layer,
  onLayer,
  windowDays,
  onWindow,
  stats,
  speed,
  gps,
  spot,
  picking,
  onPick,
  onUseGps,
  areaLabel,
  onSave,
}: Props) {
  const [saved, setSaved] = useState(false);
  const [lastSave, setLastSave] = useState(0);
  const [note, setNote] = useState("");

  async function runTest() {
    setSaved(false);
    setNote("");
    await speed.run();
  }
  async function save() {
    if (!speed.result || !spot) return;
    if (Date.now() - lastSave < COOLDOWN_MS)
      return setNote("Please wait a few seconds between saves.");
    const ok = await onSave(speed.result, spot);
    setSaved(ok);
    if (ok) setLastSave(Date.now());
    setNote(
      ok ? "Added to the campus average for this area." : "Could not save. Please try again.",
    );
  }

  return (
    <section
      className="wifi-panel-block space-y-3 border-t border-border pt-3"
      aria-label="Network view and speed test"
    >
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant={layer === "rssi" ? "default" : "outline"}
          onClick={() => onLayer("rssi")}
        >
          <Radio /> Signal (RSSI)
        </Button>
        <Button
          size="sm"
          variant={layer === "speed" ? "default" : "outline"}
          onClick={() => onLayer("speed")}
        >
          <Gauge /> Speed (Mbps)
        </Button>
      </div>
      <label className="flex items-center justify-between gap-2 text-xs font-semibold">
        Average of the last
        <select
          className="h-8 border border-input bg-background px-2 text-xs"
          value={windowDays ?? "all"}
          onChange={(e) => onWindow(e.target.value === "all" ? null : Number(e.target.value))}
        >
          {WINDOW_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
          <option value="all">All time</option>
        </select>
      </label>
      <p className="text-[11px] text-muted-foreground" aria-live="polite">
        {layer === "rssi"
          ? `${stats.readings} readings · ${stats.locations} locations · ${stats.days} day${stats.days === 1 ? "" : "s"} of data · avg ${stats.avgRssi ?? "—"} dBm`
          : `${stats.tests} speed tests · avg ↓ ${fmt(stats.avgDown, "Mbps")} ↑ ${fmt(stats.avgUp, "Mbps")} · ping ${fmt(stats.avgPing, "ms")}`}
      </p>
      {layer === "speed" && (
        <p className="text-[11px] text-muted-foreground">
          Heatmap colours: ≥50 · 25–50 · 10–25 · 3–10 · &lt;3 Mbps download.
        </p>
      )}

      <div className="space-y-2 border border-border p-3">
        <div className="text-xs font-semibold">Test my Wi-Fi speed</div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={!picking && spot && gps.active ? "default" : "outline"}
            onClick={onUseGps}
          >
            <Navigation /> {gps.active ? "Using my location" : "Find my location"}
          </Button>
          <Button size="sm" variant={picking ? "default" : "outline"} onClick={onPick}>
            <MapPin /> {picking ? "Tap the map…" : "Place me on map"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {spot
            ? `Location set · saving to ${areaLabel}`
            : "Set your location so the result can update the campus average."}
        </p>
        {speed.running ? (
          <Button className="w-full" variant="outline" onClick={speed.cancel}>
            {speed.phase === "latency"
              ? "Measuring latency…"
              : speed.phase === "download"
                ? "Testing download"
                : "Testing upload"}
            {speed.live !== null && ` · ${speed.live.toFixed(1)} Mbps`} (cancel)
          </Button>
        ) : (
          <Button className="w-full" onClick={() => void runTest()}>
            <Gauge /> Run speed test
          </Button>
        )}
        {speed.result && (
          <div className="grid grid-cols-3 gap-2 text-center text-xs" aria-live="polite">
            <div>
              <ArrowDown size={12} className="mx-auto" />
              <b>{speed.result.download_mbps}</b>
              <div className="text-muted-foreground">Mbps down</div>
            </div>
            <div>
              <ArrowUp size={12} className="mx-auto" />
              <b>{speed.result.upload_mbps ?? "—"}</b>
              <div className="text-muted-foreground">Mbps up</div>
            </div>
            <div>
              <Gauge size={12} className="mx-auto" />
              <b>{speed.result.latency_ms}</b>
              <div className="text-muted-foreground">ms ping</div>
            </div>
          </div>
        )}
        {speed.result && (
          <Button
            className="w-full"
            variant="outline"
            disabled={!spot || saved}
            onClick={() => void save()}
          >
            {saved ? "Saved ✓" : spot ? "Add to campus average" : "Set your location to save"}
          </Button>
        )}
        {(speed.error || note) && (
          <p className="wifi-status" role="alert">
            {speed.error || note}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground">
          Real transfer to Cloudflare over this device&apos;s current connection. Browsers cannot
          read signal strength (RSSI), so user tests update speed only.
        </p>
      </div>
    </section>
  );
}

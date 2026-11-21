import { useCallback, useRef, useState } from "react";

import { ALL_CAMPUS_AREAS } from "@/lib/wifi-map-data";

/**
 * Real throughput test against Cloudflare's public speed endpoints (CORS-enabled, no API key).
 * Every number comes from bytes actually moved over the visitor's current connection.
 */
const BASE = "https://speed.cloudflare.com";

export type SpeedResult = {
  download_mbps: number;
  upload_mbps: number | null;
  latency_ms: number;
  jitter_ms: number;
};
export type SpeedPhase = "idle" | "latency" | "download" | "upload";

const bust = () => `r=${Date.now()}${Math.random().toString(36).slice(2)}`;
const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};
const round1 = (v: number) => Math.round(v * 10) / 10;

export async function measureLatency(signal: AbortSignal, samples = 8) {
  const times: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}/__down?bytes=0&${bust()}`, { cache: "no-store", signal });
    await res.arrayBuffer();
    if (i > 0) times.push(performance.now() - t0); // first request pays DNS + TLS, so drop it
  }
  const jitter =
    times.slice(1).reduce((s, v, i) => s + Math.abs(v - (times[i] ?? v)), 0) /
    Math.max(1, times.length - 1);
  return { latency_ms: round1(median(times)), jitter_ms: round1(jitter) };
}

export async function measureDownload(
  signal: AbortSignal,
  onMbps: (m: number) => void,
  budgetMs = 9000,
) {
  const started = performance.now();
  const runs: number[] = [];
  let last = 0;
  for (const bytes of [1e6, 5e6, 1.5e7, 4e7]) {
    if (performance.now() - started > budgetMs) break;
    const res = await fetch(`${BASE}/__down?bytes=${bytes}&${bust()}`, {
      cache: "no-store",
      signal,
    });
    if (!res.ok || !res.body) throw new Error("The speed-test server could not be reached.");
    const reader = res.body.getReader();
    const t0 = performance.now();
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.byteLength;
      const el = (performance.now() - t0) / 1000;
      if (el > 0.2) onMbps((got * 8) / el / 1e6);
    }
    const el = (performance.now() - t0) / 1000;
    last = (got * 8) / el / 1e6;
    if (el >= 0.25) runs.push(last);
    if (el > 1.5) break; // transfer was long enough to saturate the link
  }
  return round1(runs.length ? median(runs.slice(-3)) : last);
}

export async function measureUpload(
  signal: AbortSignal,
  onMbps: (m: number) => void,
  budgetMs = 6000,
) {
  const started = performance.now();
  const runs: number[] = [];
  let last = 0;
  for (const bytes of [5e5, 2e6, 8e6]) {
    if (performance.now() - started > budgetMs) break;
    const body = new Uint8Array(bytes);
    for (let o = 0; o < bytes; o += 65536)
      crypto.getRandomValues(body.subarray(o, Math.min(o + 65536, bytes)));
    const t0 = performance.now();
    const res = await fetch(`${BASE}/__up?${bust()}`, {
      method: "POST",
      body,
      cache: "no-store",
      signal,
    });
    await res.arrayBuffer();
    const el = (performance.now() - t0) / 1000;
    last = (bytes * 8) / el / 1e6;
    onMbps(last);
    if (el >= 0.25) runs.push(last);
    if (el > 1.5) break;
  }
  return round1(runs.length ? median(runs.slice(-2)) : last);
}

export function useSpeedTest() {
  const [phase, setPhase] = useState<SpeedPhase>("idle");
  const [live, setLive] = useState<number | null>(null);
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async (): Promise<SpeedResult | null> => {
    if (abort.current) return null;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("You appear to be offline.");
      return null;
    }
    const ctl = new AbortController();
    abort.current = ctl;
    setError("");
    setResult(null);
    try {
      setPhase("latency");
      const lat = await measureLatency(ctl.signal);
      setPhase("download");
      setLive(null);
      const download_mbps = await measureDownload(ctl.signal, setLive);
      setPhase("upload");
      setLive(null);
      let upload_mbps: number | null = null;
      try {
        upload_mbps = await measureUpload(ctl.signal, setLive);
      } catch (e) {
        if (ctl.signal.aborted) throw e; // upload is optional; keep the download result
      }
      const r = { download_mbps, upload_mbps, ...lat };
      setResult(r);
      return r;
    } catch (e) {
      setError(
        ctl.signal.aborted
          ? "Speed test cancelled."
          : "Speed test failed. Check your connection and try again.",
      );
      return null;
    } finally {
      abort.current = null;
      setPhase("idle");
      setLive(null);
    }
  }, []);

  const cancel = useCallback(() => abort.current?.abort(), []);
  return { phase, live, result, error, running: phase !== "idle", run, cancel };
}
export type SpeedTest = ReturnType<typeof useSpeedTest>;

export type SpeedDraft = SpeedResult & {
  building_id: string;
  floor_name: string;
  x: number;
  y: number;
};
export function isSpeedDraftValid(d: SpeedDraft): boolean {
  const area = ALL_CAMPUS_AREAS.find(({ id }) => id === d.building_id);
  const inRange = (v: number | null, max: number) =>
    v === null || (Number.isFinite(v) && v >= 0 && v <= max);
  return Boolean(
    area &&
    area.floors.includes(d.floor_name) &&
    d.x >= 0 &&
    d.x <= 1000 &&
    d.y >= 0 &&
    d.y <= 900 &&
    inRange(d.download_mbps, 10000) &&
    inRange(d.upload_mbps, 10000) &&
    inRange(d.latency_ms, 60000) &&
    inRange(d.jitter_ms, 60000),
  );
}

export const speedBand = (mbps: number): "strong" | "good" | "fair" | "weak" | "poor" =>
  mbps >= 50 ? "strong" : mbps >= 25 ? "good" : mbps >= 10 ? "fair" : mbps >= 3 ? "weak" : "poor";

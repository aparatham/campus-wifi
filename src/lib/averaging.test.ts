import { describe, expect, it } from "vitest";

import { averageByCell, countDays, withinDays } from "@/lib/averaging";
import { isSpeedDraftValid } from "@/lib/speedtest";

const now = Date.parse("2026-11-21T12:00:00Z");
const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();

describe("multi-day averaging", () => {
  it("keeps only readings inside the chosen window", () => {
    const rows = [{ measured_at: ago(1) }, { measured_at: ago(4) }, { measured_at: ago(9) }];
    expect(withinDays(rows, 2, now)).toHaveLength(1);
    expect(withinDays(rows, 10, now)).toHaveLength(3);
    expect(withinDays(rows, null, now)).toHaveLength(3);
  });

  it("averages repeated readings from different days at the same spot", () => {
    const cells = averageByCell([
      { x: 100, y: 100, value: -60, measured_at: ago(1) },
      { x: 101, y: 101, value: -70, measured_at: ago(3) },
      { x: 400, y: 400, value: -50, measured_at: ago(1) },
    ]);
    expect(cells).toHaveLength(2);
    const merged = cells.find((c) => c.n === 2)!;
    expect(merged.value).toBe(-65);
    expect(merged.days).toBe(2);
    expect(countDays([{ measured_at: ago(1) }, { measured_at: ago(1) }])).toBe(1);
  });

  it("validates speed test drafts", () => {
    const ok = {
      building_id: "open-area",
      floor_name: "Ground / Outdoor",
      x: 10,
      y: 10,
      download_mbps: 40,
      upload_mbps: 12,
      latency_ms: 25,
      jitter_ms: 3,
    };
    expect(isSpeedDraftValid(ok)).toBe(true);
    expect(isSpeedDraftValid({ ...ok, download_mbps: -1 })).toBe(false);
    expect(isSpeedDraftValid({ ...ok, x: 5000 })).toBe(false);
    expect(isSpeedDraftValid({ ...ok, building_id: "nope" })).toBe(false);
  });
});

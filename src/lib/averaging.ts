/** Multi-day averaging: raw readings are binned into ~3 m cells and averaged over a time window. */
export const WINDOW_OPTIONS = [2, 3, 5, 7, 10] as const;
export type Sample = { x: number; y: number; value: number; measured_at: string };
export type Cell = { x: number; y: number; value: number; n: number; days: number };

const DAY_MS = 86_400_000;
const dayKey = (iso: string) => new Date(iso).toDateString();

export function withinDays<T extends { measured_at: string }>(
  rows: T[],
  days: number | null,
  now = Date.now(),
): T[] {
  if (days === null) return rows;
  const since = now - days * DAY_MS;
  return rows.filter((r) => Date.parse(r.measured_at) >= since);
}

export const countDays = (rows: { measured_at: string }[]) =>
  new Set(rows.map((r) => dayKey(r.measured_at))).size;

export function averageByCell(samples: Sample[], cell = 6): Cell[] {
  const groups = new Map<
    string,
    { sx: number; sy: number; sv: number; n: number; days: Set<string> }
  >();
  for (const s of samples) {
    const key = `${Math.floor(s.x / cell)}:${Math.floor(s.y / cell)}`;
    const g = groups.get(key) ?? { sx: 0, sy: 0, sv: 0, n: 0, days: new Set<string>() };
    g.sx += s.x;
    g.sy += s.y;
    g.sv += s.value;
    g.n += 1;
    g.days.add(dayKey(s.measured_at));
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({
    x: g.sx / g.n,
    y: g.sy / g.n,
    value: g.sv / g.n,
    n: g.n,
    days: g.days.size,
  }));
}

export const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

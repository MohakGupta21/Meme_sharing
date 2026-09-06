/** Backend timestamps are naive UTC ("2026-09-02 18:05:19"); normalise to a Date. */
export function parseUtc(ts: string): Date {
  const iso = ts.includes("T") ? ts : ts.replace(" ", "T");
  const hasTz = /[zZ]|[+-]\d\d:?\d\d$/.test(iso);
  return new Date(hasTz ? iso : `${iso}Z`);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

/** "just now", "5m", "3h", "2d", then a short date. */
export function timeAgo(ts: string): string {
  const then = parseUtc(ts).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 45) return "just now";
  for (const [unit, unitSecs] of UNITS) {
    if (secs >= unitSecs) {
      const value = Math.floor(secs / unitSecs);
      if (unit === "minute") return `${value}m`;
      if (unit === "hour") return `${value}h`;
      if (unit === "day" && value < 7) return `${value}d`;
      return parseUtc(ts).toLocaleDateString([], { month: "short", day: "numeric" });
    }
  }
  return "just now";
}

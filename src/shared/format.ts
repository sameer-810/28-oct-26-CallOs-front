/** "+919876543210" → "+91 98765 43210". Other countries are left as stored. */
export function formatPhone(e164: string | null | undefined) {
  if (!e164) return "";
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

/** "just now", "12 min ago", "3 h ago", "yesterday", "4 Oct". */
export function timeAgo(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172_800) return "yesterday";
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function firstName(name: string | undefined) {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** "K7MQ4X" → "K7M Q4X": read aloud in two halves. */
export function spacedCode(code: string) {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/** A call's length: "0:38", "4:12", "1:02:05" — the way a phone's call log shows it. */
export function clock(sec: number) {
  const s = Math.round(sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** Talk time totals: "42s", "18m", "11h 24m". */
export function talkTime(sec: number) {
  const s = Math.round(sec || 0);
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function num(n: number) {
  return (n ?? 0).toLocaleString("en-IN");
}

export function pct(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

/** Change against the previous period: "+12%", "−8%", or null when there's nothing to compare. */
export function delta(now: number, before: number) {
  if (!before) return null;
  const d = Math.round(((now - before) / before) * 100);
  return { text: `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)}%`, up: d > 0, flat: d === 0 };
}

/** Times in the company's zone, not the viewer's. */
export function timeIn(iso: string | Date, tz: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit" });
}

export function dateIn(iso: string | Date, tz: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: tz, day: "numeric", month: "short" });
}

export function dateTimeIn(iso: string | Date, tz: string) {
  return `${dateIn(iso, tz)}, ${timeIn(iso, tz)}`;
}

/** "2026-10-27" → "Tue 27 Oct" */
export function dayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** 13 → "1 pm" */
export function hourLabel(h: number) {
  if (h === 0) return "12 am";
  if (h === 12) return "12 pm";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

/** "2:10" → 130, "130" → 130, "1:02:05" → 3725; anything else → null. */
export function parseClock(s: string): number | null {
  const t = s.trim();
  if (!/^\d+(:[0-5]\d){0,2}$/.test(t)) return null;
  return t.split(":").reduce((acc, p) => acc * 60 + Number(p), 0);
}

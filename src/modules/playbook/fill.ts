/**
 * Fills a script or WhatsApp message for one lead. Pure, so the rules are
 * tested without a phone: an unknown lead name disappears cleanly ("Hi {name},"
 * → "Hi,"), and a date or time the call doesn't have stays as {date} so the
 * rep sees what's left to type before anything is sent.
 */
export const PLACEHOLDERS = ["name", "rep", "company", "date", "time"] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];
export type FillVars = Partial<Record<Placeholder, string | null | undefined>>;

const TOKEN = /\{(name|rep|company|date|time)\}/g;

export function fillTemplate(body: string, vars: FillVars) {
  return (
    body
      // "Hi {name}," with no name → "Hi,"; "Hello {name}!" → "Hello!"
      .replace(/ ?\{name\}/g, (m) => (vars.name?.trim() ? `${m.startsWith(" ") ? " " : ""}${vars.name.trim()}` : ""))
      .replace(TOKEN, (m, key: Placeholder) => vars[key]?.trim() || m)
  );
}

/** Placeholders still in a text, in order of first use. */
export function unfilled(text: string): Placeholder[] {
  return [...new Set([...text.matchAll(TOKEN)].map((m) => m[1] as Placeholder))];
}

/** A body split for display, placeholders marked so they can be highlighted. */
export function segments(body: string): { text: string; placeholder: boolean }[] {
  const out: { text: string; placeholder: boolean }[] = [];
  let last = 0;
  for (const m of body.matchAll(TOKEN)) {
    if (m.index > last) out.push({ text: body.slice(last, m.index), placeholder: false });
    out.push({ text: m[0], placeholder: true });
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last), placeholder: false });
  return out;
}

/** wa.me wants the number as digits with the country code, no "+". */
export function whatsappUrl(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** The follow-up's date and time as a message would say them: "Sat 1 Nov", "11:00 am". */
export function whenVars(at: string | Date | null | undefined, tz: string): Pick<FillVars, "date" | "time"> {
  if (!at) return {};
  const d = new Date(at);
  return {
    date: d.toLocaleDateString("en-IN", { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).replace(",", ""),
    time: d.toLocaleTimeString("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit" }).toLowerCase(),
  };
}

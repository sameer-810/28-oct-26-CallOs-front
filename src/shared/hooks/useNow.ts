import { useEffect, useState } from "react";

/**
 * The current time, as state that ticks every minute. Rendering with
 * `Date.now()` directly would make "overdue" depend on when React happened to
 * re-render; this makes it depend on the clock, once a minute.
 */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

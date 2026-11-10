import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { CallTracker } from "@/modules/call-tracker";
import { useDeviceStore } from "../deviceStore";
import { phoneChecks } from "../phoneChecks";

/**
 * The setup checklist, live: re-read whenever the app comes back from a
 * system settings screen, and every few seconds while `watch` is on (the
 * sheet is open), so a fixed item turns green without a tap.
 */
export function usePhoneHealth(watch = false) {
  const autostartConfirmed = useDeviceStore((s) => s.autostartConfirmed);
  const recordingFolderSeen = useDeviceStore((s) => s.recordingFolderSeen);
  // bumped to re-read the phone; the reading itself is derived below
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const checks = useMemo(() => {
    void tick;
    if (!CallTracker) return null;
    return phoneChecks(CallTracker.getPermissions(), CallTracker.getHealth(), { autostartConfirmed, recordingFolderSeen });
  }, [tick, autostartConfirmed, recordingFolderSeen]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    const t = watch ? setInterval(refresh, 3000) : undefined;
    return () => {
      sub.remove();
      if (t) clearInterval(t);
    };
  }, [refresh, watch]);

  return { checks, refresh };
}

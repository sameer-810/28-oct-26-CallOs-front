import { useEffect } from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { CallTracker } from "@/modules/call-tracker";
import { useAuthStore } from "@shared/store/useAuthStore";
import { useDeviceStore } from "./deviceStore";
import { syncNow } from "./syncEngine";

const EVERY_MS = 3 * 60_000;

/**
 * While the app is open: sync on launch, whenever it comes back to the
 * foreground, and every few minutes. New calls then show up on the phone's
 * own dashboard without a pull-to-refresh.
 */
export function useForegroundSync() {
  const qc = useQueryClient();
  const setupDone = useDeviceStore((s) => s.setupDone);
  const afterCallPopup = useAuthStore((s) => s.company?.afterCallPopup);

  useEffect(() => {
    if (!CallTracker || !setupDone) return;
    const go = () =>
      syncNow().then((r) => {
        if (r.inserted || r.recordings) {
          qc.invalidateQueries({ queryKey: ["calls"] });
          qc.invalidateQueries({ queryKey: ["summary"] });
        }
      });
    void go();
    const sub = AppState.addEventListener("change", (s) => s === "active" && void go());
    const t = setInterval(() => AppState.currentState === "active" && void go(), EVERY_MS);
    return () => {
      sub.remove();
      clearInterval(t);
    };
  }, [setupDone, qc]);

  // the company can switch the after-call prompt off; the phone follows
  useEffect(() => {
    if (CallTracker && afterCallPopup !== undefined) CallTracker.setAfterCallPrompt(afterCallPopup);
  }, [afterCallPopup]);
}

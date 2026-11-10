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
    // the ongoing "Call tracking is on" notification keeps this process — and
    // this loop — alive with the app closed, as callos's background sync does
    const service = CallTracker.startSyncService(null);
    const sub = AppState.addEventListener("change", (s) => s === "active" && void go());
    const t = setInterval(() => (service || AppState.currentState === "active") && void go(), EVERY_MS);
    // a call just ended: Android writes it to the log a few seconds later
    const ended = CallTracker.addListener("onCallEnded", () => {
      setTimeout(() => void go(), 4000);
      setTimeout(() => void go(), 20000);
    });
    return () => {
      sub.remove();
      ended.remove();
      clearInterval(t);
    };
  }, [setupDone, qc]);

  // the company can switch the after-call prompt off; the phone follows
  useEffect(() => {
    if (CallTracker && afterCallPopup !== undefined) CallTracker.setAfterCallPrompt(afterCallPopup);
  }, [afterCallPopup]);
}

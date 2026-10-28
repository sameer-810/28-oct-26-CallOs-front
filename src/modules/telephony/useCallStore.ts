import { create } from "zustand";
import * as phone from "./softphone";
import type { CallState } from "./types";

interface CallStore {
  state: CallState;
  number: string;
  name: string;
  startedAt: number | null;
  muted: boolean;
  incomingFrom: string | null;
  error: string | null;
  call: (number: string, name?: string) => Promise<void>;
  hangUp: () => void;
  toggleMute: () => void;
  digit: (d: string) => void;
  accept: () => void;
  reject: () => void;
  dismiss: () => void;
}

/** The one call in progress, for the call bar and every "Call" button. */
export const useCallStore = create<CallStore>((set, get) => {
  const events: phone.SoftphoneEvents = {
    onState: (s) =>
      set((x) => ({
        state: s,
        startedAt: s === "in-call" ? Date.now() : s === "ended" ? x.startedAt : x.startedAt,
        incomingFrom: s === "in-call" || s === "ended" ? null : x.incomingFrom,
      })),
    onIncoming: (from) => set({ incomingFrom: from, number: from, name: "", error: null }),
    onError: (message) => set({ error: message, state: "ended" }),
  };
  return {
    state: "idle",
    number: "",
    name: "",
    startedAt: null,
    muted: false,
    incomingFrom: null,
    error: null,
    call: async (number, name = "") => {
      if (get().state === "connecting" || get().state === "ringing" || get().state === "in-call") return;
      set({ number, name, error: null, muted: false, startedAt: null, state: "connecting" });
      try {
        await phone.dial(number, events);
      } catch (e) {
        set({ state: "ended", error: e instanceof Error ? e.message : "The call couldn't start" });
      }
    },
    hangUp: () => phone.hangUp(),
    toggleMute: () => {
      const muted = !get().muted;
      phone.setMuted(muted);
      set({ muted });
    },
    digit: (d) => phone.sendDigits(d),
    accept: () => phone.accept(events),
    reject: () => {
      phone.reject();
      set({ incomingFrom: null, state: "idle" });
    },
    dismiss: () => set({ state: "idle", error: null, startedAt: null }),
  };
});

export { phone };

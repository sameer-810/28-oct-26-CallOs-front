export type CallState = "idle" | "connecting" | "ringing" | "in-call" | "ended";

/** What the softphone reports back; each platform's softphone file calls these. */
export interface SoftphoneEvents {
  onState: (s: CallState) => void;
  onIncoming: (from: string) => void;
  onError: (message: string) => void;
}

/** Whether the company can call from the browser, and from which number. */
export interface TelephonyStatus {
  enabled: boolean;
  callerId: string | null;
  inbound: boolean;
}

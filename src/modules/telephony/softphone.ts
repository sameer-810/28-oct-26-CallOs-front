import { Linking, Platform } from "react-native";

/**
 * On a phone, "Call" opens the phone's own dialer: the call goes over the
 * work SIM and the call tracker logs and records it like any other. The
 * browser build swaps this file for softphone.web.ts (Twilio over WebRTC).
 */
import type { SoftphoneEvents } from "./types";

export type { CallState, SoftphoneEvents } from "./types";

export const softphoneKind: "browser" | "dialer" | "none" = Platform.OS === "android" || Platform.OS === "ios" ? "dialer" : "none";

export async function startDevice(_ev: SoftphoneEvents) {}

export async function dial(number: string, ev: SoftphoneEvents) {
  await Linking.openURL(`tel:${number}`);
  ev.onState("idle");
}

export function accept(_ev: SoftphoneEvents) {}
export function reject() {}
export function hangUp() {}
export function setMuted(_muted: boolean) {}
export function sendDigits(_d: string) {}
export function stopDevice() {}

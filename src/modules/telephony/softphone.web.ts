// types only: the SDK itself is loaded as a static script (see voice())
import type { Call, Device } from "@twilio/voice-sdk";
import type { SoftphoneEvents } from "./types";
import { telephonyApi } from "./api/telephonyApi";

/**
 * The browser softphone: Twilio's Voice SDK over WebRTC. One Device per tab,
 * created on first use (so nobody is asked for the microphone until they
 * actually call), its token renewed before it expires.
 *
 * The SDK is not bundled. Bundled by Metro it throws at load time and takes
 * the whole web app down with it, so Twilio's own prebuilt browser file is
 * served from public/vendor (refreshed by `npm run vendor:twilio`, which
 * postinstall runs) and loaded only when a call is made or can be received.
 */
type VoiceGlobal = { Device: typeof Device; Call: typeof Call };
let loading: Promise<VoiceGlobal> | null = null;

function voice(): Promise<VoiceGlobal> {
  const g = globalThis as unknown as { Twilio?: VoiceGlobal };
  if (g.Twilio?.Device) return Promise.resolve(g.Twilio);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/vendor/twilio-voice.min.js";
    s.async = true;
    s.onload = () => (g.Twilio?.Device ? resolve(g.Twilio) : reject(new Error("Calling couldn't start in this browser")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Calling couldn't load. Check your internet and try again."));
    };
    document.head.appendChild(s);
  });
  return loading;
}
let device: Device | null = null;
let current: Call | null = null;
let pendingIncoming: Call | null = null;

const token = telephonyApi.token;

function wire(call: Call, ev: SoftphoneEvents) {
  current = call;
  call.on("ringing", () => ev.onState("ringing"));
  call.on("accept", () => ev.onState("in-call"));
  call.on("disconnect", () => {
    current = null;
    ev.onState("ended");
  });
  call.on("cancel", () => {
    current = null;
    ev.onState("ended");
  });
  call.on("reject", () => {
    current = null;
    ev.onState("ended");
  });
  call.on("error", (e: { message?: string }) => ev.onError(e?.message ?? "The call failed"));
}

export const softphoneKind: "browser" | "dialer" | "none" = "browser";

export async function startDevice(ev: SoftphoneEvents) {
  if (device) return;
  const { Device: VoiceDevice, Call: VoiceCall } = await voice();
  device = new VoiceDevice(await token(), {
    codecPreferences: [VoiceCall.Codec.Opus, VoiceCall.Codec.PCMU],
    // warn before the tab closes mid-call
    closeProtection: "A call is in progress. Leave anyway?",
  });
  device.on("tokenWillExpire", async () => device?.updateToken(await token()));
  device.on("error", (e: { message?: string }) => ev.onError(e?.message ?? "Calling isn't available right now"));
  device.on("incoming", (call: Call) => {
    pendingIncoming = call;
    ev.onIncoming(String(call.parameters.From ?? "Unknown number"));
    call.on("cancel", () => {
      pendingIncoming = null;
      ev.onState("ended");
    });
  });
  await device.register();
}

export async function dial(number: string, ev: SoftphoneEvents) {
  await startDevice(ev);
  ev.onState("connecting");
  const call = await device!.connect({ params: { To: number } });
  wire(call, ev);
}

export function accept(ev: SoftphoneEvents) {
  if (!pendingIncoming) return;
  wire(pendingIncoming, ev);
  pendingIncoming.accept();
  pendingIncoming = null;
}

export function reject() {
  pendingIncoming?.reject();
  pendingIncoming = null;
}

export function hangUp() {
  current?.disconnect();
}

export function setMuted(muted: boolean) {
  current?.mute(muted);
}

export function sendDigits(d: string) {
  current?.sendDigits(d);
}

export function stopDevice() {
  current?.disconnect();
  device?.destroy();
  device = null;
}

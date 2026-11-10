import { useEffect, useState } from "react";
import {
  AppState,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import { CallTracker, type CallLogRow, type Sim } from "@/modules/call-tracker";
import { useAuthStore } from "@shared/store/useAuthStore";
import { formatPhone } from "@shared/format";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Card, Icon, Screen, Text, TextField } from "@shared/ui";
import { provedSlots, type WorkSim } from "../syncRules";
import { useDeviceStore } from "../deviceStore";
import { reportDevice, syncNow } from "../syncEngine";
import { registerBackgroundSync } from "../backgroundSync";
import { environment } from "@config/env";

type Step = "permissions" | "sim" | "verify" | "battery" | "done";
/** Read on a tap, never while drawing: the setup time a SIM is stamped with. */
const clockNow = () => Date.now();

const STEPS: Step[] = ["permissions", "sim", "verify", "battery", "done"];
const LABEL: Record<Step, string> = {
  permissions: "Permissions",
  sim: "Work SIMs",
  verify: "Verify",
  battery: "Stay on",
  done: "Done",
};

/**
 * What setup asks for, and why. Built on first use, not at import: PermissionsAndroid
 * doesn't exist on the web, and reading it at load time crashes the web app.
 */
function asks() {
  const P = PermissionsAndroid.PERMISSIONS;
  return [
    {
      key: "callLog",
      perms: [P.READ_CALL_LOG],
      title: "Call log",
      why: "To see which work calls you made and received, and how long they lasted.",
      required: true,
    },
    {
      key: "phoneState",
      perms: [P.READ_PHONE_STATE, P.READ_PHONE_NUMBERS],
      title: "Phone and SIM",
      why: "To tell your work SIM from your personal one, and notice when a call ends.",
      required: true,
    },
    {
      key: "recordings",
      perms: [
        Number(Platform.Version) >= 33
          ? P.READ_MEDIA_AUDIO
          : P.READ_EXTERNAL_STORAGE,
      ],
      title: "Recordings",
      why: "To attach the recording your phone already makes. Your music and voice notes are never read.",
      required: false,
    },
    {
      key: "contacts",
      perms: [P.READ_CONTACTS],
      title: "Contacts",
      why: "To show caller names on your call log.",
      required: false,
    },
    {
      key: "callPhone",
      perms: [P.CALL_PHONE],
      title: "Calls",
      why: "To call back from the log in one tap, and to verify your SIM.",
      required: false,
    },
    ...(Number(Platform.Version) >= 33
      ? [
          {
            key: "notifications",
            perms: [P.POST_NOTIFICATIONS],
            title: "Notifications",
            why: "Follow-up reminders, and asking how a call went right after it ends.",
            required: false,
          },
        ]
      : []),
  ] as const;
}

function Stepper({ step }: { step: Step }) {
  const at = STEPS.indexOf(step);
  return (
    <View
      style={styles.stepper}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${at + 1} of ${STEPS.length}: ${LABEL[step]}`}
    >
      {STEPS.map((s, i) => (
        <View key={s} style={styles.stepItem}>
          <View
            style={[
              styles.stepDot,
              i < at && styles.stepDone,
              i === at && styles.stepNow,
            ]}
          >
            {i < at ? (
              <Icon name="check" size={12} color={palette.paper} />
            ) : (
              <Text
                style={[styles.stepN, i === at && { color: palette.paper }]}
              >
                {i + 1}
              </Text>
            )}
          </View>
          <Text
            style={[styles.stepLabel, i === at && { color: palette.ink }]}
            numberOfLines={1}
          >
            {LABEL[s]}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * First run on an Android phone: allow access, pick the work SIM, confirm the
 * number, keep the app alive, done. Each permission comes with the reason it
 * is needed; nothing optional blocks the way forward.
 */
export default function DeviceSetupScreen() {
  const [ask] = useState(asks);
  const user = useAuthStore((s) => s.user);
  const set = useDeviceStore((s) => s.set);
  const [step, setStep] = useState<Step>("permissions");
  const [granted, setGranted] = useState(() => CallTracker?.getPermissions());
  const [sims, setSims] = useState<Sim[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [numbers, setNumbers] = useState<Record<number, string>>({});
  const work = useDeviceStore((s) => s.sims);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function askPermissions() {
    setError(null);
    const all = asks().flatMap((a) => a.perms);
    await PermissionsAndroid.requestMultiple(all);
    const g = CallTracker?.getPermissions();
    setGranted(g);
    if (!g?.callLog || !g.phoneState) {
      setError(
        "Call log and Phone are needed to track calls. If Android stopped asking, allow them in the app's settings.",
      );
      return;
    }
    const list = CallTracker?.getSims() ?? [];
    setSims(list);
    // the SIM's own number when Android shares it; the account's number for a lone SIM
    setNumbers(
      Object.fromEntries(
        list.map((x) => [x.slot, (x.number ?? (list.length === 1 ? user?.phone : "") ?? "").replace(/\D/g, "").slice(-10)]),
      ),
    );
    if (list.length === 1) setPicked([list[0].slot]);
    setStep("sim");
  }

  const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "").slice(-10);
  const numbersOk = picked.every((slot) => /^[6-9]\d{9}$/.test(digits(numbers[slot])));

  /** Saves the work SIMs. Android vouching for the typed number counts as proof; otherwise a test call does. */
  function chooseSims() {
    const now = clockNow();
    const list: WorkSim[] = picked.map((slot) => {
      const sim = sims.find((x) => x.slot === slot);
      const typed = digits(numbers[slot]);
      return {
        slot,
        carrier: sim?.carrier || sim?.displayName || `SIM ${slot + 1}`,
        number: `+91${typed}`,
        configuredAt: now,
        verifiedAt: sim?.number && digits(sim.number) === typed ? now : null,
      };
    });
    set({
      sims: list,
      workSlot: list[0]?.slot ?? null,
      simLabel: list[0]?.carrier ?? "Phone",
      simCount: Math.max(1, sims.length),
      simConfirmed: list.length > 0 && list.every((x) => x.verifiedAt !== null),
      simChanged: false,
      // calls before this setup are the rep's own past; read from now on
      watermark: now,
    });
    setStep("verify");
    void loadRecent();
  }

  /** Looks for the test call in the call log: any outgoing call on a SIM after setup proves it. */
  /** The last few calls Android tagged with each set-up SIM: tapping one proves the SIM, as callos lets you. */
  const [recent, setRecent] = useState<Record<number, CallLogRow[]>>({});
  async function loadRecent() {
    if (!CallTracker) return;
    const rows = await CallTracker.readCallLog(Date.now() - 14 * 86_400_000, 500).catch(() => []);
    const bySlot: Record<number, CallLogRow[]> = {};
    for (const r of [...rows].reverse()) {
      if (r.simSlot === null) continue;
      (bySlot[r.simSlot] ??= []).length < 3 && bySlot[r.simSlot].push(r);
    }
    setRecent(bySlot);
  }
  function proveWith(slot: number) {
    const now = clockNow();
    const next = useDeviceStore.getState().sims.map((x) => (x.slot === slot ? { ...x, verifiedAt: now } : x));
    set({ sims: next, simConfirmed: next.every((x) => x.verifiedAt !== null) });
  }

  async function checkProof() {
    const current = useDeviceStore.getState().sims;
    if (!CallTracker || current.length === 0) return;
    const since = Math.min(...current.map((x) => x.configuredAt)) - 1000;
    const rows = await CallTracker.readCallLog(since, 200).catch(() => []);
    const proved = provedSlots(rows, current);
    if (proved.length) {
      const now = Date.now();
      const next = current.map((x) => (proved.includes(x.slot) ? { ...x, verifiedAt: now } : x));
      set({ sims: next, simConfirmed: next.every((x) => x.verifiedAt !== null) });
    }
  }

  // back from the dialler: look for the test call at once
  useEffect(() => {
    if (step !== "verify") return;
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") void checkProof();
    });
    return () => sub.remove();
    // checkProof reads the store directly; only the step matters here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function finish() {
    setBusy(true);
    setError(null);
    set({ setupDone: true, setupSkipped: false });
    CallTracker?.setAfterCallPrompt(
      useAuthStore.getState().company?.afterCallPopup ?? true,
    );
    try {
      await reportDevice();
      await registerBackgroundSync();
      const r = await syncNow();
      if (r.reason === "error") setError(useDeviceStore.getState().lastError);
    } catch {
      // the first sync will be retried by the background task
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen maxWidth={520}>
      <Text variant="eyebrow" tone="tertiary">
        Set up call tracking
      </Text>
      <Text variant="display" style={{ marginTop: 6 }}>
        {step === "permissions"
          ? "Allow what it needs"
          : step === "sim"
            ? "Which SIMs are for work?"
            : step === "verify"
              ? "Verify your SIMs"
              : step === "battery"
                ? "Keep it running"
                : "You’re set"}
      </Text>
      <View style={{ marginTop: space.lg }}>
        <Stepper step={step} />
      </View>
      {error ? (
        <View style={{ marginTop: space.lg }}>
          <Banner tone="error" message={error} />
        </View>
      ) : null}

      <View style={{ marginTop: space.xl, gap: space.md }}>
        {step === "permissions" ? (
          <>
            <Card padded={false}>
              {ask.map((a, i) => {
                const ok =
                  granted?.[a.key as keyof NonNullable<typeof granted>];
                return (
                  <View
                    key={a.key}
                    style={[
                      styles.perm,
                      i === ask.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={[styles.tick, ok && styles.tickOn]}>
                      {ok ? (
                        <Icon name="check" size={13} color={palette.paper} />
                      ) : null}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.permHead}>
                        <Text variant="bodyMedium">{a.title}</Text>
                        {a.required ? null : (
                          <Text variant="caption" tone="tertiary">
                            optional
                          </Text>
                        )}
                      </View>
                      <Text variant="caption" tone="secondary">
                        {a.why}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>
            <Text variant="caption" tone="tertiary">
              Only the SIM you mark as work is ever read. Nothing is recorded by
              this app — it uses the recording your phone already makes, if it
              makes one.
            </Text>
            <Button label="Allow access" onPress={askPermissions} />
            {error ? (
              <Button
                kind="ghost"
                label="Open app settings"
                onPress={() => Linking.openSettings()}
              />
            ) : null}
          </>
        ) : null}

        {step === "sim" ? (
          <>
            {sims.length ? (
              sims.map((x) => {
                const on = picked.includes(x.slot);
                return (
                  <View key={x.slot} style={[styles.sim, on && styles.simOn, styles.simColumn]}>
                    <Pressable
                      accessibilityRole="checkbox"
                      aria-checked={on}
                      onPress={() => setPicked((p) => (on ? p.filter((y) => y !== x.slot) : [...p, x.slot].sort()))}
                      style={styles.simRow}
                    >
                      <View style={styles.simChip}>
                        <Text style={styles.simSlot}>SIM {x.slot + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyMedium">{x.carrier || x.displayName || "Unknown carrier"}</Text>
                        <Text variant="mono" tone="tertiary">
                          {x.number ? formatPhone(x.number) : "number hidden by the SIM"}
                        </Text>
                      </View>
                      <View style={[styles.tick, on && styles.tickOn]}>
                        {on ? <Icon name="check" size={13} color={palette.paper} /> : null}
                      </View>
                    </Pressable>
                    {on ? (
                      <TextField
                        label={`Phone number on SIM ${x.slot + 1}`}
                        prefix="+91"
                        keyboardType="phone-pad"
                        maxLength={14}
                        value={numbers[x.slot] ?? ""}
                        onChangeText={(v) => setNumbers((n) => ({ ...n, [x.slot]: v }))}
                        error={numbers[x.slot] && !/^[6-9]\d{9}$/.test(digits(numbers[x.slot])) ? "Enter the 10-digit number" : undefined}
                      />
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Banner tone="info" message="No SIM card detected. Insert a SIM and try again." />
            )}
            <Text variant="caption" tone="tertiary">
              Tick every SIM you use for work. Calls on any other SIM, and calls from before today, stay on your phone and
              are never read.
            </Text>
            <Button label="Save SIMs" disabled={picked.length === 0 || !numbersOk} onPress={chooseSims} />
            {sims.length === 0 ? (
              <Button kind="ghost" label="Detect SIM cards again" onPress={() => setSims(CallTracker?.getSims() ?? [])} />
            ) : null}
          </>
        ) : null}

        {step === "verify" ? (
          <>
            <Text tone="secondary">
              Make one call from each SIM, to anyone, even a number that doesn’t answer. When it shows up in your call log,
              the SIM is verified.
            </Text>
            {work.map((w) => (
              <Card key={w.slot} style={{ gap: space.sm }}>
                <View style={styles.simRow}>
                  <View style={styles.simChip}>
                    <Text style={styles.simSlot}>SIM {w.slot + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{w.carrier}</Text>
                    <Text variant="mono" tone="tertiary">
                      {formatPhone(w.number)}
                    </Text>
                  </View>
                  <Text variant="label" tone={w.verifiedAt ? "connected" : "missed"}>
                    {w.verifiedAt ? "Verified" : "Not verified"}
                  </Text>
                </View>
                {w.verifiedAt ? null : (
                  <>
                    {(recent[w.slot] ?? []).length ? (
                      <>
                        <Text variant="caption" tone="secondary">
                          Tap a call you made or received on SIM {w.slot + 1}:
                        </Text>
                        {(recent[w.slot] ?? []).map((r) => (
                          <Pressable
                            key={r.id}
                            onPress={() => proveWith(w.slot)}
                            accessibilityRole="button"
                            style={({ pressed }) => [styles.recentCall, pressed && { backgroundColor: palette.paper }]}
                          >
                            <Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
                              {r.name || formatPhone(r.number) || "Private number"}
                            </Text>
                            <Text variant="mono" tone="tertiary">
                              {new Date(r.date).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}
                            </Text>
                          </Pressable>
                        ))}
                        <Text variant="caption" tone="tertiary" align="center">
                          or
                        </Text>
                      </>
                    ) : null}
                    <Button kind="ghost" size="sm" label={`Make a test call from SIM ${w.slot + 1}`} onPress={() => void Linking.openURL("tel:")} />
                  </>
                )}
              </Card>
            ))}
            <Button kind="ghost" label="Check again" onPress={() => void checkProof()} />
            <Button label={work.every((w) => w.verifiedAt) ? "Continue" : "Verify later and continue"} onPress={() => setStep("battery")} />
          </>
        ) : null}

        {step === "battery" ? (
          <>
            <Text tone="secondary">
              Many phones — Xiaomi, Redmi, POCO, Oppo, Vivo, Realme — stop apps
              in the background to save battery, and calls stop arriving. Set{" "}
              {environment.appName} to “No restrictions” so it can send calls
              while closed.
            </Text>
            <Button
              kind="ghost"
              label="Open battery settings"
              onPress={() => {
                if (CallTracker?.openSetting("battery")) return;
                IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS).catch(() =>
                  Linking.openSettings(),
                );
              }}
            />
            {CallTracker?.getHealth().autostartNeeded ? (
              <Button kind="ghost" label="Open auto-start settings" onPress={() => CallTracker?.openSetting("autostart")} />
            ) : null}
            <Text variant="caption" tone="tertiary">
              The rest (recording folder, display over other apps, WhatsApp calls) is under the shield at the top of the app,
              whenever you’re ready.
            </Text>
            <Button label="Done, continue" onPress={() => setStep("done")} />
          </>
        ) : null}

        {step === "done" ? (
          <>
            <Text tone="secondary">
              From your next call, the log, the recording and your notes show up
              on the dashboard on their own. Calls from the last day are being
              sent now.
            </Text>
            <Button label="Start" loading={busy} onPress={finish} />
          </>
        ) : null}

        {step !== "done" ? (
          <Button
            kind="quiet"
            label="Not now"
            onPress={() => set({ setupSkipped: true })}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", gap: 4 },
  stepItem: { flex: 1, alignItems: "center", gap: 4 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.ruleStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDone: {
    backgroundColor: palette.connected,
    borderColor: palette.connected,
  },
  stepNow: { backgroundColor: palette.ink, borderColor: palette.ink },
  stepN: { fontFamily: fonts.monoMedium, fontSize: 11, color: palette.ink3 },
  stepLabel: { fontFamily: fonts.text, fontSize: 10.5, color: palette.ink3 },
  perm: {
    flexDirection: "row",
    gap: space.md,
    padding: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  permHead: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: palette.ruleStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  tickOn: {
    backgroundColor: palette.connected,
    borderColor: palette.connected,
  },
  sim: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
  },
  simOn: { borderColor: palette.ink, borderWidth: 2, padding: space.lg - 1 },
  simColumn: { flexDirection: "column", alignItems: "stretch" },
  simRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  recentCall: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.sm,
    borderWidth: 1,
    borderColor: palette.rule,
    borderRadius: radius.md,
  },
  simChip: {
    width: 52,
    height: 40,
    borderRadius: 6,
    backgroundColor: palette.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  simSlot: { fontFamily: fonts.monoMedium, fontSize: 11, color: palette.paper },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: palette.ruleStrong,
  },
  radioOn: { borderWidth: 6, borderColor: palette.ink },
  bigNumber: { fontFamily: fonts.monoMedium, fontSize: 24, color: palette.ink },
});

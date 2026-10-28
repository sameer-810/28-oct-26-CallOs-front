import { useState } from "react";
import {
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import { CallTracker, type Sim } from "@/modules/call-tracker";
import { useAuthStore } from "@shared/store/useAuthStore";
import { formatPhone } from "@shared/format";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Card, Icon, Screen, Text } from "@shared/ui";
import { useDeviceStore } from "../deviceStore";
import { reportDevice, syncNow } from "../syncEngine";
import { registerBackgroundSync } from "../backgroundSync";
import { environment } from "@config/env";

type Step = "permissions" | "sim" | "verify" | "battery" | "done";
const STEPS: Step[] = ["permissions", "sim", "verify", "battery", "done"];
const LABEL: Record<Step, string> = {
  permissions: "Permissions",
  sim: "Work SIM",
  verify: "Your number",
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
    ...(Number(Platform.Version) >= 33
      ? [
          {
            key: "notifications",
            perms: [P.POST_NOTIFICATIONS],
            title: "Notifications",
            why: "To ask how a call went right after it ends.",
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
  const [slot, setSlot] = useState<number | null>(null);
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
    if (list.length === 1) setSlot(list[0].slot);
    setStep("sim");
  }

  const chosen = sims.find((s) => s.slot === slot);
  const simDigits = chosen?.number
    ? chosen.number.replace(/\D/g, "").slice(-10)
    : null;
  const myDigits = (user?.phone ?? "").replace(/\D/g, "").slice(-10);
  const autoVerified = Boolean(simDigits && simDigits === myDigits);

  function chooseSim() {
    if (slot === null && sims.length > 0) return;
    set({
      workSlot: slot,
      simLabel: chosen
        ? chosen.carrier || chosen.displayName || `SIM ${slot! + 1}`
        : "Phone",
      simCount: Math.max(1, sims.length),
    });
    setStep("verify");
  }

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
            ? "Which SIM is for work?"
            : step === "verify"
              ? "Is this your number?"
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
              sims.map((s) => (
                <Pressable
                  key={s.slot}
                  accessibilityRole="radio"
                  aria-checked={slot === s.slot}
                  onPress={() => setSlot(s.slot)}
                  style={[styles.sim, slot === s.slot && styles.simOn]}
                >
                  <View style={styles.simChip}>
                    <Text style={styles.simSlot}>SIM {s.slot + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">
                      {s.carrier || s.displayName || "Unknown carrier"}
                    </Text>
                    <Text variant="mono" tone="tertiary">
                      {s.number
                        ? formatPhone(s.number)
                        : "number hidden by the SIM"}
                    </Text>
                  </View>
                  <View
                    style={[styles.radio, slot === s.slot && styles.radioOn]}
                  />
                </Pressable>
              ))
            ) : (
              <Banner
                tone="info"
                message="Android didn’t list any SIMs. Calls will be tracked from the phone as a whole."
              />
            )}
            <Text variant="caption" tone="tertiary">
              Calls on any other SIM stay on your phone and are never read.
            </Text>
            <Button
              label="Use this SIM"
              disabled={sims.length > 0 && slot === null}
              onPress={chooseSim}
            />
          </>
        ) : null}

        {step === "verify" ? (
          <>
            <Card style={{ gap: space.sm }}>
              <Text variant="caption" tone="tertiary">
                Your account’s number
              </Text>
              <Text style={styles.bigNumber}>{formatPhone(user?.phone)}</Text>
              {autoVerified ? (
                <Banner
                  tone="success"
                  message="Your work SIM reports this same number. Verified."
                />
              ) : simDigits ? (
                <Banner
                  tone="error"
                  message={`This SIM reports ${formatPhone(chosen?.number)}, not your account’s number. Pick the other SIM, or ask your manager to update your number.`}
                />
              ) : (
                <Text variant="caption" tone="secondary">
                  Your SIM doesn’t share its number with apps, so confirm it
                  yourself.
                </Text>
              )}
            </Card>
            {simDigits && !autoVerified ? (
              <Button
                kind="ghost"
                label="Pick another SIM"
                onPress={() => setStep("sim")}
              />
            ) : (
              <>
                <Button
                  label={
                    autoVerified
                      ? "Continue"
                      : "Yes, that’s the number on this SIM"
                  }
                  onPress={() => {
                    set({ simConfirmed: true });
                    setStep("battery");
                  }}
                />
                {!autoVerified ? (
                  <Button
                    kind="ghost"
                    label="No — pick another SIM"
                    onPress={() => setStep("sim")}
                  />
                ) : null}
              </>
            )}
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
              onPress={() =>
                IntentLauncher.startActivityAsync(
                  IntentLauncher.ActivityAction
                    .IGNORE_BATTERY_OPTIMIZATION_SETTINGS,
                ).catch(() => Linking.openSettings())
              }
            />
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

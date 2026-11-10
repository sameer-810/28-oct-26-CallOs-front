import { useState, type ReactNode } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import * as Application from "expo-application";
import { CallTracker } from "@/modules/call-tracker";
import { apiErrorMessage } from "@api/apiClient";
import { environment } from "@config/env";
import { formatPhone } from "@shared/format";
import { palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Card, Icon, Sheet, Text, TextField, type IconName } from "@shared/ui";
import { useDeviceStore } from "../deviceStore";
import { useSendLog } from "../hooks/useSendLog";
import { reportDevice } from "../syncEngine";

function Row({ icon, title, sub, onPress, right }: { icon: IconName; title: string; sub?: string; onPress?: () => void; right?: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: palette.paper }]}
    >
      <View style={styles.tile}>
        <Icon name={icon} size={18} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{title}</Text>
        {sub ? (
          <Text variant="caption" tone="secondary">
            {sub}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron" size={16} color={palette.ink3} /> : null)}
    </Pressable>
  );
}

/** Per-brand steps for the two settings Android can't open or check for us. */
const GUIDES: { brand: string; steps: string[] }[] = [
  {
    brand: "Xiaomi · Redmi · POCO",
    steps: [
      "Settings → Apps → Manage apps → Ringwise → Autostart: on.",
      "Same page → Battery saver → No restrictions.",
      "Open recent apps, long-press Ringwise, tap the lock.",
    ],
  },
  {
    brand: "Realme · OPPO · OnePlus",
    steps: [
      "Settings → Apps → App management → Ringwise → Battery usage → Allow background activity and Allow auto launch.",
      "Settings → Battery → More settings → Optimise battery use → Ringwise → Don't optimise.",
      "Open recent apps, pull Ringwise down to lock it.",
    ],
  },
  {
    brand: "Vivo · iQOO",
    steps: [
      "Settings → Battery → Background power consumption management → Ringwise → Allow.",
      "i Manager → App manager → Autostart manager → Ringwise: on.",
    ],
  },
  {
    brand: "Samsung",
    steps: [
      "Settings → Apps → Ringwise → Battery → Unrestricted.",
      "Settings → Battery → Background usage limits → make sure Ringwise is not under Sleeping or Deep sleeping apps.",
    ],
  },
  {
    brand: "Every phone",
    steps: [
      "Turn on your dialler's own call recording (Phone app → Settings → Call recording → Always).",
      "If recordings don't attach, pick the recording folder under Settings → Call recordings.",
      "Calls still missing? Tap Resync now on the sync icon, then Send log file.",
    ],
  },
];

/**
 * The phone's section of Settings, as on the callos app: work SIMs, the
 * recording folder, the log file for support, the default dialler, help and
 * troubleshooting. Android only.
 */
export function PhoneSettings() {
  const sims = useDeviceStore((s) => s.sims);
  const simLabel = useDeviceStore((s) => s.simLabel);
  const folder = useDeviceStore((s) => s.recordingFolder);
  const set = useDeviceStore((s) => s.set);
  const sendLog = useSendLog();
  const [sheet, setSheet] = useState<"log" | "help" | "trouble" | null>(null);
  const [note, setNote] = useState("");
  if (!CallTracker) return null;

  const picked = CallTracker.getRecordingFolder();
  const version = `${Application.nativeApplicationVersion ?? "?"} (${Application.nativeBuildVersion ?? "?"})`;

  return (
    <View style={styles.section}>
      <Text variant="eyebrow" tone="tertiary">
        This phone
      </Text>
      <Card padded={false}>
        <View style={styles.block}>
          <Text variant="label" tone="secondary">
            SIM configuration
          </Text>
          {sims.length ? (
            sims.map((s) => (
              <View key={s.slot} style={styles.sim}>
                <Icon name="sim" size={18} />
                <Text style={{ flex: 1 }}>
                  SIM {s.slot + 1}
                  {s.carrier ? ` · ${s.carrier}` : ""} · {s.number ? formatPhone(s.number) : "number not set"}
                </Text>
                <Text variant="caption" tone={s.verifiedAt ? "connected" : "missed"}>
                  {s.verifiedAt ? "Verified" : "Not verified"}
                </Text>
              </View>
            ))
          ) : (
            <Text variant="caption" tone="secondary">
              {simLabel ? `Work SIM: ${simLabel}` : "No work SIM set up yet."}
            </Text>
          )}
        </View>
        <Row
          icon="sync"
          title="Reconfigure SIM cards"
          sub="Update your SIM card configuration"
          onPress={() => set({ setupDone: false, setupSkipped: false, simChanged: false })}
        />
        <Row
          icon="folder"
          title="Call recordings"
          sub={picked?.label ? `Folder: ${picked.label}` : folder ? `Found in ${folder}` : "Change call recordings location · not selected"}
          onPress={async () => {
            const f = await CallTracker?.pickRecordingFolder();
            if (f) {
              set({ recordingFolder: f.label });
              void reportDevice().catch(() => {});
            }
          }}
        />
        <Row icon="share" title="Send log file" sub="Send this phone's sync log to support" onPress={() => setSheet("log")} />
        <Row
          icon="phone"
          title="Default dialler"
          sub="Open default apps in system settings"
          onPress={() => CallTracker?.openSetting("defaultDialer")}
        />
        <Row icon="help" title="Help & support" sub="Get help and contact support" onPress={() => setSheet("help")} />
        <Row icon="wrench" title="Troubleshooting" sub="Steps for when calls or recordings don't arrive" onPress={() => setSheet("trouble")} />
        <Row icon="settings" title="Version" sub={version} />
      </Card>

      <Sheet visible={sheet === "log"} onClose={() => setSheet(null)} title="Send log file">
        <Text tone="secondary">
          Sends this phone’s sync record — counts, errors and settings, no numbers or names — so support can see what
          went wrong.
        </Text>
        {sendLog.isError ? <Banner tone="error" message={apiErrorMessage(sendLog.error)} /> : null}
        {sendLog.isSuccess ? (
          <Banner tone="success" message={`Sent. Quote reference ${sendLog.data.ref} when you talk to support.`} />
        ) : null}
        <TextField label="What went wrong? (optional)" value={note} onChangeText={setNote} multiline maxLength={1000} />
        <Button label="Send log file" loading={sendLog.isPending} onPress={() => sendLog.mutate(note.trim())} />
      </Sheet>

      <Sheet visible={sheet === "help"} onClose={() => setSheet(null)} title="Help & support">
        <Text tone="secondary">We’re here to help. Reach us any of these ways.</Text>
        {environment.supportEmail ? (
          <Row icon="message" title="Email support" sub={environment.supportEmail} onPress={() => void Linking.openURL(`mailto:${environment.supportEmail}`)} />
        ) : null}
        {environment.supportWhatsApp ? (
          <Row
            icon="whatsapp"
            title="Chat on WhatsApp"
            sub={`+${environment.supportWhatsApp}`}
            onPress={() => void Linking.openURL(`https://wa.me/${environment.supportWhatsApp}`)}
          />
        ) : null}
        <Row icon="share" title="Send log file" sub="Attach this phone's sync record" onPress={() => setSheet("log")} />
        <Row icon="home" title="Visit our website" sub={environment.websiteUrl} onPress={() => void Linking.openURL(environment.websiteUrl)} />
        <Row icon="shield" title="Your privacy" sub="We read work-SIM calls and call recordings only. Never messages, never personal SIMs." />
      </Sheet>

      <Sheet visible={sheet === "trouble"} onClose={() => setSheet(null)} title="Troubleshooting">
        <Text tone="secondary">
          Most “missing calls” are the phone stopping the app in the background. Find your phone below.
        </Text>
        {GUIDES.map((g) => (
          <View key={g.brand} style={styles.guide}>
            <Text variant="label">{g.brand}</Text>
            {g.steps.map((s, i) => (
              <Text key={i} variant="caption" tone="secondary">
                {i + 1}. {s}
              </Text>
            ))}
          </View>
        ))}
        <Button kind="ghost" label="Open battery settings" onPress={() => CallTracker?.openSetting("battery")} />
        <Button kind="ghost" label="Open auto-start settings" onPress={() => CallTracker?.openSetting("autostart")} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl, gap: space.sm },
  block: { padding: space.lg, gap: space.sm, borderBottomWidth: 1, borderBottomColor: palette.rule },
  sim: { flexDirection: "row", alignItems: "center", gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  tile: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: palette.paper, alignItems: "center", justifyContent: "center" },
  guide: { gap: 4, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: palette.rule },
});

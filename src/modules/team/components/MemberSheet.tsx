import { ActivityIndicator, StyleSheet, View } from "react-native";
import { clock, dateTimeIn, formatPhone, num, talkTime, timeAgo } from "@shared/format";
import { palette, radius, space } from "@shared/designSystem";
import { Sheet, Text } from "@shared/ui";
import { CallGlyph } from "@shared/ui/CallGlyph";
import type { DeviceInfo } from "@modules/device/types";
import { TYPE_LABEL } from "@modules/calls/types";
import { useMemberCalls, useMemberSummary } from "../hooks/useMember";
import type { TeamMember } from "../types";

const CHECK_LABEL: Record<string, string> = {
  callLog: "Call log",
  recordings: "Recordings",
  contacts: "Contacts",
  notifications: "Notifications",
  battery: "Battery",
  overlay: "After-call sheet",
  autostart: "Auto-start",
  recordingFolder: "Recording folder",
  whatsapp: "WhatsApp calls",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
      <Text variant="heading">{value}</Text>
    </View>
  );
}

/**
 * One employee, as the callos admin app shows them: the last 30 days in three
 * numbers, their latest calls — and, from their phone, its SIMs, battery and
 * which setup checks are off.
 */
export function MemberSheet({
  member,
  device,
  tz,
  onClose,
}: {
  member: TeamMember;
  device: DeviceInfo | undefined;
  tz: string;
  onClose: () => void;
}) {
  const summary = useMemberSummary(member.id);
  const calls = useMemberCalls(member.id);
  const t = summary.data?.totals;
  const off = device?.checks ? Object.entries(device.checks).filter(([, ok]) => !ok).map(([k]) => CHECK_LABEL[k] ?? k) : [];

  return (
    <Sheet visible onClose={onClose} title={member.name}>
      <Text variant="mono" tone="secondary">
        {formatPhone(member.phone)}
        {member.email ? ` · ${member.email}` : ""}
      </Text>

      <Text variant="label">Last 30 days</Text>
      {t ? (
        <View style={styles.stats}>
          <Stat label="Calls" value={num(t.total)} />
          <Stat label="Connected" value={num(t.connected)} />
          <Stat label="Talk time" value={talkTime(t.talkSec)} />
          <Stat label="In working hours" value={talkTime(t.workTalkSec)} />
        </View>
      ) : (
        <ActivityIndicator color={palette.ink} />
      )}

      <Text variant="label">Phone</Text>
      {device ? (
        <View style={styles.box}>
          <Text>
            {[device.brand, device.model].filter(Boolean).join(" ") || "Android phone"}
            {device.appVersion ? ` · app ${device.appVersion}` : ""}
          </Text>
          <Text variant="caption" tone="secondary">
            Last synced {timeAgo(device.lastSyncAt) ?? "never"}
            {device.battery?.level != null ? ` · battery ${device.battery.level}%` : ""}
            {device.battery?.powerSave ? " · power saving on" : ""}
          </Text>
          {(device.sims ?? []).map((s) => (
            <Text key={s.slot} variant="caption" tone={s.verifiedAt ? "secondary" : "missed"}>
              SIM {s.slot + 1}
              {s.carrier ? ` · ${s.carrier}` : ""} · {s.number ? formatPhone(s.number) : "no number"} · {s.verifiedAt ? "verified" : "not verified"}
            </Text>
          ))}
          {device.checks ? (
            <Text variant="caption" tone={off.length ? "missed" : "connected"}>
              {off.length ? `Off: ${off.join(", ")}` : "Every setup check passes"}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text tone="tertiary">No phone set up yet.</Text>
      )}

      <Text variant="label">Recent calls</Text>
      {calls.isLoading ? (
        <ActivityIndicator color={palette.ink} />
      ) : (calls.data?.items ?? []).length === 0 ? (
        <Text tone="tertiary">No calls in the last 30 days.</Text>
      ) : (
        (calls.data?.items ?? []).map((c) => (
          <View key={c.id} style={styles.call}>
            <CallGlyph type={c.type} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {c.contactName || formatPhone(c.phone)}
              </Text>
              <Text variant="caption" tone="tertiary">
                {TYPE_LABEL[c.type]} · {dateTimeIn(c.startedAt, tz)}
                {c.leadStatusLabel ? ` · ${c.leadStatusLabel}` : ""}
              </Text>
            </View>
            <Text variant="mono">{c.durationSec ? clock(c.durationSec) : "—"}</Text>
          </View>
        ))
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stat: {
    flexGrow: 1,
    minWidth: 120,
    padding: space.md,
    borderWidth: 1,
    borderColor: palette.rule,
    borderRadius: radius.lg,
    gap: 2,
  },
  box: { padding: space.md, borderWidth: 1, borderColor: palette.rule, borderRadius: radius.lg, gap: 4 },
  call: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: palette.rule },
});

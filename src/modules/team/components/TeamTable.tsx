import { StyleSheet, View } from "react-native";
import { dateIn, formatPhone, timeAgo } from "@shared/format";
import { fonts, palette } from "@shared/designSystem";
import { Button, Tag, Text } from "@shared/ui";
import { Table, type Column } from "@shared/ui/Table";
import { ROLE_LABEL, type AuthUser } from "@modules/auth/types";
import { deviceHealth, type DeviceInfo } from "@modules/device/deviceHealthRules";
import type { TeamMember } from "../types";

const RANK = { owner: 3, manager: 2, rep: 1 } as const;

/**
 * The team on a laptop: one row per person with their phone, app version and
 * when they last made a call or sent a recording — the columns that tell a
 * manager whose phone has gone quiet before the reports do.
 */
export function TeamTable({
  rows,
  me,
  tz,
  now,
  deviceOf,
  onStatus,
  onRole,
}: {
  /** The phone's live report — what the Device column judges health from. */
  deviceOf: (userId: string) => DeviceInfo | undefined;
  rows: TeamMember[];
  me: AuthUser;
  tz: string;
  now: number;
  onStatus: (u: TeamMember) => void;
  onRole: (u: TeamMember) => void;
}) {
  const ago = (iso: string | null | undefined) => timeAgo(iso, now) ?? "—";
  const cols: Column<TeamMember>[] = [
    {
      key: "name",
      label: "Name",
      width: 180,
      render: (u) => (
        <Text style={styles.name} numberOfLines={1}>
          {u.name}
          {u.id === me.id ? <Text style={styles.you}> (you)</Text> : null}
        </Text>
      ),
    },
    { key: "role", label: "Role", width: 92, render: (u) => <Tag label={ROLE_LABEL[u.role]} tone={u.role === "owner" ? "ink" : "neutral"} /> },
    { key: "phone", label: "Phone", width: 140, render: (u) => <Text style={styles.mono}>{formatPhone(u.phone)}</Text> },
    {
      key: "device",
      label: "Phone",
      width: 230,
      // the same verdict as the list on a phone: model, SIM and whether calls are arriving
      render: (u) => {
        const h = deviceHealth(deviceOf(u.id), now);
        return (
          <Text style={[styles.health, h.tone === "missed" && { color: palette.missed }]} numberOfLines={2}>
            {h.text}
          </Text>
        );
      },
    },
    { key: "app", label: "App version", width: 92, render: (u) => u.device?.appVersion || "—" },
    { key: "reg", label: "Registered", width: 100, render: (u) => dateIn(u.registeredAt ?? u.createdAt, tz) },
    { key: "call", label: "Last call", width: 100, render: (u) => ago(u.lastCallAt) },
    { key: "rec", label: "Last recording", width: 110, render: (u) => ago(u.lastRecordingAt) },
    { key: "status", label: "Status", width: 104, render: (u) => (u.isActive ? <Tag label="Active" tone="connected" /> : <Tag label="Switched off" tone="missed" />) },
    {
      key: "act",
      label: "",
      width: 210,
      render: (u) => {
        const isMe = u.id === me.id;
        const canStatus = !isMe && RANK[me.role] > RANK[u.role];
        const canRole = me.role === "owner" && !isMe && u.role !== "owner";
        return (
          <View style={styles.actions}>
            {canRole && u.isActive ? <Button kind="ghost" size="sm" label={u.role === "rep" ? "Make manager" : "Make rep"} onPress={() => onRole(u)} /> : null}
            {canStatus ? <Button kind="quiet" size="sm" label={u.isActive ? "Switch off" : "Switch on"} onPress={() => onStatus(u)} /> : null}
          </View>
        );
      },
    },
  ];
  return <Table columns={cols} rows={rows} rowKey={(u) => u.id} />;
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.textMedium, fontSize: 14, color: palette.ink },
  you: { fontFamily: fonts.text, color: palette.ink3 },
  mono: { fontFamily: fonts.mono, fontSize: 13, color: palette.ink },
  health: { fontFamily: fonts.text, fontSize: 13, color: palette.ink2 },
  actions: { flexDirection: "row", gap: 6 },
});

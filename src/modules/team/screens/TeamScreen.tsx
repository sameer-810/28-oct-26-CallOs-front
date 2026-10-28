import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { apiErrorMessage } from "@api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { formatPhone, initials, timeAgo } from "@shared/format";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Card, ConfirmDialog, Screen, Tag, Text, TextField, useBreakpoint } from "@shared/ui";
import { ROLE_LABEL, type AuthUser } from "@modules/auth/types";
import type { StatusFilter } from "../types";
import { useSetRole, useSetStatus, useTeam } from "../hooks/useTeam";
import { useRefreshOnFocus } from "@shared/hooks/useRefreshOnFocus";
import { useNow } from "@shared/hooks/useNow";
import { deviceHealth } from "@modules/device/deviceHealthRules";
import { useDevices } from "@modules/device/hooks/useDevices";
import type { DeviceInfo } from "@modules/device/types";
import { GetTheAppCard } from "../components/GetTheAppCard";
import { TeamTable } from "../components/TeamTable";

const RANK = { owner: 3, manager: 2, rep: 1 } as const;

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "inactive", label: "Switched off" },
  { id: "all", label: "Everyone" },
];

type Pending = { kind: "status"; user: AuthUser } | { kind: "role"; user: AuthUser } | null;

function Segmented({ value, onChange }: { value: StatusFilter; onChange: (v: StatusFilter) => void }) {
  return (
    <View style={styles.seg} accessibilityRole="tablist">
      {FILTERS.map((f) => {
        const on = f.id === value;
        return (
          <Pressable
            key={f.id}
            accessibilityRole="tab"
            aria-selected={on}
            onPress={() => onChange(f.id)}
            style={[styles.segBtn, on && styles.segOn]}
          >
            <Text style={[styles.segText, on && { color: palette.paper }]}>{f.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({
  u,
  me,
  isWide,
  onStatus,
  onRole,
  device,
  now,
}: {
  device: DeviceInfo | undefined;
  now: number;
  u: AuthUser;
  me: AuthUser;
  isWide: boolean;
  onStatus: () => void;
  onRole: () => void;
}) {
  const isMe = u.id === me.id;
  const canStatus = !isMe && RANK[me.role] > RANK[u.role];
  const canRole = me.role === "owner" && !isMe && u.role !== "owner";
  const seen = timeAgo(u.lastLoginAt);

  const actions =
    canStatus || canRole ? (
      <View style={[styles.actions, !isWide && styles.actionsNarrow]}>
        {canRole && u.isActive ? (
          <Button
            kind="ghost"
            size="sm"
            label={u.role === "rep" ? "Make manager" : "Make rep"}
            onPress={onRole}
          />
        ) : null}
        {canStatus ? (
          <Button kind="quiet" size="sm" label={u.isActive ? "Switch off" : "Switch on"} onPress={onStatus} />
        ) : null}
      </View>
    ) : null;

  return (
    <View style={[styles.row, !u.isActive && styles.rowOff]}>
      <View style={styles.rowMain}>
        <View style={[styles.avatar, u.role !== "rep" && styles.avatarInk]}>
          <Text style={[styles.avatarText, u.role !== "rep" && { color: palette.paper }]}>{initials(u.name)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.nameLine}>
            <Text variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1 }}>
              {u.name}
              {isMe ? <Text tone="tertiary"> (you)</Text> : null}
            </Text>
            {u.role !== "rep" ? <Tag label={ROLE_LABEL[u.role]} tone={u.role === "owner" ? "ink" : "neutral"} /> : null}
            {!u.isActive ? <Tag label="Switched off" tone="missed" /> : null}
          </View>
          <Text variant="mono" tone="secondary">
            {formatPhone(u.phone)}
          </Text>
          <Text variant="caption" tone="tertiary">
            {seen ? `Signed in ${seen}` : "Hasn't signed in yet"}
          </Text>
          {u.isActive ? (
            <Text variant="caption" tone={deviceHealth(device, now).tone}>
              {deviceHealth(device, now).text}
            </Text>
          ) : null}
        </View>
        {isWide ? actions : null}
      </View>
      {!isWide ? actions : null}
    </View>
  );
}

export default function TeamScreen() {
  const me = useAuthStore((s) => s.user);
  const company = useAuthStore((s) => s.company);
  const { isWide } = useBreakpoint();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [pending, setPending] = useState<Pending>(null);

  const team = useTeam({ search: search.trim() || undefined, status });
  const devices = useDevices(true);
  const now = useNow();
  // a rep may have used more than one phone; the most recently heard from wins
  const deviceOf = (userId: string) => devices.data?.find((d) => d.userId === userId);
  useRefreshOnFocus(team.refetch);
  const setStatusM = useSetStatus();
  const setRoleM = useSetRole();
  const busy = setStatusM.isPending || setRoleM.isPending;
  const failure = setStatusM.error ?? setRoleM.error;

  if (!me) return null;

  function confirm() {
    if (!pending) return;
    const done = { onSettled: () => setPending(null) };
    if (pending.kind === "status") {
      setStatusM.mutate({ id: pending.user.id, isActive: !pending.user.isActive }, done);
    } else {
      setRoleM.mutate({ id: pending.user.id, role: pending.user.role === "rep" ? "manager" : "rep" }, done);
    }
  }

  const dialog = (() => {
    if (!pending) return null;
    const u = pending.user;
    if (pending.kind === "status") {
      return u.isActive
        ? {
            title: `Switch off ${u.name}?`,
            message:
              "They're signed out on every device straight away and can't sign back in. Their past calls stay. You can switch them back on any time.",
            label: "Switch off",
            danger: true,
          }
        : { title: `Switch ${u.name} back on?`, message: "They can sign in again with their own password.", label: "Switch on", danger: false };
    }
    return u.role === "rep"
      ? {
          title: `Make ${u.name} a manager?`,
          message: "Managers see and hear every call in the company and can add or switch off reps.",
          label: "Make manager",
          danger: false,
        }
      : { title: `Make ${u.name} a rep?`, message: "They'll see only their own calls from now on.", label: "Make rep", danger: false };
  })();

  return (
    <Screen>
      <View style={styles.head}>
        <View>
          <Text variant="eyebrow" tone="tertiary">
            {company?.name}
          </Text>
          <Text variant="display" style={{ marginTop: 6 }}>
            Team
          </Text>
        </View>
        {team.data ? (
          <Text variant="mono" tone="tertiary">
            {team.data.total} {status === "inactive" ? "switched off" : status === "active" ? "active" : "people"}
          </Text>
        ) : null}
      </View>

      <View style={[styles.tools, isWide && styles.toolsWide]}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Search"
            placeholder="Name, email or last 4 digits"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Segmented value={status} onChange={setStatus} />
      </View>

      {company?.code ? (
        <View style={{ marginTop: space.lg }}>
          <GetTheAppCard code={company.code} companyName={company.name} />
        </View>
      ) : null}

      {failure ? <Banner tone="error" message={apiErrorMessage(failure)} /> : null}

      <Card padded={false} style={{ marginTop: space.lg, overflow: "hidden" }}>
        {team.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.ink} />
          </View>
        ) : team.isError ? (
          <View style={styles.center}>
            <Text tone="secondary">{apiErrorMessage(team.error)}</Text>
          </View>
        ) : team.data?.items.length && isWide ? (
          <TeamTable
            rows={team.data.items}
            me={me}
            tz={company?.timezone ?? "Asia/Kolkata"}
            now={now}
            deviceOf={deviceOf}
            onStatus={(u) => setPending({ kind: "status", user: u })}
            onRole={(u) => setPending({ kind: "role", user: u })}
          />
        ) : team.data?.items.length ? (
          team.data.items.map((u) => (
            <Row
              key={u.id}
              u={u}
              me={me}
              isWide={isWide}
              device={deviceOf(u.id)}
              now={now}
              onStatus={() => setPending({ kind: "status", user: u })}
              onRole={() => setPending({ kind: "role", user: u })}
            />
          ))
        ) : (
          <View style={styles.center}>
            <Text variant="heading">{search ? "Nobody matches that" : status === "inactive" ? "Nobody is switched off" : "Nobody here yet"}</Text>
            <Text variant="caption" tone="secondary" align="center">
              {search ? "Try part of the name or the last 4 digits of the number." : "Share your company code from Home to add people."}
            </Text>
          </View>
        )}
      </Card>

      <ConfirmDialog
        visible={!!dialog}
        title={dialog?.title ?? ""}
        message={dialog?.message ?? ""}
        confirmLabel={dialog?.label ?? ""}
        danger={dialog?.danger}
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: space.md },
  tools: { marginTop: space.xl, gap: space.md },
  toolsWide: { flexDirection: "row", alignItems: "flex-end" },
  seg: {
    flexDirection: "row",
    padding: 3,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    borderRadius: radius.md + 2,
    backgroundColor: palette.card,
    alignSelf: "flex-start",
  },
  segBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.sm + 1 },
  segOn: { backgroundColor: palette.ink },
  segText: { fontFamily: fonts.textMedium, fontSize: 13, color: palette.ink2 },
  row: { paddingHorizontal: space.lg, paddingVertical: space.md + 2, borderBottomWidth: 1, borderBottomColor: palette.rule },
  rowOff: { backgroundColor: palette.paper },
  rowMain: { flexDirection: "row", alignItems: "center", gap: space.md },
  nameLine: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    backgroundColor: palette.paper2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInk: { backgroundColor: palette.ink, borderColor: palette.ink },
  avatarText: { fontFamily: fonts.textSemi, fontSize: 13, color: palette.ink },
  actions: { flexDirection: "row", gap: space.xs, alignItems: "center" },
  actionsNarrow: { marginTop: space.sm, marginLeft: 52 },
  center: { padding: space.xxl, alignItems: "center", gap: space.xs },
});

import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useAuthStore } from "../store/useAuthStore";
import { usePeople } from "../hooks/usePeople";
import { RANGE_LABEL, useFilters, type RangeName } from "../store/useFilters";
import { fonts, palette, radius, space } from "../designSystem";
import { dayLabel } from "../format";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { Sheet } from "./Sheet";
import { Text } from "./Text";
import { TextField } from "./TextField";

const QUICK: RangeName[] = ["today", "yesterday", "last7", "this_week", "last_week", "last30", "this_month"];
const KEY = /^\d{4}-\d{2}-\d{2}$/;

function CustomRange({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { from, to, setRange } = useFilters();
  const [a, setA] = useState(from ?? "");
  const [b, setB] = useState(to ?? "");
  const ok = KEY.test(a) && KEY.test(b);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Pick dates"
      footer={
        <Button
          label="Show these dates"
          disabled={!ok}
          onPress={() => {
            setRange("custom", a <= b ? a : b, a <= b ? b : a);
            onClose();
          }}
        />
      }
    >
      <TextField label="From" value={a} onChangeText={setA} placeholder="2026-10-01" hint="YYYY-MM-DD" autoCapitalize="none" />
      <TextField label="To" value={b} onChangeText={setB} placeholder="2026-10-27" hint="Up to a year apart." autoCapitalize="none" />
    </Sheet>
  );
}

function PeoplePicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const people = usePeople();
  const { userIds, setUserIds } = useFilters();
  const [picked, setPicked] = useState<string[]>(userIds);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Whose calls?"
      footer={
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button kind="ghost" label="Everyone" onPress={() => { setUserIds([]); onClose(); }} style={{ flex: 1 }} />
          <Button label={picked.length ? `Show ${picked.length}` : "Show everyone"} onPress={() => { setUserIds(picked); onClose(); }} style={{ flex: 1 }} />
        </View>
      }
    >
      {(people.data ?? []).map((p) => {
        const on = picked.includes(p.id);
        return (
          <Pressable
            key={p.id}
            accessibilityRole="checkbox"
            aria-checked={on}
            onPress={() => toggle(p.id)}
            style={styles.person}
          >
            <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.tick}>✓</Text> : null}</View>
            <Text variant="bodyMedium" style={{ flex: 1 }} tone={p.isActive ? "primary" : "tertiary"}>
              {p.name}
            </Text>
            <Text variant="caption" tone="tertiary">
              {p.isActive ? p.role : "switched off"}
            </Text>
          </Pressable>
        );
      })}
    </Sheet>
  );
}

/**
 * The range and people filter, shared by every screen that counts calls.
 * People is hidden from reps: the server pins them to their own calls anyway.
 */
export function RangeBar({ showPeople = true }: { showPeople?: boolean }) {
  const { range, from, to, userIds, setRange } = useFilters();
  const role = useAuthStore((s) => s.user?.role);
  const people = usePeople();
  const [custom, setCustom] = useState(false);
  const [picker, setPicker] = useState(false);
  const manager = role === "owner" || role === "manager";

  const peopleLabel = !userIds.length
    ? "Everyone"
    : userIds.length === 1
      ? (people.data?.find((p) => p.id === userIds[0])?.name ?? "1 person")
      : `${userIds.length} people`;

  return (
    <View style={styles.bar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {QUICK.map((r) => (
          <Chip key={r} label={RANGE_LABEL[r]} selected={range === r} onPress={() => setRange(r)} />
        ))}
        <Chip
          label={range === "custom" && from && to ? `${dayLabel(from)} – ${dayLabel(to)}` : "Pick dates…"}
          selected={range === "custom"}
          onPress={() => setCustom(true)}
        />
      </ScrollView>
      {showPeople && manager ? (
        <Pressable onPress={() => setPicker(true)} accessibilityRole="button" accessibilityLabel={`People: ${peopleLabel}. Change`} style={styles.peopleBtn}>
          <Text style={styles.peopleText} numberOfLines={1}>
            {peopleLabel}
          </Text>
          <Text style={styles.caret}>▾</Text>
        </Pressable>
      ) : null}
      {custom ? <CustomRange visible onClose={() => setCustom(false)} /> : null}
      {picker ? <PeoplePicker visible onClose={() => setPicker(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  chips: { gap: 6, paddingRight: space.sm },
  peopleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.ink,
    maxWidth: 220,
  },
  peopleText: { fontFamily: fonts.textMedium, fontSize: 12.5, color: palette.ink },
  caret: { fontSize: 10, color: palette.ink2 },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  box: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: palette.ruleStrong, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: palette.ink, borderColor: palette.ink },
  tick: { color: palette.paper, fontSize: 12, lineHeight: 14 },
});

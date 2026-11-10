import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { space } from "@shared/designSystem";
import { Button, Chip, Text } from "@shared/ui";

const DAYS = 21;
/** 8:00 to 21:30 in half hours: when sales calls actually happen. */
const SLOTS = Array.from({ length: 28 }, (_, i) => ({ h: 8 + Math.floor(i / 2), m: (i % 2) * 30 }));

const dayName = (d: Date, i: number) =>
  i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const slotName = ({ h, m }: { h: number; m: number }) => `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;

/**
 * Any day in the next three weeks, any half hour of the working day — for
 * the follow-up a preset doesn't cover ("Thursday at 4:30"). Times already
 * past are not offered; the phone's own clock is the rep's day.
 */
export function FollowUpPicker({ onPick, busy }: { onPick: (at: Date) => void; busy: boolean }) {
  const [now] = useState(() => new Date());
  const days = useMemo(
    () =>
      Array.from({ length: DAYS }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        d.setHours(0, 0, 0, 0);
        return d;
      }),
    [now],
  );
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<number | null>(null);

  const at = (i: number) => {
    const d = new Date(days[day]);
    d.setHours(SLOTS[i].h, SLOTS[i].m, 0, 0);
    return d;
  };
  const open = SLOTS.map((_, i) => i).filter((i) => at(i).getTime() > now.getTime() + 5 * 60_000);

  return (
    <View style={styles.wrap}>
      <Text variant="caption" tone="secondary">
        Pick follow-up date & time
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {days.map((d, i) => (
          <Chip
            key={d.toISOString()}
            label={dayName(d, i)}
            selected={day === i}
            onPress={() => {
              setDay(i);
              setSlot(null);
            }}
          />
        ))}
      </ScrollView>
      {open.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {open.map((i) => (
            <Chip key={i} label={slotName(SLOTS[i])} selected={slot === i} onPress={() => setSlot(i)} />
          ))}
        </ScrollView>
      ) : (
        <Text variant="caption" tone="tertiary">
          The day is over — pick another day.
        </Text>
      )}
      <Button
        size="sm"
        label={slot === null ? "Choose a time" : `Set for ${dayName(days[day], day)}, ${slotName(SLOTS[slot])}`}
        disabled={slot === null}
        loading={busy}
        onPress={() => slot !== null && onPick(at(slot))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { gap: 6, paddingRight: space.lg },
});

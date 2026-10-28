import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { fonts, palette, space } from "../designSystem";
import { Text } from "./Text";
import type { PressState } from "./useBreakpoint";

export interface Column<T> {
  key: string;
  label: string;
  width: number;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
  /** A group header spanning this and the following columns with the same group. */
  group?: string;
}

/**
 * A wide table that scrolls sideways inside its card instead of squeezing.
 * Numbers right-aligned in mono, rules between rows, a total row if given.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  footer,
  onRowPress,
  rowLabel,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (r: T) => string;
  footer?: T;
  /** Rows become buttons: a call opens, a person opens. */
  onRowPress?: (r: T) => void;
  /** What a screen reader says for a pressable row. */
  rowLabel?: (r: T) => string;
}) {
  const width = columns.reduce((a, c) => a + c.width, 0) + space.lg * 2;
  const groups: { label: string; width: number }[] = [];
  for (const c of columns) {
    const g = c.group ?? "";
    if (groups.at(-1)?.label === g) groups.at(-1)!.width += c.width;
    else groups.push({ label: g, width: c.width });
  }
  const hasGroups = groups.some((g) => g.label);

  const cell = (c: Column<T>, r: T, bold?: boolean) => (
    <View key={c.key} role="cell" style={{ width: c.width, paddingRight: 10 }}>
      {(() => {
        const v = c.render(r);
        return typeof v === "string" || typeof v === "number" ? (
          <Text style={[c.align === "right" ? styles.num : styles.txt, bold && styles.bold]} numberOfLines={1}>
            {v}
          </Text>
        ) : (
          v
        );
      })()}
    </View>
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      {/* real table semantics: screen readers announce rows and column names, as a <table> would */}
      <View role="table" style={{ minWidth: width }}>
        {hasGroups ? (
          <View style={[styles.row, styles.groupRow]}>
            {groups.map((g, i) => (
              <View key={i} style={{ width: g.width, paddingRight: 10 }}>
                {g.label ? <Text style={styles.group}>{g.label}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
        <View role="row" style={[styles.row, styles.head]}>
          {columns.map((c) => (
            <Text key={c.key} role="columnheader" style={[styles.th, { width: c.width, textAlign: c.align ?? "left", paddingRight: 10 }]} numberOfLines={2}>
              {c.label}
            </Text>
          ))}
        </View>
        {rows.map((r) =>
          onRowPress ? (
            // a row that opens something stays a button, so it can be reached and pressed from the keyboard
            <Pressable
              key={rowKey(r)}
              onPress={() => onRowPress(r)}
              accessibilityRole="button"
              accessibilityLabel={rowLabel?.(r)}
              style={({ hovered, pressed }: PressState) => [styles.row, (hovered || pressed) && styles.rowHover]}
            >
              {columns.map((c) => cell(c, r))}
            </Pressable>
          ) : (
            <View key={rowKey(r)} role="row" style={styles.row}>
              {columns.map((c) => cell(c, r))}
            </View>
          ),
        )}
        {footer ? <View role="row" style={[styles.row, styles.foot]}>{columns.map((c) => cell(c, footer, true))}</View> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.rule },
  rowHover: { backgroundColor: palette.paper },
  groupRow: { paddingVertical: 6, borderBottomWidth: 0 },
  group: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: palette.ink2, textTransform: "uppercase", letterSpacing: 0.6, borderBottomWidth: 1, borderBottomColor: palette.ink, paddingBottom: 3 },
  head: { borderBottomColor: palette.ink, paddingVertical: 8 },
  th: { fontFamily: fonts.mono, fontSize: 10.5, color: palette.ink3, textTransform: "uppercase", letterSpacing: 0.4 },
  txt: { fontFamily: fonts.text, fontSize: 13.5, color: palette.ink },
  num: { fontFamily: fonts.mono, fontSize: 13, color: palette.ink, textAlign: "right" },
  bold: { fontFamily: fonts.monoMedium },
  foot: { backgroundColor: palette.paper, borderBottomWidth: 0 },
});

import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FORM_MAX, fonts, palette, space } from "@shared/designSystem";
import { Brand } from "@shared/ui/BrandMark";
import { Text, useBreakpoint } from "@shared/ui";

const SAMPLE = [
  { who: "Rakesh Mehta", meta: "Outgoing · 4:12", note: "Site visit booked" },
  { who: "+91 99•• ••0381", meta: "Missed · 11:15", note: "Call back" },
  { who: "Sneha Kulkarni", meta: "Incoming · 2:05", note: "Price objection" },
];

/**
 * Sign-in, sign-up and join share this frame. On a laptop the left half shows
 * what the product is for, in its own UI; on a phone the form is the page.
 */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { isWide } = useBreakpoint();

  const form = (
    <View style={styles.formCol}>
      {!isWide ? <View style={styles.brandNarrow}><Brand /></View> : null}
      <Text variant="title" style={styles.title}>
        {title}
      </Text>
      {subtitle ? (
        <Text tone="secondary" style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.split}>
        {isWide ? (
          <View style={styles.side}>
            <Brand inverse />
            <View style={styles.sideMid}>
              <Text style={styles.sideHead}>Every sales call,{"\n"}on the record.</Text>
              <View style={styles.log}>
                {SAMPLE.map((r) => (
                  <View key={r.who} style={styles.logRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logWho}>{r.who}</Text>
                      <Text variant="mono" style={styles.logMeta}>
                        {r.meta}
                      </Text>
                    </View>
                    <Text variant="mono" style={styles.logNote}>
                      {r.note}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <Text variant="eyebrow" style={styles.sideFoot}>
              Sample data
            </Text>
          </View>
        ) : null}

        <ScrollView
          style={styles.main}
          contentContainerStyle={[styles.mainContent, isWide && styles.mainWide]}
          keyboardShouldPersistTaps="handled"
        >
          {form}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.paper },
  split: { flex: 1, flexDirection: "row" },
  side: {
    width: "42%",
    maxWidth: 560,
    backgroundColor: palette.ink,
    padding: space.xxl + 8,
    justifyContent: "space-between",
  },
  sideMid: { gap: space.xxl },
  sideHead: { fontFamily: fonts.display, fontSize: 46, lineHeight: 48, letterSpacing: -1, color: palette.paper },
  log: { borderTopWidth: 1, borderTopColor: "#3A352C" },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#3A352C",
  },
  logWho: { fontFamily: fonts.textMedium, fontSize: 14, color: palette.paper },
  logMeta: { fontSize: 11, color: "#A89F8E", marginTop: 2 },
  logNote: {
    fontSize: 11,
    color: palette.ink,
    backgroundColor: palette.marker,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    overflow: "hidden",
  },
  sideFoot: { color: "#8D8576" },
  main: { flex: 1 },
  mainContent: { flexGrow: 1, paddingHorizontal: space.lg + 4, paddingTop: space.xl, paddingBottom: space.xxxl },
  mainWide: { justifyContent: "center", alignItems: "center", paddingHorizontal: space.xxxl },
  formCol: { width: "100%", maxWidth: FORM_MAX, alignSelf: "center" },
  brandNarrow: { marginBottom: space.xxl },
  title: { fontSize: 34, lineHeight: 38 },
  subtitle: { marginTop: space.sm },
  body: { marginTop: space.xl, gap: space.lg },
});

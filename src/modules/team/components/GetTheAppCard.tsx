import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Button, Card, Text, useBreakpoint } from "@shared/ui";
import { QrCode } from "@shared/ui/QrCode";
import { spacedCode } from "@shared/format";

const STEPS: { title: string; body: string }[] = [
  { title: "Install", body: "Scan the code with the phone’s camera, or open the join link on it, and install the app." },
  { title: "Allow permissions", body: "Call log, phone state and recordings — the app explains each one before Android asks." },
  { title: "Join with the code", body: "The code fills in by itself from the link; otherwise type it. They land in your team as a rep." },
  { title: "Choose the work SIM", body: "On a dual-SIM phone, only calls from the work SIM are tracked. Personal calls stay personal." },
  { title: "Done", body: "Calls appear on your dashboard about a minute after they end. Team shows each phone’s health." },
];

function joinLink(code: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.origin}/join/${code}`;
  return null;
}

/**
 * Getting a rep's phone onto the team: a QR of the join link to scan from
 * the manager's screen, and the five steps the rep will see, so the manager
 * can talk them through it. Collapses once read.
 */
export function GetTheAppCard({ code, companyName }: { code: string; companyName: string }) {
  const { isWide } = useBreakpoint();
  const [step, setStep] = useState(0);
  const [hidden, setHidden] = useState(false);
  const link = joinLink(code);

  if (hidden) {
    return <Button kind="ghost" size="sm" label="How a rep gets set up" onPress={() => setHidden(false)} style={{ alignSelf: "flex-start" }} />;
  }

  return (
    <Card style={styles.card}>
      <View style={styles.headRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="heading">Get the app on your team’s phones</Text>
          <Text variant="caption" tone="secondary">
            Each rep scans this once. They join {companyName} with code <Text style={styles.code}>{spacedCode(code)}</Text>.
          </Text>
        </View>
        <Button kind="quiet" size="sm" label="Hide guide" onPress={() => setHidden(true)} />
      </View>

      <View style={[styles.body, isWide && { flexDirection: "row" }]}>
        {link ? (
          <View style={styles.qrBox}>
            <QrCode value={link} label={`QR code for the join link of ${companyName}`} />
            <Text variant="caption" tone="tertiary" align="center" style={{ maxWidth: 160 }}>
              Point the phone’s camera here
            </Text>
          </View>
        ) : null}

        <View style={{ flex: 1, gap: space.sm }}>
          <View style={styles.rail} role="group" aria-label="Setup steps">
            {STEPS.map((s, i) => (
              <Button
                key={s.title}
                kind={i === step ? "primary" : "ghost"}
                size="sm"
                label={`${i + 1}. ${s.title}`}
                accessibilityHint={s.body}
                onPress={() => setStep(i)}
              />
            ))}
          </View>
          <View style={styles.stepCard} accessibilityLiveRegion="polite">
            <Text style={styles.stepNo}>
              Step {step + 1} of {STEPS.length}
            </Text>
            <Text variant="heading">{STEPS[step].title}</Text>
            <Text tone="secondary">{STEPS[step].body}</Text>
            {step < STEPS.length - 1 ? (
              <Button size="sm" label="Next step" onPress={() => setStep(step + 1)} style={{ alignSelf: "flex-start", marginTop: space.xs }} />
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.lg },
  headRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  code: { fontFamily: fonts.monoMedium, color: palette.ink, backgroundColor: palette.markerSoft },
  body: { gap: space.xl },
  qrBox: { alignItems: "center", gap: space.sm, padding: space.md, borderWidth: 1, borderColor: palette.rule, borderRadius: radius.md, alignSelf: "flex-start" },
  rail: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stepCard: { gap: 6, padding: space.lg, backgroundColor: palette.paper, borderRadius: radius.md, borderLeftWidth: 3, borderLeftColor: palette.marker },
  stepNo: { fontFamily: fonts.mono, fontSize: 11, color: palette.ink3, textTransform: "uppercase", letterSpacing: 0.4 },
});

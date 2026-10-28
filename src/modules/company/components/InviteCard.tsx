import { useState } from "react";
import { Platform, Share, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Button, Card, Text } from "@shared/ui";
import { environment } from "@config/env";

function joinLink(code: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.origin}/join/${code}`;
  return null;
}

/**
 * The company code, big enough to read out across a room, with copy and
 * share. Only rendered for owners and managers — the API sends nobody else
 * the code.
 */
export function InviteCard({ code, companyName }: { code: string; companyName: string }) {
  const [copied, setCopied] = useState(false);
  const link = joinLink(code);
  const message =
    `Join ${companyName} on ${environment.appName}.\n\n` +
    (link ? `Open ${link}\nor enter` : "Install the app and enter") +
    ` company code ${code}.`;

  async function copy() {
    await Clipboard.setStringAsync(link ?? code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    try {
      await Share.share({ message });
    } catch {
      await copy();
    }
  }

  return (
    <Card style={styles.card}>
      <Text variant="eyebrow" tone="tertiary">
        Your team joins with
      </Text>
      <View style={styles.cells} accessible accessibilityLabel={`Company code ${code.split("").join(" ")}`}>
        {code.split("").map((ch, i) => (
          <View key={i} style={[styles.cell, i === 2 && styles.gap]}>
            <Text style={styles.ch}>{ch}</Text>
          </View>
        ))}
      </View>
      <Text variant="caption" tone="secondary">
        Reps open the app, tap “Enter company code” and type this. They land in your team as reps.
      </Text>
      <View style={styles.actions}>
        <Button
          kind="primary"
          size="sm"
          label={copied ? "Copied" : link ? "Copy join link" : "Copy code"}
          onPress={copy}
          style={styles.btn}
        />
        <Button kind="ghost" size="sm" label="Share" onPress={share} style={styles.btn} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  cells: { flexDirection: "row", gap: 6, marginVertical: space.xs },
  cell: {
    width: 44,
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.ink,
    backgroundColor: palette.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  gap: { marginRight: 10 },
  ch: { fontFamily: fonts.monoMedium, fontSize: 24, color: palette.ink },
  actions: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  btn: { flexGrow: 1 },
});

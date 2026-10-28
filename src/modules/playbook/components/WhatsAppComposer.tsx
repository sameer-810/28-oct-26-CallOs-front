import { useState } from "react";
import { Linking, StyleSheet, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useAuthStore } from "@shared/store/useAuthStore";
import { firstName } from "@shared/format";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Button, Chip, Text } from "@shared/ui";
import { useWhatsAppTemplates } from "../hooks/usePlaybook";
import { fillTemplate, unfilled, whatsappUrl, whenVars } from "../fill";

/**
 * A follow-up message to the lead, from the company's templates: pick one,
 * it's filled in for this lead and this follow-up, change anything, then open
 * WhatsApp with it typed out — or copy it. Nothing is sent from here; the rep
 * presses send in WhatsApp, from their own number.
 */
export function WhatsAppComposer({ phone, contactName, followUpAt, tz }: { phone: string; contactName: string; followUpAt: string | null; tz: string }) {
  const user = useAuthStore((s) => s.user);
  const company = useAuthStore((s) => s.company);
  const templates = useWhatsAppTemplates();
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const all = [...(templates.data?.own ?? []), ...(templates.data?.builtIn ?? [])];
  const vars = { name: firstName(contactName), rep: firstName(user?.name), company: company?.name, ...whenVars(followUpAt, tz) };
  const left = unfilled(text);
  const canSend = /^\+?\d{8,15}$/.test(phone.replace(/\s/g, ""));

  function pick(id: string) {
    const t = all.find((x) => x.id === id);
    if (!t) return;
    setPicked(id);
    setText(fillTemplate(t.body, vars));
    setCopied(false);
  }

  return (
    <View style={styles.wrap}>
      <Text variant="label">Message on WhatsApp</Text>
      <View style={styles.chips} accessibilityRole="radiogroup" aria-label="WhatsApp templates">
        {all.map((t) => (
          <Chip key={t.id} role="radio" label={t.title} selected={picked === t.id} onPress={() => pick(t.id)} />
        ))}
        {templates.isLoading ? (
          <Text variant="caption" tone="tertiary">
            Loading templates…
          </Text>
        ) : null}
      </View>
      {picked ? (
        <>
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              setCopied(false);
            }}
            multiline
            maxLength={2000}
            accessibilityLabel="WhatsApp message"
            style={styles.message}
          />
          {left.length ? (
            <Text variant="caption" tone="missed">
              Replace {left.map((p) => `{${p}}`).join(" and ")} before sending — this call has no follow-up time set.
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button size="sm" label="Open WhatsApp" disabled={!canSend || left.length > 0 || !text.trim()} onPress={() => void Linking.openURL(whatsappUrl(phone, text.trim()))} />
            <Button
              kind="ghost"
              size="sm"
              label={copied ? "Copied" : "Copy"}
              disabled={!text.trim()}
              onPress={async () => {
                await Clipboard.setStringAsync(text.trim());
                setCopied(true);
              }}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  message: {
    minHeight: 112,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    borderRadius: radius.md,
    padding: space.md,
    fontFamily: fonts.text,
    fontSize: 15,
    lineHeight: 21,
    color: palette.ink,
    backgroundColor: palette.paper,
    textAlignVertical: "top",
  },
  actions: { flexDirection: "row", gap: space.sm },
});

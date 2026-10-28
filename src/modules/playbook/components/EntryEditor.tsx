import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { apiErrorMessage } from "@api/apiClient";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Chip, Sheet, Text, TextField } from "@shared/ui";
import { CATEGORIES, CATEGORY_LABEL, type EntryInput } from "../types";
import { useSaveEntry } from "../hooks/usePlaybook";
import { PLACEHOLDERS, unfilled } from "../fill";

/** Writes or rewrites one of the company's own scripts or messages. `id` set: editing it. */
export function EntryEditor({ initial, id, onClose }: { initial: EntryInput; id?: string; onClose: () => void }) {
  const [e, setE] = useState<EntryInput>(initial);
  const [cursor, setCursor] = useState(initial.body.length);
  const save = useSaveEntry(id);

  const insert = (p: string) => {
    const token = `{${p}}`;
    setE((x) => ({ ...x, body: x.body.slice(0, cursor) + token + x.body.slice(cursor) }));
    setCursor((c) => c + token.length);
  };
  const isScript = e.type === "script";
  const used = unfilled(e.body);

  return (
    <Sheet
      visible
      onClose={onClose}
      title={id ? `Edit ${isScript ? "script" : "message"}` : isScript ? "New call script" : "New WhatsApp message"}
      footer={<Button label={id ? "Save changes" : "Save"} disabled={e.title.trim().length < 2 || e.body.trim().length < 5} loading={save.isPending} onPress={() => save.mutate(e, { onSuccess: onClose })} />}
    >
      <View style={styles.block}>
        <Text variant="label">{isScript ? "Stage of the call" : "When it's sent"}</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {CATEGORIES[e.type].map((c) => (
            <Chip key={c} role="radio" label={CATEGORY_LABEL[c]} selected={e.category === c} onPress={() => setE((x) => ({ ...x, category: c }))} />
          ))}
        </View>
      </View>
      <TextField label="Title" value={e.title} onChangeText={(title) => setE((x) => ({ ...x, title }))} maxLength={80} placeholder={isScript ? "“Price is too high”" : "Site visit confirmation"} />
      <View style={styles.block}>
        <Text variant="label" nativeID="entry-body-label">
          {isScript ? "What to say" : "Message"}
        </Text>
        <TextInput
          value={e.body}
          onChangeText={(body) => setE((x) => ({ ...x, body }))}
          onSelectionChange={(ev) => setCursor(ev.nativeEvent.selection.start)}
          multiline
          maxLength={2000}
          aria-labelledby="entry-body-label"
          accessibilityLabel={isScript ? "What to say" : "Message"}
          style={styles.body}
        />
        <View style={styles.chips}>
          <Text variant="caption" tone="secondary">
            Insert:
          </Text>
          {PLACEHOLDERS.map((p) => (
            <Chip key={p} label={`{${p}}`} selected={used.includes(p)} onPress={() => insert(p)} />
          ))}
        </View>
        <Text variant="caption" tone="tertiary">
          {"{name}"} becomes the lead’s first name, {"{rep}"} whoever is sending, {"{date}"} and {"{time}"} the follow-up on the call.
        </Text>
      </View>
      {save.isError ? <Banner tone="error" message={apiErrorMessage(save.error)} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  body: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    borderRadius: radius.md,
    padding: space.md,
    fontFamily: fonts.text,
    fontSize: 15,
    lineHeight: 22,
    color: palette.ink,
    backgroundColor: palette.paper,
    textAlignVertical: "top",
  },
});

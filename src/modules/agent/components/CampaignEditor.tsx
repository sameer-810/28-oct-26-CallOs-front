import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Chip, Sheet, Text, TextField } from "@shared/ui";
import type { AgentSettings, Campaign, CampaignInput } from "../types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DEFAULT_AGENT: AgentSettings = {
  name: "Aisha",
  language: "hi-IN",
  goal: "",
  questions: ["What budget do you have in mind?", "When are you looking to buy?"],
  knowledge: "",
  greeting: "",
  transferNumber: null,
  callingHours: { start: "10:00", end: "19:00", days: [1, 2, 3, 4, 5, 6] },
};

function Area({ label, value, onChange, placeholder, hint, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; rows?: number }) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline
        placeholder={placeholder}
        placeholderTextColor={palette.ink3}
        style={[styles.area, { minHeight: rows * 22 }]}
      />
      {hint ? (
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Everything the agent needs to sound like your company, on one form. */
export function CampaignEditor({ initial, onSave, onClose, saving, error }: { initial?: Campaign; onSave: (c: CampaignInput) => void; onClose: () => void; saving: boolean; error?: string | null }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [a, setA] = useState<AgentSettings>(initial?.agent ?? DEFAULT_AGENT);
  const [questions, setQuestions] = useState((initial?.agent.questions ?? DEFAULT_AGENT.questions).join("\n"));
  const [concurrency, setConcurrency] = useState(initial?.concurrency ?? 2);
  const [maxAttempts, setMaxAttempts] = useState(initial?.maxAttempts ?? 3);
  const set = <K extends keyof AgentSettings>(k: K, v: AgentSettings[K]) => setA((x) => ({ ...x, [k]: v }));
  const transferOk = !a.transferNumber || /^\+[1-9]\d{7,14}$/.test(a.transferNumber);
  const valid = name.trim().length >= 2 && a.name.trim().length >= 2 && a.goal.trim().length > 0 && transferOk && a.callingHours.start < a.callingHours.end && a.callingHours.days.length > 0;

  return (
    <Sheet
      visible
      onClose={onClose}
      title={initial ? "Edit campaign" : "New AI campaign"}
      footer={
        <Button
          label={initial ? "Save campaign" : "Create campaign"}
          disabled={!valid}
          loading={saving}
          onPress={() =>
            onSave({
              name: name.trim(),
              agent: {
                ...a,
                name: a.name.trim(),
                goal: a.goal.trim(),
                greeting: a.greeting.trim(),
                knowledge: a.knowledge.trim(),
                transferNumber: a.transferNumber?.trim() || null,
                questions: questions.split("\n").map((q) => q.trim()).filter((q) => q.length >= 3).slice(0, 8),
              },
              concurrency,
              maxAttempts,
              retryAfterMin: initial?.retryAfterMin ?? 120,
            })
          }
        />
      }
    >
      {error ? <Banner tone="error" message={error} /> : null}
      <TextField label="Campaign name" value={name} onChangeText={setName} placeholder="Shela Heights — October enquiries" />

      <Text variant="eyebrow" tone="tertiary">
        The agent
      </Text>
      <TextField label="Agent's name" value={a.name} onChangeText={(v) => set("name", v)} hint="It says it's an AI assistant if anyone asks." />
      <View style={{ gap: 6 }}>
        <Text variant="label">Speaks</Text>
        <View style={styles.row}>
          <Chip role="radio" label="Hinglish" selected={a.language === "hi-IN"} onPress={() => set("language", "hi-IN")} />
          <Chip role="radio" label="English" selected={a.language === "en-IN"} onPress={() => set("language", "en-IN")} />
        </View>
      </View>
      <TextField label="Goal of the call" value={a.goal} onChangeText={(v) => set("goal", v)} placeholder="Book a site visit for Shela Heights this weekend" />
      <TextField label="Opening line" value={a.greeting} onChangeText={(v) => set("greeting", v)} placeholder="Namaste, main Aisha bol rahi hoon Sevagiri Realty se…" hint="Spoken the moment they pick up. Leave empty to let the agent open." />
      <Area label="Questions to ask" value={questions} onChange={setQuestions} placeholder={"One per line, up to 8"} hint="Asked naturally, not read out as a form. Answers are saved against each question." />
      <Area
        label="What it may say"
        value={a.knowledge}
        onChange={(v) => set("knowledge", v)}
        rows={6}
        placeholder="Prices, sizes, location, possession date, offers…"
        hint="The agent says only what is here. Anything else, it tells them a team member will confirm."
      />
      <TextField
        label="Transfer to (optional)"
        value={a.transferNumber ?? ""}
        onChangeText={(v) => set("transferNumber", v)}
        placeholder="+919876543210"
        keyboardType="phone-pad"
        hint="When a lead asks for a person, the call is put through to this number, recorded."
        error={transferOk ? undefined : "Use + and the country code"}
      />

      <Text variant="eyebrow" tone="tertiary">
        When it calls
      </Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <TextField label="From" value={a.callingHours.start} onChangeText={(v) => set("callingHours", { ...a.callingHours, start: v })} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Until" value={a.callingHours.end} onChangeText={(v) => set("callingHours", { ...a.callingHours, end: v })} />
        </View>
      </View>
      <View style={styles.row}>
        {DAYS.map((d, i) => (
          <Chip
            key={d}
            role="checkbox"
            label={d}
            selected={a.callingHours.days.includes(i)}
            onPress={() =>
              set("callingHours", {
                ...a.callingHours,
                days: a.callingHours.days.includes(i) ? a.callingHours.days.filter((x) => x !== i) : [...a.callingHours.days, i].sort(),
              })
            }
          />
        ))}
      </View>
      <View style={{ gap: 6 }}>
        <Text variant="label">Calls at once</Text>
        <View style={styles.row}>
          {[1, 2, 3, 5].map((n) => (
            <Chip key={n} role="radio" label={String(n)} selected={concurrency === n} onPress={() => setConcurrency(n)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text variant="label">Tries per lead</Text>
        <View style={styles.row}>
          {[1, 2, 3, 4].map((n) => (
            <Chip key={n} role="radio" label={String(n)} selected={maxAttempts === n} onPress={() => setMaxAttempts(n)} />
          ))}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  area: {
    borderWidth: 1,
    borderColor: palette.ruleStrong,
    borderRadius: radius.md,
    padding: space.md,
    fontFamily: fonts.text,
    fontSize: 15,
    color: palette.ink,
    backgroundColor: palette.card,
    textAlignVertical: "top",
  },
});

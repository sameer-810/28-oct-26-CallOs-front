import { useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { AppTabParamList } from "@navigation/types";
import { apiErrorMessage } from "@api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Card, Chip, ConfirmDialog, Screen, Segmented, Tag, Text, useBreakpoint } from "@shared/ui";
import { CATEGORIES, CATEGORY_LABEL, INDUSTRY_LABEL, type EntryInput, type EntryType, type Industry } from "../types";
import { useDeleteEntry, usePlaybook } from "../hooks/usePlaybook";
import { segments } from "../fill";
import { EntryEditor } from "../components/EntryEditor";

type Props = BottomTabScreenProps<AppTabParamList, "Playbook">;
type Shown = { key: string; id: string; own: boolean; type: EntryType; category: string; title: string; body: string };

/** Placeholders highlighted the way you'd mark a printed script: these words change per lead. */
function Body({ text }: { text: string }) {
  return (
    <Text style={styles.body}>
      {segments(text).map((s, i) =>
        s.placeholder ? (
          <Text key={i} style={styles.ph}>
            {s.text}
          </Text>
        ) : (
          s.text
        ),
      )}
    </Text>
  );
}

function EntryCard({ e, canEdit, onEdit, onAdopt, onDelete }: { e: Shown; canEdit: boolean; onEdit: () => void; onAdopt: () => void; onDelete: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <Tag label={CATEGORY_LABEL[e.category] ?? e.category} tone={e.own ? "ink" : "neutral"} />
        {e.own ? (
          <Text variant="caption" tone="tertiary">
            Your company’s
          </Text>
        ) : null}
      </View>
      <Text variant="heading">{e.title}</Text>
      <Body text={e.body} />
      <View style={styles.cardActions}>
        <Button
          kind="ghost"
          size="sm"
          label={copied ? "Copied" : "Copy"}
          onPress={async () => {
            await Clipboard.setStringAsync(e.body);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        />
        {canEdit && e.own ? (
          <>
            <Button kind="ghost" size="sm" label="Edit" onPress={onEdit} />
            <Button kind="quiet" size="sm" label="Delete" onPress={onDelete} />
          </>
        ) : null}
        {canEdit && !e.own ? <Button kind="quiet" size="sm" label="Make it ours" accessibilityHint="Copy into your company's scripts to reword it" onPress={onAdopt} /> : null}
      </View>
    </Card>
  );
}

/**
 * What to say: the company's own scripts and WhatsApp messages, and a library
 * for its industry to start from. Reps read and copy; owners and managers
 * write, and turn library entries into the company's own.
 */
export default function PlaybookScreen({ route }: Props) {
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === "owner" || role === "manager";
  const { isWide } = useBreakpoint();
  const [type, setType] = useState<EntryType>(route.params?.tab ?? "script");
  const [industry, setIndustry] = useState<Industry | undefined>(undefined);
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<{ initial: EntryInput; id?: string } | null>(null);
  const [deleting, setDeleting] = useState<Shown | null>(null);

  const book = usePlaybook(type, industry);
  const remove = useDeleteEntry();

  const current = book.data?.industry;
  const own: Shown[] = (book.data?.own ?? []).map((e) => ({ ...e, key: `own-${e.id}`, own: true }));
  const lib: Shown[] = (book.data?.builtIn ?? []).map((e) => ({ ...e, key: `lib-${e.id}`, own: false }));
  const pass = (e: Shown) => !category || e.category === category;
  const blank: EntryInput = { type, category: category || CATEGORIES[type][0], title: "", body: "" };

  const card = (e: Shown) => (
    <View key={e.key} style={isWide ? styles.half : styles.full}>
      <EntryCard
        e={e}
        canEdit={canEdit}
        onEdit={() => setEditing({ initial: { type: e.type, category: e.category, title: e.title, body: e.body }, id: e.id })}
        onAdopt={() => setEditing({ initial: { type: e.type, category: e.category, title: e.title, body: e.body } })}
        onDelete={() => setDeleting(e)}
      />
    </View>
  );

  return (
    <Screen>
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text variant="eyebrow" tone="tertiary">
            Scripts
          </Text>
          <Text variant="display" style={{ marginTop: 6 }}>
            What to say
          </Text>
          <Text tone="secondary" style={{ marginTop: 6, maxWidth: 560 }}>
            Openings, the questions to ask, answers to the objections you hear every day, and WhatsApp messages that fill in the lead’s name.
          </Text>
        </View>
        {canEdit ? <Button label={type === "script" ? "New script" : "New message"} onPress={() => setEditing({ initial: blank })} /> : null}
      </View>

      <View style={{ marginTop: space.xl, gap: space.md }}>
        <Segmented
          label="Kind"
          value={type}
          onChange={(t) => {
            setType(t);
            setCategory("");
          }}
          items={[
            { id: "script", label: "Call scripts" },
            { id: "whatsapp", label: "WhatsApp messages" },
          ]}
        />
        <View style={styles.chips} accessibilityRole="radiogroup" aria-label="Industry">
          {(book.data?.industries ?? []).map((ind) => (
            <Chip
              key={ind}
              role="radio"
              label={`${INDUSTRY_LABEL[ind]}${ind === book.data?.companyLibrary ? " · yours" : ""}`}
              selected={current === ind}
              onPress={() => setIndustry(ind)}
            />
          ))}
        </View>
        <View style={styles.chips} accessibilityRole="radiogroup" aria-label="Stage">
          <Chip role="radio" label="All" selected={!category} onPress={() => setCategory("")} />
          {CATEGORIES[type].map((c) => (
            <Chip key={c} role="radio" label={CATEGORY_LABEL[c]} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
      </View>

      {book.isError ? <Banner tone="error" message={apiErrorMessage(book.error)} /> : null}

      {own.filter(pass).length ? (
        <View style={styles.section}>
          <Text variant="label">Your company’s</Text>
          <View style={styles.grid}>{own.filter(pass).map(card)}</View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="label">
          Library{current ? ` · ${INDUSTRY_LABEL[current]}` : ""}
        </Text>
        <Text variant="caption" tone="tertiary">
          Starting points, written the way Indian sales teams talk. {canEdit ? "“Make it ours” copies one so you can reword it for your product." : "Your manager can add the company’s own."}
        </Text>
        {book.isLoading ? (
          <Text variant="caption" tone="tertiary" style={{ marginTop: space.md }}>
            Loading scripts…
          </Text>
        ) : null}
        <View style={styles.grid}>{lib.filter(pass).map(card)}</View>
      </View>

      {editing ? <EntryEditor key={editing.id ?? "new"} initial={editing.initial} id={editing.id} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        visible={Boolean(deleting)}
        title="Delete this?"
        message={`“${deleting?.title ?? ""}” will be gone for the whole team.`}
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.lg, flexWrap: "wrap" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  section: { marginTop: space.xl, gap: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -space.sm / 2, marginTop: space.xs },
  half: { width: "50%", padding: space.sm / 2 },
  full: { width: "100%", paddingHorizontal: space.sm / 2 },
  card: { gap: space.sm, marginBottom: space.sm },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  cardActions: { flexDirection: "row", gap: space.xs, flexWrap: "wrap", marginTop: space.xs },
  body: { fontFamily: fonts.text, fontSize: 15, lineHeight: 23, color: palette.ink2 },
  ph: { fontFamily: fonts.textMedium, color: palette.ink, backgroundColor: palette.markerSoft, borderRadius: radius.sm },
});

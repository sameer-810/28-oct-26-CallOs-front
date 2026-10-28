import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { apiErrorMessage } from "@api/apiClient";
import { downloadExport } from "@api/download";
import { useAuthStore } from "@shared/store/useAuthStore";
import { useRefreshOnFocus } from "@shared/hooks/useRefreshOnFocus";
import { dateTimeIn, formatPhone, num } from "@shared/format";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Card, Chip, EmptyState, Screen, Tag, Text, useBreakpoint, type PressState } from "@shared/ui";
import { OUTCOME_LABEL, type Campaign, type Lead, type Outcome } from "../types";
import { useCampaigns, useImportLeads, useLeads, useRunCampaign, useSaveCampaign } from "../hooks/useCampaigns";
import { CampaignEditor } from "../components/CampaignEditor";

const OUTCOME_COLOR: Partial<Record<Outcome, string>> = {
  booked: palette.connected,
  qualified: "#4C8A62",
  transferred: "#2F5D8A",
  callback: palette.marker,
  not_interested: palette.ruleStrong,
  no_answer: palette.paper2,
  do_not_call: palette.missed,
  wrong_number: palette.ink3,
  failed: palette.missed,
};
const STATUS: Record<Campaign["status"], { label: string; tone: "ink" | "connected" | "neutral" | "dashed" }> = {
  draft: { label: "Draft", tone: "dashed" },
  running: { label: "Calling", tone: "connected" },
  paused: { label: "Paused", tone: "neutral" },
  done: { label: "Finished", tone: "ink" },
};

/** One bar: every lead, coloured by how its call ended. Grey is still to call. */
function Progress({ c }: { c: Campaign }) {
  const parts = (Object.keys(OUTCOME_COLOR) as Outcome[]).map((o) => ({ o, n: c.stats.outcomes[o] ?? 0 })).filter((p) => p.n > 0);
  const left = c.stats.total - parts.reduce((a, p) => a + p.n, 0);
  return (
    <View style={styles.progress} accessible accessibilityLabel={`${c.stats.done} of ${c.stats.total} leads done`}>
      {parts.map((p) => (
        <View key={p.o} style={{ flex: p.n, backgroundColor: OUTCOME_COLOR[p.o] }} />
      ))}
      {left > 0 ? <View style={{ flex: left, backgroundColor: palette.rule }} /> : null}
    </View>
  );
}

function LeadRow({ l, tz }: { l: Lead; tz: string }) {
  const [open, setOpen] = useState(false);
  const answers = Object.entries(l.answers ?? {});
  return (
    <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" aria-expanded={open} style={({ hovered }: PressState) => [styles.lead, hovered && { backgroundColor: palette.paper }]}>
      <View style={styles.leadTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyMedium" numberOfLines={1}>
            {l.name || formatPhone(l.phone)}
          </Text>
          <Text variant="mono" tone="tertiary" style={{ fontSize: 11.5 }}>
            {formatPhone(l.phone)} · {l.attempts} tr{l.attempts === 1 ? "y" : "ies"}
          </Text>
        </View>
        {l.state === "calling" ? <Tag label="On a call" tone="connected" /> : l.outcome ? <Tag label={OUTCOME_LABEL[l.outcome]} tone={l.outcome === "booked" ? "connected" : l.outcome === "do_not_call" ? "missed" : "neutral"} /> : <Tag label="To call" tone="dashed" />}
      </View>
      {l.bookedAt ? (
        <Text variant="caption" tone="connected">
          Booked for {dateTimeIn(l.bookedAt, tz)}
        </Text>
      ) : null}
      {open ? (
        <View style={{ gap: 4, marginTop: 4 }}>
          {l.summary ? <Text variant="caption">{l.summary}</Text> : null}
          {answers.map(([q, a]) => (
            <Text key={q} variant="caption" tone="secondary">
              <Text variant="label">{q} </Text>
              {a}
            </Text>
          ))}
          {l.notes ? (
            <Text variant="caption" tone="tertiary">
              From the list: {l.notes}
            </Text>
          ) : null}
          {l.nextAttemptAt && l.state === "pending" ? (
            <Text variant="caption" tone="tertiary">
              Next try {dateTimeIn(l.nextAttemptAt, tz)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function CampaignDetail({ c, ready, onBack, onEdit }: { c: Campaign; ready: boolean; onBack: () => void; onEdit: () => void }) {
  const tz = useAuthStore((s) => s.company?.timezone ?? "Asia/Kolkata");
  const [filter, setFilter] = useState<Outcome | "">("");
  const leads = useLeads(c);
  const run = useRunCampaign(c);
  const imp = useImportLeads(c.id);

  async function pick() {
    const r = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] });
    if (!r.canceled && r.assets[0]) imp.mutate(r.assets[0]);
  }

  const shown = (leads.data ?? []).filter((l) => !filter || l.outcome === filter);
  const err = run.error ?? imp.error;

  return (
    <View style={{ gap: space.lg }}>
      <Button kind="quiet" size="sm" label="‹ All campaigns" onPress={onBack} style={{ alignSelf: "flex-start" }} />
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Tag label={STATUS[c.status].label} tone={STATUS[c.status].tone} />
          <Text variant="title" style={{ marginTop: 8 }}>
            {c.name}
          </Text>
          <Text variant="caption" tone="secondary">
            {c.agent.name} · {c.agent.language === "hi-IN" ? "Hinglish" : "English"} · calls {c.agent.callingHours.start}–{c.agent.callingHours.end} · {c.concurrency} at a time
          </Text>
        </View>
        <View style={styles.actions}>
          <Button kind="ghost" size="sm" label="Edit" onPress={onEdit} />
          {c.status !== "done" ? (
            <Button size="sm" label={c.status === "running" ? "Pause" : "Start calling"} disabled={c.status !== "running" && !ready} loading={run.isPending} onPress={() => run.mutate()} />
          ) : null}
        </View>
      </View>

      {err ? <Banner tone="error" message={apiErrorMessage(err)} /> : null}
      {imp.data ? (
        <Banner tone="success" message={`${imp.data.added} leads added${imp.data.duplicates ? `, ${imp.data.duplicates} already in the list` : ""}${imp.data.skippedExcluded ? `, ${imp.data.skippedExcluded} on the excluded list left out` : ""}${imp.data.invalidCount ? `, ${imp.data.invalidCount} row${imp.data.invalidCount === 1 ? " wasn't a phone number" : "s weren't phone numbers"}` : ""}.`} />
      ) : null}

      <Card style={{ gap: space.md }}>
        <View style={styles.statRow}>
          <View>
            <Text style={styles.big}>{num(c.stats.done)}</Text>
            <Text variant="caption" tone="tertiary">
              of {num(c.stats.total)} leads done
            </Text>
          </View>
          <View>
            <Text style={[styles.big, { color: palette.connected }]}>{num(c.stats.outcomes.booked)}</Text>
            <Text variant="caption" tone="tertiary">
              booked
            </Text>
          </View>
          <View>
            <Text style={styles.big}>{num(c.stats.outcomes.transferred)}</Text>
            <Text variant="caption" tone="tertiary">
              sent to a person
            </Text>
          </View>
        </View>
        <Progress c={c} />
        <View style={styles.chips}>
          <Chip label="All" selected={!filter} onPress={() => setFilter("")} />
          {(Object.keys(OUTCOME_LABEL) as Outcome[])
            .filter((o) => c.stats.outcomes[o])
            .map((o) => (
              <Chip key={o} label={`${OUTCOME_LABEL[o]} ${c.stats.outcomes[o]}`} selected={filter === o} onPress={() => setFilter(o)} />
            ))}
        </View>
      </Card>

      <View style={styles.headRow}>
        <Text variant="heading" style={{ flex: 1 }}>
          Leads
        </Text>
        <Button kind="quiet" size="sm" label="Sample file" onPress={() => downloadExport("/campaigns/sample.xlsx", {}, "leads-sample.xlsx")} />
        <Button kind="ghost" size="sm" label="Add leads (CSV / Excel)" loading={imp.isPending} onPress={pick} />
      </View>
      <Card padded={false}>
        {leads.isLoading ? (
          <View style={{ padding: space.xl, alignItems: "center" }}>
            <ActivityIndicator color={palette.ink} />
          </View>
        ) : shown.length ? (
          shown.map((l) => <LeadRow key={l.id} l={l} tz={tz} />)
        ) : (
          <EmptyState icon="team" title="No leads yet" body="Upload a CSV or Excel file with a Phone column, and Name and Notes if you have them." />
        )}
      </Card>
    </View>
  );
}

export default function AgentScreen() {
  const { isWide } = useBreakpoint();
  const q = useCampaigns();
  useRefreshOnFocus(q.refetch);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const save = useSaveCampaign(editing && editing !== "new" ? editing.id : null);
  const current = q.data?.items.find((c) => c.id === selected);

  return (
    <Screen>
      <Text variant="eyebrow" tone="tertiary">
        First-round calls, done by AI
      </Text>
      <View style={styles.headRow}>
        <Text variant="display" style={{ marginTop: 6, flex: 1 }}>
          AI agent
        </Text>
        {!current ? <Button label="New campaign" onPress={() => setEditing("new")} /> : null}
      </View>

      {q.data && !q.data.ready ? (
        <View style={{ marginTop: space.lg }}>
          <Banner
            tone="info"
            title="Set up, not switched on yet"
            message="The agent needs a Twilio number with a public API address, and a Claude API key. You can build campaigns and upload leads now; calling starts once those are in. See docs/AI_AGENT.md."
          />
        </View>
      ) : null}

      <View style={{ marginTop: space.xl }}>
        {q.isLoading ? (
          <ActivityIndicator color={palette.ink} />
        ) : current ? (
          <CampaignDetail c={current} ready={Boolean(q.data?.ready)} onBack={() => setSelected(null)} onEdit={() => setEditing(current)} />
        ) : q.data?.items.length ? (
          <View style={[styles.grid, isWide && styles.gridWide]}>
            {q.data.items.map((c) => (
              <Pressable key={c.id} onPress={() => setSelected(c.id)} accessibilityRole="button" accessibilityLabel={`${c.name}, ${STATUS[c.status].label}`} style={({ hovered }: PressState) => [styles.card, hovered && { borderColor: palette.ink }, isWide && { width: "48.5%" }]}>
                <View style={styles.headRow}>
                  <Tag label={STATUS[c.status].label} tone={STATUS[c.status].tone} />
                  <Text variant="mono" tone="tertiary" style={{ fontSize: 11 }}>
                    {c.stats.done}/{c.stats.total}
                  </Text>
                </View>
                <Text variant="heading">{c.name}</Text>
                <Text variant="caption" tone="secondary" numberOfLines={2}>
                  {c.agent.goal}
                </Text>
                <Progress c={c} />
                <Text variant="caption" tone="tertiary">
                  {c.stats.outcomes.booked} booked · {c.stats.outcomes.transferred} sent to a person · {c.stats.outcomes.not_interested} not interested
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Card>
            <EmptyState
              icon="spark"
              title="No campaigns yet"
              body="Give the agent a goal, what it may say and a list of leads. It calls inside your hours, books visits, and hands hot leads to your team mid-call."
              action={<Button label="New campaign" onPress={() => setEditing("new")} />}
            />
          </Card>
        )}
      </View>

      {editing ? (
        <CampaignEditor initial={editing === "new" ? undefined : editing} saving={save.isPending} error={save.error ? apiErrorMessage(save.error) : null} onSave={(input) =>
            save.mutate(input, {
              onSuccess: (c) => {
                setEditing(null);
                setSelected(c.id);
              },
            })
          } onClose={() => setEditing(null)} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", gap: space.md, flexWrap: "wrap" },
  actions: { flexDirection: "row", gap: space.sm },
  grid: { gap: space.md },
  gridWide: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.ruleStrong, backgroundColor: palette.card },
  progress: { flexDirection: "row", height: 10, borderRadius: 3, overflow: "hidden", gap: 1, backgroundColor: palette.rule },
  statRow: { flexDirection: "row", gap: space.xxl, flexWrap: "wrap" },
  big: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: palette.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  lead: { paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: palette.rule, gap: 2 },
  leadTop: { flexDirection: "row", alignItems: "center", gap: space.md },
});

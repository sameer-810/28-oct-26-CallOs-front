import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { apiErrorMessage } from "@api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { clock, dateTimeIn, formatPhone, num } from "@shared/format";
import { fonts, palette, space } from "@shared/designSystem";
import { Banner, Button, Card, Chip, EmptyState, Text, TONE_COLOR } from "@shared/ui";
import { Table, type Column } from "@shared/ui/Table";
import { CallGlyph } from "@shared/ui/CallGlyph";
import { useCalls, useTranscribeCall } from "../hooks/useCalls";
import { useCallsView } from "../callsView";
import { CallDetail } from "./CallDetail";
import {
  DEAL_LABEL,
  PAGE_SIZES,
  SOURCE_LABEL,
  TRANSCRIPT_LABEL,
  TYPE_LABEL,
  isConnected,
  type Call,
  type CallColumn,
} from "../types";

const COLUMN_LABEL: Record<CallColumn, string> = {
  date: "Date",
  type: "Type",
  phone: "Phone",
  contact: "Contact",
  employee: "Employee",
  duration: "Duration",
  source: "Source",
  device: "Device",
  recording: "Recording",
  status: "Status",
  followUp: "Follow-up",
  notes: "Notes",
  deal: "Deal",
  score: "Score",
};
/** Without these a row isn't a call you can recognise. */
const ALWAYS: CallColumn[] = ["date", "phone"];
const ORDER = Object.keys(COLUMN_LABEL) as CallColumn[];

const RECORDING_LABEL = { uploaded: "Recorded", pending: "Uploading", failed: "Not found", none: "—" } as const;

/**
 * The call log as a table, for a laptop: the columns callos-style teams are
 * used to, chosen per person, a page at a time. Opens the same call sheet as
 * the list. Used by Calls (table view) and Reports → Call history.
 */
export function CallHistory({
  params,
  onOpen,
  showEmployee = true,
}: {
  /** The filters; paging is this table's own. */
  params: Record<string, string | number | undefined>;
  /** Given: the screen opens the call. Not given: this table does. */
  onOpen?: (c: Call) => void;
  showEmployee?: boolean;
}) {
  const company = useAuthStore((s) => s.company);
  const tz = company?.timezone ?? "Asia/Kolkata";
  const tone = (key: string | null) => company?.dispositions.find((d) => d.key === key)?.tone;
  const { columns: chosen, pageSize, toggleColumn, setPageSize, resetColumns } = useCallsView();
  const [page, setPage] = useState(1);
  const [choosing, setChoosing] = useState(false);
  const [open, setOpen] = useState<Call | null>(null);
  // a new filter starts again at page one
  const [lastKey, setLastKey] = useState("");
  const key = JSON.stringify(params);
  if (key !== lastKey) {
    setLastKey(key);
    if (page !== 1) setPage(1);
  }

  const calls = useCalls({ ...params, page, limit: pageSize });
  const transcribe = useTranscribeCall();
  const openCall = onOpen ?? setOpen;

  const defs: Record<CallColumn, Column<Call>> = {
    date: { key: "date", label: "Date", width: 150, render: (c) => dateTimeIn(c.startedAt, tz) },
    type: {
      key: "type",
      label: "Type",
      width: 112,
      render: (c) => (
        <View style={styles.inline}>
          <CallGlyph type={c.type} size={14} />
          <Text style={styles.cell}>{TYPE_LABEL[c.type]}</Text>
        </View>
      ),
    },
    phone: { key: "phone", label: "Phone", width: 140, render: (c) => <Text style={styles.mono}>{formatPhone(c.phone)}</Text> },
    contact: { key: "contact", label: "Contact", width: 150, render: (c) => c.contactName || "—" },
    employee: { key: "employee", label: "Employee", width: 130, render: (c) => c.employee ?? "—" },
    duration: { key: "duration", label: "Duration", width: 84, align: "right", render: (c) => (isConnected(c) ? clock(c.durationSec) : "—") },
    source: { key: "source", label: "Source", width: 96, render: (c) => (c.source === "phone" ? c.simLabel || "Phone" : SOURCE_LABEL[c.source]) },
    device: { key: "device", label: "Device", width: 130, render: (c) => c.device ?? "—" },
    recording: {
      key: "recording",
      label: "Recording",
      width: 168,
      render: (c) =>
        c.recording.status === "uploaded" && (c.transcriptStatus === "none" || c.transcriptStatus === "failed") ? (
          <View style={styles.inline}>
            <Text style={styles.cell}>Recorded</Text>
            <Button
              kind="quiet"
              size="sm"
              label="Transcribe"
              accessibilityHint={`Transcribe the call with ${c.contactName || formatPhone(c.phone)}`}
              loading={transcribe.isPending && transcribe.variables === c.id}
              onPress={() => transcribe.mutate(c.id)}
            />
          </View>
        ) : (
          <Text style={[styles.cell, c.recording.status === "none" && { color: palette.ink3 }]} numberOfLines={1}>
            {RECORDING_LABEL[c.recording.status]}
            {c.recording.status === "uploaded" ? ` · ${TRANSCRIPT_LABEL[c.transcriptStatus]}` : ""}
          </Text>
        ),
    },
    status: {
      key: "status",
      label: "Status",
      width: 120,
      render: (c) =>
        c.leadStatusLabel ? (
          <View style={styles.inline}>
            <View style={[styles.dot, { backgroundColor: TONE_COLOR[tone(c.leadStatus) ?? "neutral"] ?? palette.ink3 }]} />
            <Text style={styles.cell} numberOfLines={1}>
              {c.leadStatusLabel}
            </Text>
          </View>
        ) : (
          "—"
        ),
    },
    followUp: {
      key: "followUp",
      label: "Follow-up",
      width: 140,
      render: (c) => (c.followUpAt ? `${c.followUpDone ? "Done · " : ""}${dateTimeIn(c.followUpAt, tz)}` : "—"),
    },
    notes: { key: "notes", label: "Notes", width: 200, render: (c) => c.notes || "—" },
    deal: { key: "deal", label: "Deal", width: 100, render: (c) => (c.dealStatus ? DEAL_LABEL[c.dealStatus] : "—") },
    score: { key: "score", label: "Score", width: 64, align: "right", render: (c) => (c.score === null ? "—" : String(c.score)) },
  };

  const visible = ORDER.filter((k) => ALWAYS.includes(k) || chosen.includes(k)).filter((k) => showEmployee || k !== "employee");
  const total = calls.data?.total ?? 0;
  const pages = calls.data?.pages ?? 1;

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.toolbar}>
        <Text variant="mono" tone="tertiary">
          {calls.isFetching && !calls.isLoading ? "Updating… " : ""}
          {num(total)} call{total === 1 ? "" : "s"}
        </Text>
        <View style={styles.inline}>
          <Text variant="caption" tone="secondary">
            Per page
          </Text>
          <View style={styles.inline} accessibilityRole="radiogroup" aria-label="Calls per page">
            {PAGE_SIZES.map((n) => (
              <Chip key={n} role="radio" label={String(n)} selected={pageSize === n} onPress={() => setPageSize(n)} />
            ))}
          </View>
          <Button kind="ghost" size="sm" label={choosing ? "Done" : "Columns"} onPress={() => setChoosing((x) => !x)} />
        </View>
      </View>

      {choosing ? (
        <Card style={{ gap: space.sm }}>
          <Text variant="label">Show these columns</Text>
          <View style={styles.chips}>
            {ORDER.filter((k) => !ALWAYS.includes(k) && (showEmployee || k !== "employee")).map((k) => (
              <Chip key={k} role="checkbox" label={COLUMN_LABEL[k]} selected={chosen.includes(k)} onPress={() => toggleColumn(k)} />
            ))}
          </View>
          <Button kind="quiet" size="sm" label="Reset columns" onPress={resetColumns} style={{ alignSelf: "flex-start" }} />
        </Card>
      ) : null}

      {transcribe.isError ? <Banner tone="error" message={apiErrorMessage(transcribe.error)} /> : null}

      <Card padded={false} style={{ overflow: "hidden" }}>
        {calls.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.ink} />
          </View>
        ) : calls.isError ? (
          <EmptyState title="Couldn't load calls" body={apiErrorMessage(calls.error)} action={<Button size="sm" kind="ghost" label="Try again" onPress={() => calls.refetch()} />} />
        ) : !total ? (
          <EmptyState title="No calls match" body="Try a wider date range or clear a filter." />
        ) : (
          <Table
            columns={visible.map((k) => defs[k])}
            rows={calls.data?.items ?? []}
            rowKey={(c) => c.id}
            onRowPress={openCall}
            rowLabel={(c) => `${TYPE_LABEL[c.type]} call, ${c.contactName || formatPhone(c.phone)}, ${dateTimeIn(c.startedAt, tz)}`}
          />
        )}
      </Card>

      {pages > 1 ? (
        <View style={styles.pager}>
          <Button kind="ghost" size="sm" label="‹ Previous" disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))} />
          <Text variant="mono" tone="secondary" accessibilityLiveRegion="polite">
            Page {page} of {pages}
          </Text>
          <Button kind="ghost" size="sm" label="Next ›" disabled={page >= pages} onPress={() => setPage((p) => Math.min(pages, p + 1))} />
        </View>
      ) : null}

      {!onOpen && open ? <CallDetail key={open.id} call={open} onClose={() => setOpen(null)} onShowClient={() => setOpen(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.md, flexWrap: "wrap" },
  inline: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cell: { fontFamily: fonts.text, fontSize: 13.5, color: palette.ink },
  mono: { fontFamily: fonts.mono, fontSize: 13, color: palette.ink },
  dot: { width: 8, height: 8, borderRadius: 4 },
  center: { padding: 48, alignItems: "center" },
  pager: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.lg },
});

import { Fragment, useEffect, useMemo, useState } from "react";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { AppTabParamList } from "@navigation/types";
import { syncNow } from "@modules/device/syncEngine";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { apiErrorMessage } from "@api/apiClient";
import { downloadExport } from "@api/download";
import { useAuthStore } from "@shared/store/useAuthStore";
import { useFilterParams } from "@shared/store/useFilters";
import { useRefreshOnFocus } from "@shared/hooks/useRefreshOnFocus";
import { dayLabel, num } from "@shared/format";
import { palette, space } from "@shared/designSystem";
import { Banner, Button, Card, Chip, EmptyState, RangeBar, Screen, Segmented, Text, TextField, useBreakpoint } from "@shared/ui";
import { useCallFetchers, useCalls } from "../hooks/useCalls";
import { CallRow } from "../components/CallRow";
import { CallDetail } from "../components/CallDetail";
import { CallHistory } from "../components/CallHistory";
import { useCallsView } from "../callsView";
import { SOURCE_LABEL, type Call, type CallSource, type CallType } from "../types";

const TYPES: { id: CallType | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "outgoing", label: "Outgoing" },
  { id: "incoming", label: "Incoming" },
  { id: "missed", label: "Missed" },
  { id: "rejected", label: "Rejected" },
  { id: "blocked", label: "Blocked" },
];
const SOURCES: CallSource[] = ["phone", "whatsapp", "cloud", "ai"];
/** Recorded calls, and among them the ones still waiting for a transcript. */
type RecordingFilter = "" | "recorded" | "untranscribed";

const PAGE = 50;

type Props = BottomTabScreenProps<AppTabParamList, "Calls">;

export default function CallsScreen({ route, navigation }: Props) {
  const company = useAuthStore((s) => s.company);
  const role = useAuthStore((s) => s.user?.role);
  const { isWide } = useBreakpoint();
  const filters = useFilterParams();
  const [type, setType] = useState<CallType | "all">("all");
  const [status, setStatus] = useState<string>("");
  const [review, setReview] = useState<"" | "reviewed" | "worst">("");
  const [source, setSource] = useState<CallSource | "">("");
  const [recording, setRecording] = useState<RecordingFilter>("");
  const view = useCallsView((s) => s.view);
  const setView = useCallsView((s) => s.setView);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Call | null>(null);
  /** Set when a notification opened the call: where to start, which comment. */
  const [openFrom, setOpenFrom] = useState<{ at: number | null; comment: string | null; n: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);

  const manager = role === "owner" || role === "manager";
  const tz = company?.timezone ?? "Asia/Kolkata";
  const dispositions = company?.dispositions ?? [];

  const base = {
    ...filters,
    ...(type !== "all" ? { types: type } : {}),
    ...(source ? { sources: source } : {}),
    ...(recording === "recorded" ? { recorded: "true" } : recording === "untranscribed" ? { recorded: "true", transcript: "none,failed" } : {}),
    ...(status ? { leadStatus: status } : {}),
    ...(review === "reviewed" ? { transcribed: "true" } : review === "worst" ? { sort: "lowest_score" } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  };
  const params = { ...base, limit };
  const asTable = isWide && view === "table";
  // the table pages on its own; the list query rests while it's showing
  const calls = useCalls(params, !asTable);
  useRefreshOnFocus(calls.refetch);
  const fetchers = useCallFetchers();
  const me = useAuthStore((s) => s.user?.id);

  // the after-call notification: send the call that just ended, then open it for a status
  const afterCall = route.params?.afterCall;
  useEffect(() => {
    if (!afterCall || !me) return;
    let alive = true;
    (async () => {
      await syncNow().catch(() => null);
      const latest = await fetchers.latestOf(me).catch(() => null);
      if (alive && latest) setOpen(latest);
    })();
    return () => {
      alive = false;
    };
  }, [afterCall, me, fetchers]);

  // a comment notification: open that call, at that moment, with the comment marked
  const openId = route.params?.open;
  const openAt = route.params?.at;
  const openComment = route.params?.c;
  useEffect(() => {
    if (!openId) return;
    let alive = true;
    (async () => {
      const call = await fetchers.byId(openId).catch(() => null);
      if (!alive || !call) return;
      const at = openAt != null && openAt !== "" && Number.isFinite(Number(openAt)) ? Number(openAt) : null;
      setOpenFrom((p) => ({ at, comment: openComment ?? null, n: (p?.n ?? 0) + 1 }));
      setOpen(call);
      // handled; tapping the same notification again opens it again
      navigation.setParams({ open: undefined, at: undefined, c: undefined });
    })();
    return () => {
      alive = false;
    };
  }, [openId, openAt, openComment, navigation, fetchers]);

  // a phone's call log groups by day; so does this, when the range spans days
  const grouped = useMemo(() => {
    const items = calls.data?.items ?? [];
    const out: { key: string; calls: Call[] }[] = [];
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    for (const c of items) {
      const key = fmt.format(new Date(c.startedAt));
      if (out.at(-1)?.key !== key) out.push({ key, calls: [] });
      out.at(-1)!.calls.push(c);
    }
    return out;
  }, [calls.data, tz]);

  async function exportXlsx() {
    setExporting(true);
    setExportError(null);
    try {
      const { limit: _l, ...q } = params;
      await downloadExport("/calls/export.xlsx", q, `calls-${filters.range}.xlsx`);
    } catch (e) {
      setExportError(e);
    } finally {
      setExporting(false);
    }
  }

  const total = calls.data?.total ?? 0;

  return (
    <Screen>
      <View style={styles.head}>
        <View>
          <Text variant="eyebrow" tone="tertiary">
            {manager ? "Everyone's calls" : "Your calls"}
          </Text>
          <Text variant="display" style={{ marginTop: 6 }}>
            Calls
          </Text>
        </View>
        <View style={styles.headActions}>
          {isWide ? (
            <Segmented
              label="Layout"
              value={view}
              onChange={setView}
              items={[
                { id: "list", label: "List" },
                { id: "table", label: "Table" },
              ]}
            />
          ) : null}
          <Button kind="ghost" size="sm" label="Export to Excel" loading={exporting} onPress={exportXlsx} />
        </View>
      </View>

      <View style={styles.filters}>
        <RangeBar />
        <View style={[styles.searchRow, isWide && { flexDirection: "row", alignItems: "flex-end" }]}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Search"
              placeholder="Name, number or a word from the notes"
              value={search}
              onChangeText={(v) => {
                setSearch(v);
                setLimit(PAGE);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
        {(() => {
          const types = TYPES.map((t) => (
            <Chip key={t.id} label={t.label} selected={type === t.id} onPress={() => { setType(t.id); setLimit(PAGE); }} />
          ));
          const statuses = [
            <Chip key="any" label="Any status" selected={!status} onPress={() => setStatus("")} />,
            <Chip key="none" label="No status yet" selected={status === "none"} onPress={() => setStatus("none")} />,
            <Chip key="reviewed" label="AI-reviewed" selected={review === "reviewed"} onPress={() => setReview(review === "reviewed" ? "" : "reviewed")} />,
            <Chip key="worst" label="Lowest score first" selected={review === "worst"} onPress={() => setReview(review === "worst" ? "" : "worst")} />,
            ...dispositions.map((d) => (
              <Chip key={d.key} label={d.label} tone={d.tone} selected={status === d.key} onPress={() => setStatus(d.key)} />
            )),
          ];
          const sources = [
            <Chip key="any-source" label="Any source" selected={!source} onPress={() => setSource("")} />,
            ...SOURCES.map((s) => <Chip key={s} label={SOURCE_LABEL[s]} selected={source === s} onPress={() => { setSource(s); setLimit(PAGE); }} />),
            <View key="sep" style={styles.sep} />,
            <Chip key="recorded" label="Recorded" selected={recording === "recorded"} onPress={() => setRecording(recording === "recorded" ? "" : "recorded")} />,
            <Chip key="untranscribed" label="Not transcribed yet" selected={recording === "untranscribed"} onPress={() => setRecording(recording === "untranscribed" ? "" : "untranscribed")} />,
          ];
          // a phone gets one sideways row each, so the calls start above the fold
          return isWide ? (
            <>
              <View style={styles.chipRow}>
                {types}
                <View style={styles.sep} />
                {statuses}
              </View>
              <View style={styles.chipRow}>{sources}</View>
            </>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                {types}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                {statuses}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                {sources}
              </ScrollView>
            </>
          );
        })()}
      </View>

      {exportError ? <Banner tone="error" message={apiErrorMessage(exportError, "The export didn't download. Try again.")} /> : null}

      {asTable ? (
        <View style={{ marginTop: space.lg }}>
          <CallHistory params={base} onOpen={setOpen} showEmployee={manager} />
        </View>
      ) : (
      <>
      <View style={styles.countRow}>
        <Text variant="mono" tone="tertiary">
          {calls.isFetching && !calls.isLoading ? "Updating… " : ""}
          {num(total)} call{total === 1 ? "" : "s"}
        </Text>
      </View>

      <Card padded={false}>
        {calls.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={palette.ink} />
          </View>
        ) : calls.isError ? (
          <EmptyState title="Couldn't load calls" body={apiErrorMessage(calls.error)} action={<Button size="sm" kind="ghost" label="Try again" onPress={() => calls.refetch()} />} />
        ) : !total ? (
          <EmptyState
            title={search || type !== "all" || status || source || recording ? "No calls match" : "No calls in this period"}
            body={
              search || type !== "all" || status || source || recording
                ? "Try a wider date range or clear a filter."
                : "Calls appear here a minute after they end, from every phone in your team."
            }
          />
        ) : (
          grouped.map((g) => (
            <Fragment key={g.key}>
              {grouped.length > 1 || filters.range !== "today" ? (
                <View style={styles.dayHead}>
                  <Text variant="eyebrow" tone="secondary" style={{ marginBottom: 0 }}>
                    {dayLabel(g.key)}
                  </Text>
                  <Text variant="mono" tone="tertiary" style={{ fontSize: 11 }}>
                    {g.calls.length}
                  </Text>
                </View>
              ) : null}
              {g.calls.map((c) => (
                <CallRow
                  key={c.id}
                  call={c}
                  tz={tz}
                  isWide={isWide}
                  showEmployee={manager}
                  dispositions={dispositions}
                  onPress={() => setOpen(c)}
                />
              ))}
            </Fragment>
          ))
        )}
      </Card>

      {calls.data && calls.data.items.length < total ? (
        <View style={{ marginTop: space.md }}>
          <Button
            kind="ghost"
            label={`Show ${Math.min(PAGE, total - calls.data.items.length)} more`}
            loading={calls.isFetching}
            onPress={() => setLimit((l) => Math.min(200, l + PAGE))}
            disabled={limit >= 200}
          />
          {limit >= 200 ? (
            <Text variant="caption" tone="tertiary" align="center" style={{ marginTop: 6 }}>
              Narrow the range or export to Excel to see all {num(total)}.
            </Text>
          ) : null}
        </View>
      ) : null}

      </>
      )}

      {open ? (
        <CallDetail
          key={`${open.id}-${openFrom?.n ?? 0}`}
          call={open}
          startAt={openFrom?.at ?? null}
          focusCommentId={openFrom?.comment ?? null}
          onClose={() => {
            setOpen(null);
            setOpenFrom(null);
          }}
          onShowClient={(phone) => {
            setSearch(phone.replace(/^\+91/, ""));
            setType("all");
            setStatus("");
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: space.md, flexWrap: "wrap" },
  headActions: { flexDirection: "row", alignItems: "center", gap: space.md, flexWrap: "wrap" },
  filters: { marginTop: space.xl, gap: space.md },
  searchRow: { gap: space.md },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chipScroll: { gap: 6, paddingRight: space.lg },
  sep: { width: 1, height: 22, backgroundColor: palette.rule, marginHorizontal: 4 },
  countRow: { marginTop: space.lg, marginBottom: space.sm },
  center: { padding: space.xxl, alignItems: "center" },
  dayHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    backgroundColor: palette.paper,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
});

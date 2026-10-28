import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { AppTabParamList } from "@navigation/types";
import { apiErrorMessage } from "@api/apiClient";
import { downloadExport } from "@api/download";
import { useAuthStore } from "@shared/store/useAuthStore";
import { useFilters } from "@shared/store/useFilters";
import { clock, dateTimeIn, dayLabel, formatPhone, hourLabel, num, pct, talkTime } from "@shared/format";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Card, Chip, EmptyState, RangeBar, Screen, Segmented, Text, TextField } from "@shared/ui";
import { Table, type Column } from "@shared/ui/Table";
import { Heatmap } from "@shared/charts/Heatmap";
import { Bars } from "@shared/charts/Bars";
import { Split } from "@shared/charts/Split";
import { CallHistory } from "@modules/calls/components/CallHistory";
import { SOURCE_LABEL, TYPE_LABEL, type CallSource, type CallType } from "@modules/calls/types";
import { useReportExtras, useReportFilters, useReportParams, validWindow } from "../reportFilters";
import { useSummary } from "@modules/dashboard/hooks/useSummary";
import { MONTHLY_METRICS, type ClientKind, type ClientRow, type EmployeeRow } from "../types";
import { useClientReport, useEmployeeReport, useMonthlyReport } from "../hooks/useReports";

type Tab = "summary" | "analysis" | "employees" | "day" | "hour" | "monthly" | ClientKind | "history";
type Props = BottomTabScreenProps<AppTabParamList, "Reports">;

const TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "analysis", label: "Analysis" },
  { id: "employees", label: "Employees" },
  { id: "day", label: "Day-wise" },
  { id: "hour", label: "Hourly" },
  { id: "monthly", label: "Monthly" },
  { id: "never_attended", label: "Not called back" },
  { id: "not_picked_up", label: "Not picked up" },
  { id: "unique", label: "Unique clients" },
  { id: "history", label: "Call history" },
];
const CALL_TYPES: CallType[] = ["incoming", "outgoing", "missed", "rejected", "blocked"];
const CALL_SOURCES: CallSource[] = ["phone", "whatsapp", "cloud", "ai"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CLIENT_COPY: Record<ClientKind, { title: string; body: string }> = {
  never_attended: {
    title: "Clients waiting for a call back",
    body: "Their latest missed or rejected call to your team wasn’t followed by a conversation.",
  },
  not_picked_up: { title: "Clients who never picked up", body: "Your team dialled them in this period and never got through." },
  unique: { title: "Every client in this period", body: "One row per phone number, most recent first." },
};

function SummaryTab() {
  const s = useSummary(useReportExtras());
  if (!s.data) return <Loading />;
  const t = s.data.totals;
  const rows: [string, string, string?][] = [
    ["Total calls", num(t.total)],
    ["Incoming", num(t.incoming)],
    ["Outgoing", num(t.outgoing)],
    ["Missed", num(t.missed)],
    ["Rejected", num(t.rejected)],
    ["Blocked", num(t.blocked)],
    ["WhatsApp calls", num(t.whatsapp)],
    ["Connected", num(t.connected), `${pct(t.connected, t.total)}% of calls`],
    ["Not picked up by client", num(t.unanswered), "outgoing calls"],
    ["Talk time", talkTime(t.talkSec)],
    ["Average connected call", clock(t.avgConnectedSec)],
    ["Talk time in working hours", talkTime(t.workTalkSec)],
    ["Talk time outside working hours", talkTime(t.nonWorkTalkSec)],
    ["Unique clients", num(t.uniqueClients)],
    ["Not called back", num(t.neverAttended), "clients"],
    ["Never picked up", num(t.notPickedUp), "clients"],
  ];
  return (
    <View style={styles.ledger}>
      {rows.map(([k, v, note]) => (
        <View key={k} style={styles.ledgerRow}>
          <Text style={{ flex: 1 }}>{k}</Text>
          {note ? (
            <Text variant="caption" tone="tertiary" style={{ marginRight: space.md }}>
              {note}
            </Text>
          ) : null}
          <Text style={styles.ledgerV}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function EmployeesTab() {
  const params = useReportParams();
  const q = useEmployeeReport(params);
  // reps share clients, so client counts can't be summed down the column
  const company = useSummary(useReportExtras()).data?.totals;
  if (q.isError) return <Banner tone="error" message={apiErrorMessage(q.error)} />;
  if (!q.data) return <Loading />;
  if (!q.data.length) return <EmptyState title="No calls in this period" body="Pick a longer range above." />;

  const sum = (f: (r: EmployeeRow) => number) => q.data.reduce((a, r) => a + f(r), 0);
  const totalRow = {
    userId: "total",
    name: "All employees",
    total: sum((r) => r.total),
    totalDurationSec: sum((r) => r.totalDurationSec),
    connected: sum((r) => r.connected),
    talkSec: sum((r) => r.talkSec),
    avgConnectedSec: 0,
    uniqueClients: company?.uniqueClients ?? 0,
    neverAttended: company?.neverAttended ?? 0,
    notPickedUp: company?.notPickedUp ?? 0,
    incoming: sum((r) => r.incoming),
    outgoing: sum((r) => r.outgoing),
    missed: sum((r) => r.missed),
    rejected: sum((r) => r.rejected),
    blocked: sum((r) => r.blocked),
    whatsapp: sum((r) => r.whatsapp),
    working: { total: sum((r) => r.working.total), durationSec: sum((r) => r.working.durationSec), connected: sum((r) => r.working.connected), avgConnectedSec: 0 },
    nonWorking: { total: sum((r) => r.nonWorking.total), durationSec: sum((r) => r.nonWorking.durationSec), connected: sum((r) => r.nonWorking.connected), avgConnectedSec: 0 },
  } satisfies EmployeeRow;
  totalRow.avgConnectedSec = totalRow.connected ? Math.round(totalRow.talkSec / totalRow.connected) : 0;

  const n = (k: keyof EmployeeRow, label: string, w = 76): Column<EmployeeRow> => ({ key: k, label, width: w, align: "right", render: (r) => num(r[k] as number) });
  const cols: Column<EmployeeRow>[] = [
    { key: "name", label: "Employee", width: 170, render: (r) => r.name },
    n("total", "Calls"),
    { key: "dur", label: "Duration", width: 84, align: "right", render: (r) => talkTime(r.totalDurationSec) },
    n("connected", "Connected", 84),
    { key: "avg", label: "Avg conn.", width: 80, align: "right", render: (r) => clock(r.avgConnectedSec) },
    n("uniqueClients", "Unique", 70),
    n("neverAttended", "Not called back", 92),
    n("notPickedUp", "Not picked up", 92),
    n("incoming", "In", 56),
    n("outgoing", "Out", 56),
    n("missed", "Missed", 64),
    n("rejected", "Rejected", 70),
    n("blocked", "Blocked", 66),
    { key: "wt", label: "Calls", width: 64, align: "right", group: "In working hours", render: (r) => num(r.working.total) },
    { key: "wd", label: "Duration", width: 80, align: "right", group: "In working hours", render: (r) => talkTime(r.working.durationSec) },
    { key: "wc", label: "Conn.", width: 64, align: "right", group: "In working hours", render: (r) => num(r.working.connected) },
    { key: "nt", label: "Calls", width: 64, align: "right", group: "Outside working hours", render: (r) => num(r.nonWorking.total) },
    { key: "nd", label: "Duration", width: 80, align: "right", group: "Outside working hours", render: (r) => talkTime(r.nonWorking.durationSec) },
    { key: "nc", label: "Conn.", width: 64, align: "right", group: "Outside working hours", render: (r) => num(r.nonWorking.connected) },
  ];
  return <Table columns={cols} rows={q.data} rowKey={(r) => r.userId} footer={totalRow} />;
}

function DayTab() {
  const s = useSummary(useReportExtras());
  if (!s.data) return <Loading />;
  type D = (typeof s.data.byDay)[number];
  const cols: Column<D>[] = [
    { key: "day", label: "Day", width: 140, render: (d) => dayLabel(d.day) },
    { key: "total", label: "Calls", width: 80, align: "right", render: (d) => num(d.total) },
    { key: "connected", label: "Connected", width: 90, align: "right", render: (d) => num(d.connected) },
    { key: "rate", label: "Rate", width: 70, align: "right", render: (d) => `${pct(d.connected, d.total)}%` },
    { key: "missed", label: "Missed", width: 80, align: "right", render: (d) => num(d.missed) },
    { key: "talk", label: "Talk time", width: 90, align: "right", render: (d) => talkTime(d.talkSec) },
  ];
  return <Table columns={cols} rows={[...s.data.byDay].reverse()} rowKey={(d) => d.day} />;
}

function HourTab() {
  const s = useSummary(useReportExtras());
  if (!s.data) return <Loading />;
  type H = (typeof s.data.byHour)[number];
  const max = Math.max(1, ...s.data.byHour.map((h) => h.total));
  const cols: Column<H>[] = [
    { key: "h", label: "Hour", width: 90, render: (h) => hourLabel(h.hour) },
    { key: "total", label: "Calls", width: 70, align: "right", render: (h) => num(h.total) },
    { key: "connected", label: "Connected", width: 90, align: "right", render: (h) => num(h.connected) },
    {
      key: "bar",
      label: "",
      width: 220,
      render: (h) => (
        <View style={styles.hourBar}>
          <View style={[styles.hourFill, { width: `${(h.total / max) * 100}%` }]}>
            <View style={[styles.hourInner, { width: `${pct(h.connected, h.total)}%` }]} />
          </View>
        </View>
      ),
    },
  ];
  return <Table columns={cols} rows={s.data.byHour.filter((h) => h.total > 0 || (h.hour >= 9 && h.hour <= 20))} rowKey={(h) => String(h.hour)} />;
}

function MonthlyTab() {
  const { userIds, excludeNumbers } = useFilters();
  const company = useAuthStore((s) => s.company);
  const thisMonth = new Intl.DateTimeFormat("en-CA", { timeZone: company?.timezone ?? "Asia/Kolkata" }).format(new Date()).slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [metric, setMetric] = useState("total_calls");
  const extras = useReportExtras();
  const params = { month, metric, excludeNumbers: String(excludeNumbers), ...(userIds.length ? { userIds: userIds.join(",") } : {}), ...extras };
  const q = useMonthlyReport(params);
  const isTime = MONTHLY_METRICS.find((m) => m.id === metric)?.time;
  const step = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.monthBar}>
        <Pressable onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel="Previous month" style={styles.stepBtn}>
          <Text>‹</Text>
        </Pressable>
        <Text variant="heading" style={{ minWidth: 150, textAlign: "center" }}>
          {label}
        </Text>
        <Pressable onPress={() => month < thisMonth && step(1)} accessibilityRole="button" accessibilityLabel="Next month" style={[styles.stepBtn, month >= thisMonth && { opacity: 0.3 }]}>
          <Text>›</Text>
        </Pressable>
      </View>
      <View style={styles.chips}>
        {MONTHLY_METRICS.map((m) => (
          <Chip key={m.id} label={m.label} selected={metric === m.id} onPress={() => setMetric(m.id)} />
        ))}
      </View>
      {!q.data ? (
        <Loading />
      ) : !q.data.rows.length ? (
        <EmptyState title="No calls that month" body="Step back a month with the arrow above." />
      ) : (
        <Heatmap days={q.data.days} rows={q.data.rows} max={q.data.max} format={(v) => (isTime ? talkTime(v) : String(v))} />
      )}
    </View>
  );
}

function ClientsTab({ kind }: { kind: ClientKind }) {
  const params = useReportParams();
  const company = useAuthStore((s) => s.company);
  const q = useClientReport(kind, params);
  if (q.isError) return <Banner tone="error" message={apiErrorMessage(q.error)} />;
  if (!q.data) return <Loading />;
  const tz = company?.timezone ?? "Asia/Kolkata";
  const cols: Column<ClientRow>[] = [
    { key: "name", label: "Client", width: 190, render: (c) => c.name || formatPhone(c.phone) },
    { key: "phone", label: "Number", width: 150, render: (c) => formatPhone(c.phone) },
    { key: "calls", label: "Calls", width: 64, align: "right", render: (c) => num(c.calls) },
    { key: "connects", label: "Talks", width: 64, align: "right", render: (c) => num(c.connects) },
    { key: "talk", label: "Talk time", width: 84, align: "right", render: (c) => talkTime(c.talkSec) },
    { key: "last", label: "Last call", width: 150, render: (c) => dateTimeIn(c.lastAt, tz) },
    { key: "emp", label: "Rep", width: 140, render: (c) => c.employee },
  ];
  return (
    <View style={{ gap: space.md }}>
      <View>
        <Text variant="heading">{CLIENT_COPY[kind].title}</Text>
        <Text variant="caption" tone="secondary">
          {CLIENT_COPY[kind].body} {q.data.length ? `${num(q.data.length)} client${q.data.length === 1 ? "" : "s"}.` : ""}
        </Text>
      </View>
      {q.data.length ? (
        <Table columns={cols} rows={q.data} rowKey={(c) => c.phone} />
      ) : (
        <EmptyState icon="check" title="Nobody on this list" body="Nice. Try a longer range to be sure." />
      )}
    </View>
  );
}

/** The period read four ways: how calls ended, how long talks ran, the busy hours and the busy days. */
function AnalysisTab() {
  const s = useSummary(useReportExtras());
  if (!s.data) return <Loading />;
  const t = s.data.totals;
  const hours = s.data.byHour.filter((h) => h.hour >= 8 && h.hour <= 21);
  const weekdays = WEEKDAYS.map((label, d) => {
    const days = s.data.byDay.filter((x) => new Date(`${x.day}T00:00:00Z`).getUTCDay() === d);
    return { label, value: days.reduce((a, x) => a + x.total, 0), inner: days.reduce((a, x) => a + x.connected, 0) };
  });
  const busiest = [...weekdays].sort((a, b) => b.value - a.value)[0];
  const peak = [...s.data.byHour].sort((a, b) => b.total - a.total)[0];
  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <Text variant="heading">How calls ended</Text>
        <Split
          summary={`Connected ${t.connected}, not picked up ${t.unanswered}, missed ${t.missed}, rejected ${t.rejected}, blocked ${t.blocked}.`}
          parts={[
            { label: "Connected", value: t.connected, color: palette.connected },
            { label: "Not picked up by client", value: t.unanswered, color: palette.ruleStrong },
            { label: "Missed", value: t.missed, color: palette.missed },
            { label: "Rejected", value: t.rejected, color: "#7A1A14" },
            { label: "Blocked", value: t.blocked, color: palette.ink3 },
          ]}
        />
      </View>
      <View style={{ gap: space.sm }}>
        <Text variant="heading">How long people talked</Text>
        <Bars
          height={140}
          data={s.data.durations.map((d) => ({ label: d.label, value: d.count, inner: d.count }))}
          summary={s.data.durations.map((d) => `${d.label}: ${d.count}`).join(", ")}
        />
      </View>
      <View style={{ gap: space.sm }}>
        <Text variant="heading">Calls by hour</Text>
        <Text variant="caption" tone="secondary">
          Grey is every call, ink the ones that connected.{peak?.total ? ` Busiest: ${hourLabel(peak.hour)}.` : ""}
        </Text>
        <Bars
          height={150}
          labelEvery={2}
          data={hours.map((h) => ({ label: hourLabel(h.hour), value: h.total, inner: h.connected }))}
          summary={hours.map((h) => `${hourLabel(h.hour)}: ${h.total} calls, ${h.connected} connected`).join("; ")}
        />
      </View>
      <View style={{ gap: space.sm }}>
        <Text variant="heading">Calls by day of the week</Text>
        <Text variant="caption" tone="secondary">
          Added up across the period.{busiest?.value ? ` Busiest: ${busiest.label}.` : ""}
        </Text>
        <Bars height={130} data={weekdays} summary={weekdays.map((w) => `${w.label}: ${w.value} calls, ${w.inner} connected`).join("; ")} />
      </View>
    </View>
  );
}

/** The cuts only reports offer: what kind of call, from where, what time of day, which days left out. */
function ReportFilterBar() {
  const f = useReportFilters();
  const [from, setFrom] = useState(f.timeFrom);
  const [to, setTo] = useState(f.timeTo);
  const half = Boolean(from || to) && !validWindow(from, to);
  const any = f.types.length > 0 || f.sources.length > 0 || f.excludeDays.length > 0 || validWindow(f.timeFrom, f.timeTo);
  return (
    <View style={styles.filterBar}>
      <View style={styles.chips} role="group" aria-label="Call type and source">
        {CALL_TYPES.map((t) => (
          <Chip key={t} role="checkbox" label={TYPE_LABEL[t]} selected={f.types.includes(t)} onPress={() => f.toggleType(t)} />
        ))}
        <View style={styles.sep} />
        {CALL_SOURCES.map((s) => (
          <Chip key={s} role="checkbox" label={SOURCE_LABEL[s]} selected={f.sources.includes(s)} onPress={() => f.toggleSource(s)} />
        ))}
      </View>
      <View style={styles.windowRow}>
        <View style={styles.timeBox}>
          <TextField label="From" value={from} placeholder="10:00" maxLength={5} onChangeText={setFrom} onBlur={() => f.setWindow(from, to)} />
        </View>
        <View style={styles.timeBox}>
          <TextField label="To" value={to} placeholder="13:00" maxLength={5} onChangeText={setTo} onBlur={() => f.setWindow(from, to)} />
        </View>
        <View style={{ gap: 6, flexShrink: 1 }}>
          <Text variant="label">Leave out</Text>
          <View style={styles.chips} role="group" aria-label="Days to leave out">
            {WEEKDAYS.map((d, i) => (
              <Chip key={d} role="checkbox" label={d} selected={f.excludeDays.includes(i)} onPress={() => f.toggleDay(i)} />
            ))}
          </View>
        </View>
        {any ? (
          <Button
            kind="quiet"
            size="sm"
            label="Clear filters"
            onPress={() => {
              f.clear();
              setFrom("");
              setTo("");
            }}
          />
        ) : null}
      </View>
      {half ? (
        <Text variant="caption" tone="missed">
          Use 24-hour times with From before To, for example 10:00 to 13:00.
        </Text>
      ) : null}
    </View>
  );
}

function Loading() {
  return (
    <View style={{ padding: space.xxl, alignItems: "center" }}>
      <ActivityIndicator color={palette.ink} />
    </View>
  );
}

export default function ReportsScreen({ route }: Props) {
  const [tab, setTab] = useState<Tab>((route.params?.tab as Tab) ?? "summary");
  const [lastParam, setLastParam] = useState(route.params?.tab);
  const params = useReportParams();
  const { excludeNumbers, setExcludeNumbers } = useFilters();
  const [exporting, setExporting] = useState<"" | "xlsx" | "pdf">("");
  const [err, setErr] = useState<unknown>(null);

  // a dashboard tile can open a particular tab
  if (route.params?.tab !== lastParam) {
    setLastParam(route.params?.tab);
    if (route.params?.tab) setTab(route.params.tab as Tab);
  }

  async function exp(kind: "xlsx" | "pdf") {
    setExporting(kind);
    setErr(null);
    try {
      await downloadExport(`/reports/export.${kind}`, params, `call-report.${kind}`);
    } catch (e) {
      setErr(e);
    } finally {
      setExporting("");
    }
  }

  return (
    <Screen>
      <View style={styles.head}>
        <View>
          <Text variant="eyebrow" tone="tertiary">
            The whole team, side by side
          </Text>
          <Text variant="display" style={{ marginTop: 6 }}>
            Reports
          </Text>
        </View>
        <View style={styles.exports}>
          <Button kind="ghost" size="sm" label="Excel" loading={exporting === "xlsx"} onPress={() => exp("xlsx")} />
          <Button kind="ghost" size="sm" label="PDF" loading={exporting === "pdf"} onPress={() => exp("pdf")} />
        </View>
      </View>

      <View style={{ marginTop: space.xl, gap: space.md }}>
        {tab !== "monthly" ? <RangeBar /> : null}
        <View style={styles.chips}>
          <Chip
            role="checkbox"
            label="Leave out excluded numbers"
            selected={excludeNumbers}
            onPress={() => setExcludeNumbers(!excludeNumbers)}
          />
        </View>
        {tab !== "monthly" ? <ReportFilterBar /> : null}
        <Segmented label="Report" scroll value={tab} onChange={setTab} items={TABS} />
      </View>

      {err ? <Banner tone="error" message={apiErrorMessage(err, "The export didn't download. Try again.")} /> : null}

      {tab === "history" ? (
        <View style={{ marginTop: space.lg }}>
          <CallHistory params={params} />
        </View>
      ) : (
        <Card
          padded={tab === "monthly" || tab === "summary" || tab === "analysis" || tab === "never_attended" || tab === "not_picked_up" || tab === "unique"}
          style={{ marginTop: space.lg }}
        >
        {tab === "analysis" ? <AnalysisTab /> : null}
        {tab === "summary" ? <SummaryTab /> : null}
        {tab === "employees" ? <EmployeesTab /> : null}
        {tab === "day" ? <DayTab /> : null}
        {tab === "hour" ? <HourTab /> : null}
        {tab === "monthly" ? <MonthlyTab /> : null}
        {tab === "never_attended" || tab === "not_picked_up" || tab === "unique" ? <ClientsTab kind={tab} /> : null}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: space.md, flexWrap: "wrap" },
  exports: { flexDirection: "row", gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  filterBar: { gap: space.md, paddingVertical: space.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.rule },
  windowRow: { flexDirection: "row", flexWrap: "wrap", gap: space.md, alignItems: "flex-end" },
  timeBox: { width: 96 },
  sep: { width: 1, height: 22, backgroundColor: palette.rule, marginHorizontal: 4 },
  ledger: { gap: 0 },
  ledgerRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.rule },
  ledgerV: { fontFamily: fonts.monoMedium, fontSize: 14, color: palette.ink, minWidth: 90, textAlign: "right" },
  hourBar: { height: 10, backgroundColor: palette.paper2, borderRadius: 2 },
  hourFill: { height: 10, backgroundColor: palette.ruleStrong, borderRadius: 2, overflow: "hidden" },
  hourInner: { height: 10, backgroundColor: palette.ink },
  monthBar: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepBtn: { width: 36, height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: palette.ruleStrong, alignItems: "center", justifyContent: "center" },
});

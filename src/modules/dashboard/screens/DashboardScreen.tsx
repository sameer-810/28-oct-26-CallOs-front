import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { AppTabParamList } from "@navigation/types";
import { apiErrorMessage } from "@api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { RANGE_LABEL, useFilters } from "@shared/store/useFilters";
import { useRefreshOnFocus } from "@shared/hooks/useRefreshOnFocus";
import { clock, dayLabel, delta, firstName, greeting, hourLabel, num, pct, talkTime } from "@shared/format";
import { palette, space } from "@shared/designSystem";
import { Banner, Button, Card, RangeBar, Screen, StatTile, Tag, Text, useBreakpoint } from "@shared/ui";
import { Bars, Legend } from "@shared/charts/Bars";
import { Split } from "@shared/charts/Split";
import { ROLE_LABEL } from "@modules/auth/types";
import { useFollowUps } from "@modules/calls/hooks/useCalls";
import { GLANCE_PERIODS, useGlance, useHighlights, useSummary } from "../hooks/useSummary";
import { Glance, PipelineCard, TopSalespersonCard } from "../components/Highlights";
import { FollowUps, Leaderboard, Opportunities, Panel } from "../components/Panels";
import { SetupPanel } from "../components/SetupPanel";
import { PhoneStatus } from "@modules/device/components/PhoneStatus";

type Props = BottomTabScreenProps<AppTabParamList, "Home">;

export default function DashboardScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const company = useAuthStore((s) => s.company);
  const range = useFilters((s) => s.range);
  const { isWide } = useBreakpoint();
  const summary = useSummary();
  const followUps = useFollowUps();
  const isManager = user?.role === "owner" || user?.role === "manager";
  const highlights = useHighlights(isManager);
  const glance = useGlance(isManager);
  useRefreshOnFocus(summary.refetch);
  useRefreshOnFocus(followUps.refetch);

  if (!user || !company) return null;
  const manager = user.role === "owner" || user.role === "manager";
  const s = summary.data;
  const t = s?.totals;
  const singleDay = s ? s.range.from === s.range.to : true;
  const tz = company.timezone;

  const goReports = (tab?: string) => navigation.navigate(manager ? "Reports" : "Calls", tab ? ({ tab } as never) : undefined);

  return (
    <Screen>
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text variant="eyebrow" tone="tertiary">
            {company.name}
          </Text>
          <Text variant="display" style={styles.hello}>
            {greeting()}, {firstName(user.name)}.
          </Text>
        </View>
        <Tag label={ROLE_LABEL[user.role]} tone={user.role === "rep" ? "neutral" : "ink"} />
      </View>

      {user.role === "owner" && company.subscription?.status === "trialing" ? (
        <View style={styles.trial}>
          <Text variant="label" style={{ flex: 1 }}>
            <Text variant="label" style={{ backgroundColor: palette.marker }}>
              {company.subscription.daysLeft} day{company.subscription.daysLeft === 1 ? "" : "s"}
            </Text>{" "}
            left in your free trial. Every feature is on.
          </Text>
          <Button kind="quiet" size="sm" label="Choose a plan" onPress={() => navigation.navigate("Billing")} />
        </View>
      ) : null}
      {user.role === "owner" && company.subscription?.status === "past_due" ? (
        <View style={[styles.trial, { borderColor: palette.missed }]}>
          <Text variant="label" tone="missed" style={{ flex: 1 }}>
            Your plan has ended. The app stays open for a few more days — renew to keep it that way.
          </Text>
          <Button size="sm" label="Renew" onPress={() => navigation.navigate("Billing")} />
        </View>
      ) : null}

      <View style={{ marginTop: space.lg }}>
        <PhoneStatus />
      </View>

      <View style={styles.bar}>
        <RangeBar />
      </View>

      {summary.isError ? <Banner tone="error" message={apiErrorMessage(summary.error)} /> : null}

      {!s || !t ? (
        <View style={styles.loading}>
          <ActivityIndicator color={palette.ink} />
        </View>
      ) : (
        <>
          {manager && t.total === 0 && range === "today" ? (
            <View style={{ marginTop: space.lg }}>
              <SetupPanel company={company} />
            </View>
          ) : null}

          {/* the band: one big number, then the ones that explain it */}
          <Card padded={false} style={styles.band}>
            <View style={[styles.bandInner, !isWide && { flexDirection: "column" }]}>
              <View style={[styles.hero, !isWide && styles.heroNarrow]}>
                <StatTile
                  big
                  label={`Calls · ${RANGE_LABEL[range as keyof typeof RANGE_LABEL] ?? ""}`}
                  value={num(t.total)}
                  delta={delta(t.total, s.previous.total)}
                  hint={!s.previous.total ? "nothing to compare yet" : undefined}
                />
              </View>
              <View style={styles.tiles}>
                <View style={styles.tileRow}>
                  <StatTile mark="connected" label="Connected" value={num(t.connected)} aside={`${pct(t.connected, t.total)}%`} delta={delta(t.connected, s.previous.connected)} />
                  <StatTile label="Talk time" value={talkTime(t.talkSec)} delta={delta(t.talkSec, s.previous.talkSec)} />
                  <StatTile label="Avg connected call" value={clock(t.avgConnectedSec)} />
                </View>
                <View style={[styles.tileRow, styles.tileRowLast]}>
                  <StatTile
                    mark="missed"
                    label="Missed"
                    value={num(t.missed + t.rejected)}
                    delta={delta(t.missed + t.rejected, s.previous.missed)}
                    upIsBad
                  />
                  <StatTile
                    label="Not called back"
                    value={num(t.neverAttended)}
                    hint={manager ? "tap for the list" : "clients who missed you"}
                    onPress={manager ? () => goReports("never_attended") : undefined}
                  />
                  <StatTile label="Unique clients" value={num(t.uniqueClients)} aside={`${num(t.notPickedUp)} didn’t pick up`} />
                </View>
              </View>
            </View>
          </Card>

          <View style={[styles.grid, isWide && styles.gridWide]}>
            <View style={[styles.col, isWide && { flex: 1.6 }]}>
              <Panel
                title={singleDay ? "When the calls happened" : "Calls per day"}
                caption={
                  singleDay
                    ? (() => {
                        const peak = s.byHour.reduce((a, b) => (b.total > a.total ? b : a), s.byHour[0]);
                        return peak.total ? `Busiest at ${hourLabel(peak.hour)} with ${peak.total} calls.` : "No calls yet in this period.";
                      })()
                    : `${dayLabel(s.range.from)} – ${dayLabel(s.range.to)}`
                }
                action={<Legend items={[{ label: "Connected", color: palette.ink }, { label: "All calls", color: palette.ruleStrong }]} />}
              >
                {singleDay ? (
                  <Bars
                    data={s.byHour.slice(8, 22).map((h) => ({ label: hourLabel(h.hour).replace(" ", ""), value: h.total, inner: h.connected }))}
                    labelEvery={isWide ? 1 : 2}
                    summary={`Calls by hour from 8 am to 10 pm. Total ${t.total}, connected ${t.connected}.`}
                  />
                ) : (
                  <Bars
                    data={s.byDay.map((d) => ({ label: s.byDay.length > 10 ? d.day.slice(8) : dayLabel(d.day).split(" ")[0].replace(",", ""), value: d.total, inner: d.connected }))}
                    labelEvery={s.byDay.length > 16 ? 3 : 1}
                    summary={`Calls per day, ${s.byDay.length} days. Total ${t.total}.`}
                  />
                )}
              </Panel>

              <View style={[styles.pair, !isWide && { flexDirection: "column" }]}>
                <View style={{ flex: 1 }}>
                  <Panel title="How calls ended" caption="Every call in the period, by outcome.">
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
                  </Panel>
                </View>
                <View style={{ flex: 1 }}>
                  <Panel title="How long people talked" caption="Connected calls by length.">
                    <Bars
                      height={140}
                      data={s.durations.map((d) => ({ label: d.label, value: d.count, inner: d.count }))}
                      summary={s.durations.map((d) => `${d.label}: ${d.count}`).join(", ")}
                    />
                    <View style={styles.workSplit}>
                      <Text variant="caption" tone="secondary">
                        In working hours <Text variant="mono">{talkTime(t.workTalkSec)}</Text>
                      </Text>
                      <Text variant="caption" tone="secondary">
                        Outside <Text variant="mono">{talkTime(t.nonWorkTalkSec)}</Text>
                      </Text>
                    </View>
                  </Panel>
                </View>
              </View>
            </View>

            <View style={[styles.col, isWide && { flex: 1 }]}>
              {manager ? (
                <Panel title="Top salesperson" caption="This week, by connected calls.">
                  {highlights.data ? <TopSalespersonCard top={highlights.data.topSalesperson} /> : <ActivityIndicator color={palette.ink} />}
                </Panel>
              ) : null}
              {manager ? (
                <Panel
                  title="Pipeline"
                  caption="Deals this month, by where they stand."
                  action={<Button kind="quiet" size="sm" label="Deals" onPress={() => navigation.navigate("Opportunities")} />}
                >
                  {highlights.data ? <PipelineCard p={highlights.data.pipeline} /> : <ActivityIndicator color={palette.ink} />}
                </Panel>
              ) : null}
              {manager ? (
                <Panel title="At a glance" caption="The whole team, whatever range is picked above.">
                  <Glance periods={GLANCE_PERIODS.map((period, i) => ({ period, totals: glance[i]?.data?.totals }))} />
                </Panel>
              ) : null}
              {highlights.isError ? <Banner tone="error" message={apiErrorMessage(highlights.error)} /> : null}
              {manager ? (
                <Panel title="Leaderboard" caption="By connected calls, then talk time." action={<Button kind="quiet" size="sm" label="Report" onPress={() => goReports("employees")} />}>
                  <Leaderboard rows={s.leaderboard} />
                </Panel>
              ) : null}
              <Panel title="Follow-ups" caption="Call-backs promised to clients." action={<Button kind="quiet" size="sm" label="Calls" onPress={() => navigation.navigate("Calls")} />}>
                {followUps.data ? (
                  <FollowUps items={followUps.data.items} counts={followUps.data.counts} tz={tz} onOpen={() => navigation.navigate("Calls")} />
                ) : (
                  <ActivityIndicator color={palette.ink} />
                )}
              </Panel>
              <Panel title="Opportunities" caption="Clients you spoke to more than once." action={<Button kind="quiet" size="sm" label="All" onPress={() => navigation.navigate("Opportunities")} />}>
                <Opportunities o={s.opportunities} onOpen={() => navigation.navigate("Opportunities")} />
              </Panel>
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md, flexWrap: "wrap" },
  hello: { marginTop: 6 },
  trial: {
    marginTop: space.lg,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.rule,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    flexWrap: "wrap",
  },
  bar: { marginTop: space.lg },
  loading: { padding: space.xxxl, alignItems: "center" },
  band: { marginTop: space.lg },
  bandInner: { flexDirection: "row" },
  hero: { width: 280, borderRightWidth: 1, borderRightColor: palette.rule, justifyContent: "center" },
  heroNarrow: { width: "100%", borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: palette.rule },
  tiles: { flex: 1 },
  tileRow: { flexDirection: "row", flexWrap: "wrap", borderBottomWidth: 1, borderBottomColor: palette.rule },
  tileRowLast: { borderBottomWidth: 0 },
  grid: { marginTop: space.lg, gap: space.lg },
  gridWide: { flexDirection: "row", alignItems: "flex-start" },
  col: { gap: space.lg },
  pair: { flexDirection: "row", gap: space.lg },
  workSplit: { flexDirection: "row", justifyContent: "space-between", marginTop: space.md, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: palette.rule },
});

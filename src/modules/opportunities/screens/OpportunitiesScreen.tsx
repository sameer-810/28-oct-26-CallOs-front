import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { apiErrorMessage } from "@api/apiClient";
import { downloadExport } from "@api/download";
import { useAuthStore } from "@shared/store/useAuthStore";
import { useFilterParams } from "@shared/store/useFilters";
import { useRefreshOnFocus } from "@shared/hooks/useRefreshOnFocus";
import { dateIn, formatPhone, num, talkTime } from "@shared/format";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Card, Chip, EmptyState, RangeBar, Screen, Segmented, Text, TextField, useBreakpoint } from "@shared/ui";
import type { DealStatus } from "@modules/calls/types";
import type { Opportunity } from "../types";
import { useOpportunities, useSetDeal, useOpportunitySummary } from "../hooks/useOpportunities";
import { useCallStore } from "@modules/telephony/useCallStore";
import { useCanCall } from "@modules/telephony/hooks/useTelephony";

const PAGE = 50;

function DealSwitch({ o, onSet, busy }: { o: Opportunity; onSet: (s: "open" | "closed") => void; busy: boolean }) {
  const closed = o.dealStatus === "closed";
  return (
    <View style={styles.deal} accessibilityRole="radiogroup" accessibilityLabel={`Deal status for ${o.name || o.phone}`}>
      <Chip role="radio" label={o.dealStatus === "open_again" ? "Open again" : "Open"} selected={!closed} onPress={() => !busy && closed && onSet("open")} />
      <Chip role="radio" label={o.dealClosedCount > 1 ? `Closed ×${o.dealClosedCount}` : "Closed"} tone={closed ? "connected" : undefined} selected={closed} onPress={() => !busy && !closed && onSet("closed")} />
    </View>
  );
}

function Row({ o, tz, isWide, onSet, busy }: { o: Opportunity; tz: string; isWide: boolean; onSet: (s: "open" | "closed") => void; busy: boolean }) {
  const canCall = useCanCall();
  const dial = useCallStore((s) => s.call);
  return (
    <View style={[styles.row, !isWide && { flexDirection: "column", alignItems: "stretch" }]}>
      <View style={{ flex: 1.4, minWidth: 0 }}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {o.name || formatPhone(o.phone)}
        </Text>
        <Text variant="mono" tone="tertiary" style={{ fontSize: 11.5 }} numberOfLines={1}>
          {o.name ? formatPhone(o.phone) : ""}
          {o.employee ? `${o.name ? "  · " : ""}${o.employee}` : ""}
        </Text>
      </View>
      <View style={[styles.nums, !isWide && { justifyContent: "flex-start" }]}>
        <View style={styles.numCell}>
          <Text style={styles.n}>{o.connects}</Text>
          <Text style={styles.nLabel}>talks</Text>
        </View>
        <View style={styles.numCell}>
          <Text style={styles.n}>
            {o.outgoing}/{o.incoming}
          </Text>
          <Text style={styles.nLabel}>out/in</Text>
        </View>
        <View style={styles.numCell}>
          <Text style={styles.n}>{talkTime(o.talkSec)}</Text>
          <Text style={styles.nLabel}>talk</Text>
        </View>
        <View style={styles.numCell}>
          <Text style={styles.n}>{dateIn(o.lastAt, tz)}</Text>
          <Text style={styles.nLabel}>{o.lastStatus ?? "last call"}</Text>
        </View>
      </View>
      <View style={styles.rowActions}>
        {canCall ? <Button kind="ghost" size="sm" label="Call" onPress={() => dial(o.phone, o.name)} /> : null}
        {o.contactId ? <DealSwitch o={o} onSet={onSet} busy={busy} /> : null}
      </View>
    </View>
  );
}

export default function OpportunitiesScreen() {
  const company = useAuthStore((s) => s.company);
  const { isWide } = useBreakpoint();
  const filters = useFilterParams();
  const [tab, setTab] = useState<"all" | "repeat">("all");
  const [deal, setDeal] = useState<DealStatus | "">("");
  const [minConnects, setMinConnects] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [exportError, setExportError] = useState<unknown>(null);

  const params = {
    ...filters,
    tab,
    ...(deal ? { dealStatus: deal } : {}),
    ...(minConnects ? { minConnects } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    limit,
  };
  const q = useOpportunities(params);
  // the key numbers count every matching client, not just the page on screen
  const { limit: _limit, tab: _tab, ...summaryParams } = params;
  const metrics = useOpportunitySummary(summaryParams);
  useRefreshOnFocus(q.refetch);
  const set = useSetDeal();

  const sum = metrics.data;
  const tz = company?.timezone ?? "Asia/Kolkata";

  return (
    <Screen>
      <View style={styles.head}>
        <View>
          <Text variant="eyebrow" tone="tertiary">
            Clients you called in this period
          </Text>
          <Text variant="display" style={{ marginTop: 6 }}>
            Opportunities
          </Text>
        </View>
        <Button
          kind="ghost"
          size="sm"
          label="Export to Excel"
          onPress={async () => {
            setExportError(null);
            try {
              const { limit: _l, ...rest } = params;
              await downloadExport("/contacts/opportunities/export.xlsx", rest, "opportunities.xlsx");
            } catch (e) {
              setExportError(e);
            }
          }}
        />
      </View>

      <View style={{ marginTop: space.xl, gap: space.md }}>
        <RangeBar />
        {sum ? (
          <View style={styles.pipeline}>
            {(
              [
                ["Clients", num(sum.total), "with a call in this period"],
                ["Open", num(sum.open), ""],
                ["Open again", num(sum.openAgain), "came back after a close"],
                ["Closed", num(sum.closed), "clients"],
                ["Close rate", `${(sum.closeRate * 100).toFixed(sum.closeRate * 100 < 10 ? 1 : 0)}%`, "of these clients"],
                ["Repeat clients", num(sum.repeatClients), `avg ${sum.avgConnects.toFixed(1)} talks each`],
              ] as const
            ).map(([label, n, sub], i, all) => (
              <View key={label} style={[styles.stage, i === all.length - 1 && { borderRightWidth: 0 }]}>
                <Text variant="caption" tone="tertiary">
                  {label}
                </Text>
                <Text style={styles.stageN}>{n}</Text>
                {sub ? <Text style={styles.nLabel}>{sub}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
        <View style={[{ gap: space.md }, isWide && { flexDirection: "row", alignItems: "flex-end" }]}>
          <View style={{ flex: 1 }}>
            <TextField label="Search" placeholder="Client name or number" value={search} onChangeText={setSearch} autoCapitalize="none" />
          </View>
          <Segmented
            label="Which clients"
            value={tab}
            onChange={(v) => { setTab(v); setLimit(PAGE); }}
            items={[
              { id: "all", label: "All clients" },
              { id: "repeat", label: "Repeat clients" },
            ]}
          />
        </View>
        <View style={styles.chips}>
          <Chip label="Any deal" selected={!deal} onPress={() => setDeal("")} />
          <Chip label="Open" selected={deal === "open"} onPress={() => setDeal("open")} />
          <Chip label="Open again" selected={deal === "open_again"} onPress={() => setDeal("open_again")} />
          <Chip label="Closed" tone="connected" selected={deal === "closed"} onPress={() => setDeal("closed")} />
          <View style={styles.sep} />
          {[0, 2, 3, 5].map((n) => (
            <Chip key={n} label={n ? `${n}+ talks` : "Any talks"} selected={minConnects === n} onPress={() => setMinConnects(n)} />
          ))}
        </View>
      </View>

      {exportError || set.error ? <Banner tone="error" message={apiErrorMessage(exportError ?? set.error)} /> : null}

      <Text variant="mono" tone="tertiary" style={{ marginTop: space.lg, marginBottom: space.sm }}>
        {num(q.data?.total ?? 0)} client{q.data?.total === 1 ? "" : "s"}
      </Text>
      <Card padded={false}>
        {q.isLoading ? (
          <View style={{ padding: space.xxl, alignItems: "center" }}>
            <ActivityIndicator color={palette.ink} />
          </View>
        ) : !q.data?.items.length ? (
          <EmptyState
            icon="team"
            title={tab === "repeat" ? "No repeat clients yet" : "No clients in this period"}
            body={tab === "repeat" ? "A client becomes a repeat client when they call again after a deal closed." : "Try a longer range, like 30 days."}
          />
        ) : (
          q.data.items.map((o) => (
            <Row
              key={o.phone}
              o={o}
              tz={tz}
              isWide={isWide}
              busy={set.isPending}
              onSet={(s) => o.contactId && set.mutate({ id: o.contactId, s })}
            />
          ))
        )}
      </Card>
      {q.data && q.data.items.length < q.data.total ? (
        <View style={{ marginTop: space.md }}>
          <Button kind="ghost" label="Show more" loading={q.isFetching} disabled={limit >= 200} onPress={() => setLimit((l) => Math.min(200, l + PAGE))} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: space.md, flexWrap: "wrap" },
  pipeline: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: palette.ruleStrong, borderRadius: radius.lg, backgroundColor: palette.card },
  stage: { flex: 1, minWidth: 130, padding: space.md + 2, borderRightWidth: 1, borderRightColor: palette.rule, gap: 2 },
  stageN: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: palette.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  sep: { width: 1, height: 22, backgroundColor: palette.rule, marginHorizontal: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: palette.rule },
  nums: { flexDirection: "row", gap: space.lg, flex: 2, justifyContent: "flex-end", flexWrap: "wrap" },
  numCell: { minWidth: 64, alignItems: "flex-end" },
  n: { fontFamily: fonts.monoMedium, fontSize: 13, color: palette.ink },
  nLabel: { fontFamily: fonts.mono, fontSize: 10.5, color: palette.ink3 },
  deal: { flexDirection: "row", gap: 4 },
  rowActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
});

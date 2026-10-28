import { useState } from "react";
import { Linking, Pressable, StyleSheet, TextInput, View } from "react-native";
import { apiErrorMessage } from "@api/apiClient";
import { downloadExport } from "@api/download";
import { useAuthStore } from "@shared/store/useAuthStore";
import { dateIn } from "@shared/format";
import { fonts, palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Card, Chip, Tag, Text, useBreakpoint, type PressState } from "@shared/ui";
import { PAYMENT_METHOD_LABEL, type Billing, type Invoice, type PaidPlan, type Purchase } from "../types";
import { rupees } from "../money";
import { useBilling, useBillingQuote, useCheckout, useInvoice, useTestPay } from "../hooks/useBilling";

const PLAN_POINTS: Record<PaidPlan, string[]> = {
  starter: ["Every call logged and recorded", "Reports, Excel and PDF", "Team, follow-ups, scripts and call review", "Cloud calling and the AI agent"],
  growth: ["Everything in Starter", "Transcripts of every recorded call", "AI score, summary and coaching on each call", "Promises heard on calls become follow-ups"],
};
const TERM_LABEL: Record<number, string> = { 1: "Monthly", 3: "3 months", 12: "12 months" };
/** With the year: a plan paid today for 12 months ends on today's date next year. */
const until = (iso: string | null, tz: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { timeZone: tz, day: "numeric", month: "short", year: "numeric" }) : "—";

function Headline({ b, tz }: { b: Billing; tz: string }) {
  const s = b.subscription;
  const name = s.plan === "trial" ? "Free trial" : b.plans[s.plan].label;
  const [title, sub] =
    s.status === "trialing"
      ? [`Free trial · ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left`, "Every feature is on. Choose a plan before it ends and nothing stops."]
      : s.status === "active"
        ? [`${name} · ${s.seats} seat${s.seats === 1 ? "" : "s"}`, `Paid till ${until(s.endsAt, tz)}. Renewal opens 7 days before.`]
        : s.status === "past_due"
          ? [`Your ${name.toLowerCase()} ended on ${until(s.endsAt, tz)}`, `Everything keeps working till ${until(s.graceEndsAt, tz)}. Pay before then.`]
          : ["Your plan has ended", "Choose a plan to open the app again. Phones have kept sending calls — nothing was lost."];
  return (
    <View style={{ gap: 6 }}>
      <Text variant="display">{title}</Text>
      <Text tone="secondary">{sub}</Text>
    </View>
  );
}

function SeatMeter({ used, seats }: { used: number; seats: number | null }) {
  const cap = seats ?? used;
  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={seats ? `${used} of ${seats} seats in use` : `${used} members`}>
      <View style={styles.meterRow}>
        <Text variant="label">{seats ? `${used} of ${seats} seats in use` : `${used} member${used === 1 ? "" : "s"} — the trial has no seat limit`}</Text>
      </View>
      {seats ? (
        <View style={styles.meter}>
          {Array.from({ length: Math.min(cap, 40) }, (_, i) => (
            <View key={i} style={[styles.seat, i < used && styles.seatOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PlanCard({ plan, b, selected, disabled, note, onPress }: { plan: PaidPlan; b: Billing; selected: boolean; disabled?: boolean; note?: string; onPress: () => void }) {
  const p = b.plans[plan];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      accessibilityLabel={`${p.label}, ${rupees(p.perSeatPaise)} per user per month${p.flatPaise ? ` plus ${rupees(p.flatPaise)} per month` : ""}`}
      style={({ hovered }: PressState) => [styles.plan, selected && styles.planOn, hovered && !selected && !disabled && { borderColor: palette.ink }, disabled && { opacity: 0.5 }]}
    >
      <View style={styles.planHead}>
        <Text variant="heading">{p.label}</Text>
        <View style={[styles.radio, selected && styles.radioOn]} />
      </View>
      <Text style={styles.price}>
        {rupees(p.perSeatPaise)}
        <Text tone="secondary" style={styles.per}>
          {" "}
          / user / month
        </Text>
      </Text>
      <Text variant="caption" tone={p.flatPaise ? "primary" : "tertiary"}>
        {p.flatPaise ? `+ ${rupees(p.flatPaise)} / month for the company` : "No company fee"}
      </Text>
      <View style={{ gap: 4, marginTop: space.sm }}>
        {PLAN_POINTS[plan].map((t) => (
          <Text key={t} variant="caption" tone="secondary">
            — {t}
          </Text>
        ))}
      </View>
      {note ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: space.xs }}>
          {note}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Stepper({ value, min, onChange }: { value: number; min: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  // the buttons changed it: show the new number
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(String(value));
  }
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} accessibilityRole="button" accessibilityLabel="One seat fewer" style={[styles.step, value <= min && { opacity: 0.4 }]}>
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t.replace(/\D/g, ""));
          const n = Number(t.replace(/\D/g, ""));
          if (n >= min && n <= 5000) onChange(n);
        }}
        onBlur={() => setText(String(value))}
        inputMode="numeric"
        accessibilityLabel="Seats"
        style={styles.stepInput}
      />
      <Pressable onPress={() => onChange(Math.min(5000, value + 1))} accessibilityRole="button" accessibilityLabel="One seat more" style={styles.step}>
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

/** The bill, printed: what's paid for, the GST, the total. */
function Receipt({ q, loading }: { q?: { lines: { label: string; amountPaise: number }[]; subtotalPaise: number; cgst: number; sgst: number; igst: number; totalPaise: number }; loading: boolean }) {
  return (
    <View style={[styles.receipt, loading && { opacity: 0.6 }]} accessibilityLabel="Bill">
      <Text variant="eyebrow" tone="tertiary">
        You pay
      </Text>
      {(q?.lines ?? []).map((l) => (
        <View key={l.label} style={styles.rLine}>
          <Text variant="caption" style={{ flex: 1 }}>
            {l.label}
          </Text>
          <Text style={styles.rAmt}>{rupees(l.amountPaise)}</Text>
        </View>
      ))}
      <View style={styles.rRule} />
      <View style={styles.rLine}>
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
          Before GST
        </Text>
        <Text style={styles.rAmt}>{q ? rupees(q.subtotalPaise) : "—"}</Text>
      </View>
      {q?.igst ? (
        <View style={styles.rLine}>
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            IGST 18%
          </Text>
          <Text style={styles.rAmt}>{rupees(q.igst)}</Text>
        </View>
      ) : (
        <View style={styles.rLine}>
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            CGST 9% + SGST 9%
          </Text>
          <Text style={styles.rAmt}>{q ? rupees(q.cgst + q.sgst) : "—"}</Text>
        </View>
      )}
      <View style={[styles.rRule, { backgroundColor: palette.ink }]} />
      <View style={styles.rLine}>
        <Text variant="bodyMedium" style={{ flex: 1 }}>
          Total
        </Text>
        <Text style={styles.total} accessibilityLabel={q ? `Total ${rupees(q.totalPaise)}` : undefined}>
          {q ? rupees(q.totalPaise) : "—"}
        </Text>
      </View>
    </View>
  );
}

function InvoiceRow({ inv, tz, last, wide }: { inv: Invoice; tz: string; last: boolean; wide: boolean }) {
  const [busy, setBusy] = useState(false);
  const gst = inv.cgst + inv.sgst + inv.igst;
  return (
    <View style={[styles.inv, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {inv.number ?? "Awaiting payment"}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {dateIn(inv.paidAt ?? inv.createdAt, tz)} · {inv.kind === "change" ? "Seats / upgrade" : `${inv.seats} seat${inv.seats === 1 ? "" : "s"} × ${inv.months} mo`}
        </Text>
      </View>
      {wide ? (
        <>
          <Text style={[styles.rAmt, styles.invCol]} accessibilityLabel={`Before GST ${rupees(inv.subtotalPaise)}`}>
            {rupees(inv.subtotalPaise)}
          </Text>
          <Text style={[styles.rAmt, styles.invCol]} accessibilityLabel={`GST ${rupees(gst)}`}>
            {rupees(gst)}
          </Text>
        </>
      ) : null}
      <Text style={[styles.rAmt, wide && styles.invCol]}>{rupees(inv.totalPaise)}</Text>
      {wide ? (
        <Text variant="caption" tone="secondary" style={styles.invMethod} numberOfLines={1}>
          {inv.paymentMethod ? PAYMENT_METHOD_LABEL[inv.paymentMethod] : inv.status === "paid" ? "—" : ""}
        </Text>
      ) : null}
      {inv.status === "paid" ? (
        <Button
          kind="ghost"
          size="sm"
          label="PDF"
          loading={busy}
          accessibilityHint={`Download invoice ${inv.number}`}
          onPress={async () => {
            setBusy(true);
            await downloadExport(`/billing/invoices/${inv.id}/pdf`, {}, `${inv.number?.replaceAll("/", "-")}.pdf`).catch(() => null);
            setBusy(false);
          }}
        />
      ) : (
        <Tag label={inv.status === "pending" ? "Pending" : "Cancelled"} tone="dashed" />
      )}
    </View>
  );
}

/**
 * The owner's billing: where the account stands, seats, choosing or growing
 * a plan with the bill worked out as you go, paying through Razorpay, and
 * the GST invoices. `invoiceId`: back from the payment page — wait for it.
 */
export function BillingPanel({ invoiceId }: { invoiceId?: string }) {
  const tz = useAuthStore((s) => s.company?.timezone ?? "Asia/Kolkata");
  const { isWide } = useBreakpoint();
  const billing = useBilling();
  const b = billing.data;
  const s = b?.subscription;
  // mid-period: grow the plan; otherwise (trial, renewal window, ended): buy a period
  const growing = Boolean(s && s.plan !== "trial" && s.status === "active" && s.daysLeft > 7);

  const [plan, setPlan] = useState<PaidPlan>("starter");
  const [seats, setSeats] = useState(0);
  const [months, setMonths] = useState(1);
  const [pending, setPending] = useState<string | null>(invoiceId ?? null);
  const minSeats = growing ? (s?.seats ?? 1) : Math.max(1, b?.usedSeats ?? 1);

  // start from what they have
  const [seeded, setSeeded] = useState(false);
  if (b && !seeded) {
    setSeeded(true);
    setPlan(s && s.plan !== "trial" ? s.plan : "starter");
    setSeats(Math.max(b.usedSeats, s?.seats ?? 0, 1));
  }

  const purchase: Purchase = growing ? { kind: "change", plan, seats } : { kind: "subscription", plan, seats, months };
  const changes = !growing || seats > (s?.seats ?? 0) || (plan === "growth" && s?.plan === "starter");
  const quote = useBillingQuote(purchase, Boolean(b) && seats >= minSeats && changes);

  const checkout = useCheckout();
  const pay = () =>
    checkout.mutate(purchase, {
      onSuccess: (inv) => {
        setPending(inv.id);
        if (inv.payUrl) void Linking.openURL(inv.payUrl);
      },
    });
  const waiting = useInvoice(pending);
  const testPay = useTestPay();

  if (billing.isError) return <Banner tone="error" message={apiErrorMessage(billing.error)} />;
  if (!b || !s) return <Text tone="tertiary">Loading billing…</Text>;

  const inv = waiting.data;

  return (
    <View style={{ gap: space.xl }}>
      <Headline b={b} tz={tz} />
      <SeatMeter used={b.usedSeats} seats={s.seats} />

      {b.provider === "test" ? <Banner title="Test mode" message="Razorpay isn't set up on this server, so no money moves: a test button marks invoices paid. Add the Razorpay keys to take real payments." /> : null}
      {b.provider === "off" ? <Banner tone="error" message="Payments aren't set up on this server yet." /> : null}

      {inv && inv.status === "paid" ? (
        <Banner tone="success" title="Payment received" message={`Invoice ${inv.number} — ${rupees(inv.totalPaise)}. ${inv.kind === "change" ? `You now have ${inv.seats} seats.` : `Paid till ${until(inv.periodEnd, tz)}.`}`} />
      ) : null}

      {inv && inv.status === "pending" ? (
        <Card style={{ gap: space.sm }}>
          <Text variant="heading">Waiting for payment · {rupees(inv.totalPaise)}</Text>
          <Text variant="caption" tone="secondary">
            {inv.provider === "razorpay"
              ? "Pay on the Razorpay page — UPI, card or net banking. This page updates by itself once Razorpay confirms it."
              : "Test mode: mark it paid to see what happens after a real payment."}
          </Text>
          <View style={styles.row}>
            {inv.payUrl ? <Button size="sm" label="Open payment page" onPress={() => void Linking.openURL(inv.payUrl!)} /> : null}
            {inv.provider === "test" ? <Button size="sm" label="Mark as paid (test)" loading={testPay.isPending} onPress={() => testPay.mutate(inv.id)} /> : null}
            <Button kind="quiet" size="sm" label="Choose something else" onPress={() => setPending(null)} />
          </View>
        </Card>
      ) : (
        <View style={[styles.buy, isWide && { flexDirection: "row", alignItems: "flex-start" }]}>
          <View style={{ flex: 1, gap: space.lg }}>
            <Text variant="label">{growing ? "Add seats or upgrade — charged for the days left" : s.plan === "trial" ? "Choose a plan" : "Renew"}</Text>
            <View style={[styles.plans, isWide && { flexDirection: "row" }]} accessibilityRole="radiogroup">
              {(["starter", "growth"] as PaidPlan[]).map((p) => (
                <PlanCard
                  key={p}
                  plan={p}
                  b={b}
                  selected={plan === p}
                  disabled={growing && p === "starter" && s.plan === "growth"}
                  note={growing && p === "starter" && s.plan === "growth" ? "Moving to Starter is chosen at renewal." : undefined}
                  onPress={() => setPlan(p)}
                />
              ))}
            </View>
            <View style={styles.row}>
              <View style={{ gap: 6 }}>
                <Text variant="label">Seats</Text>
                <Stepper value={seats} min={minSeats} onChange={setSeats} />
                <Text variant="caption" tone="tertiary">
                  {growing ? `You have ${s.seats}. Fewer seats are chosen at renewal.` : `At least ${b.usedSeats} — everyone switched on in Team.`}
                </Text>
              </View>
              {!growing ? (
                <View style={{ gap: 6 }}>
                  <Text variant="label">Pay for</Text>
                  <View style={styles.row} accessibilityRole="radiogroup">
                    {b.terms.map((t) => (
                      <Chip key={t} role="radio" label={TERM_LABEL[t] ?? `${t} months`} selected={months === t} onPress={() => setMonths(t)} />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          </View>
          <View style={[{ gap: space.md }, isWide && { width: 340 }]}>
            <Receipt q={changes ? quote.data : undefined} loading={quote.isFetching} />
            {quote.isError ? <Banner tone="error" message={apiErrorMessage(quote.error)} /> : null}
            {checkout.isError ? <Banner tone="error" message={apiErrorMessage(checkout.error)} /> : null}
            <Button
              label={quote.data && changes ? `Pay ${rupees(quote.data.totalPaise)}` : growing ? "Choose more seats or Growth" : "Pay"}
              disabled={!quote.data || !changes || quote.isError || b.provider === "off" || seats < minSeats}
              loading={checkout.isPending}
              onPress={pay}
            />
            <Text variant="caption" tone="tertiary" align="center">
              Prices before 18% GST. A GST invoice is issued when you pay.
            </Text>
          </View>
        </View>
      )}

      {b.invoices.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label">Invoices</Text>
          <Card padded={false} style={{ overflow: "hidden" }}>
            {isWide ? (
              <View style={styles.invHead}>
                <Text style={[styles.th, { flex: 1 }]}>Invoice</Text>
                <Text style={[styles.th, styles.invCol]}>Before GST</Text>
                <Text style={[styles.th, styles.invCol]}>GST 18%</Text>
                <Text style={[styles.th, styles.invCol]}>Total</Text>
                <Text style={[styles.th, styles.invMethod]}>Paid by</Text>
                <View style={{ width: 64 }} />
              </View>
            ) : null}
            {b.invoices.map((i, n) => (
              <InvoiceRow key={i.id} inv={i} tz={tz} last={n === b.invoices.length - 1} wide={isWide} />
            ))}
          </Card>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.lg, alignItems: "flex-start" },
  meterRow: { flexDirection: "row", justifyContent: "space-between" },
  meter: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  seat: { width: 14, height: 14, borderRadius: 3, borderWidth: 1, borderColor: palette.ruleStrong },
  seatOn: { backgroundColor: palette.ink, borderColor: palette.ink },
  buy: { gap: space.xl },
  plans: { gap: space.md },
  plan: { flex: 1, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.ruleStrong, backgroundColor: palette.card, gap: 4 },
  planOn: { borderColor: palette.ink, borderWidth: 2, padding: space.lg - 1 },
  planHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: palette.ruleStrong },
  radioOn: { borderColor: palette.ink, borderWidth: 5 },
  price: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: palette.ink, marginTop: space.xs },
  per: { fontFamily: fonts.text, fontSize: 13 },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: palette.ruleStrong, borderRadius: radius.md, alignSelf: "flex-start", backgroundColor: palette.card },
  step: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  stepText: { fontFamily: fonts.textMedium, fontSize: 18, color: palette.ink },
  stepInput: { width: 56, height: 40, textAlign: "center", fontFamily: fonts.monoMedium, fontSize: 16, color: palette.ink, borderLeftWidth: 1, borderRightWidth: 1, borderColor: palette.rule },
  receipt: {
    padding: space.lg,
    gap: space.sm,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.rule,
    borderStyle: "dashed",
    borderRadius: radius.sm,
  },
  rLine: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  rAmt: { fontFamily: fonts.mono, fontSize: 13, color: palette.ink },
  rRule: { height: 1, backgroundColor: palette.rule, marginVertical: 2 },
  total: { fontFamily: fonts.monoMedium, fontSize: 22, color: palette.ink },
  invCol: { width: 96, textAlign: "right" },
  invMethod: { width: 90 },
  invHead: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.ink },
  th: { fontFamily: fonts.mono, fontSize: 10.5, color: palette.ink3, textTransform: "uppercase", letterSpacing: 0.4 },
  inv: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderBottomWidth: 1, borderBottomColor: palette.rule },
});

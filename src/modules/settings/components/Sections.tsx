import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { apiErrorMessage } from "@api/apiClient";
import { downloadExport } from "@api/download";
import { formatPhone } from "@shared/format";
import { palette, radius, space } from "@shared/designSystem";
import { Banner, Button, Chip, Text, TextField, TONE_COLOR } from "@shared/ui";
import type { Company } from "@modules/auth/types";
import { IndustryPicker } from "@modules/auth/components/IndustryPicker";
import type { ImportResult } from "../types";
import {
  useAddExcluded,
  useExcludedNumbers,
  useImportExcluded,
  useRemoveExcluded,
  useSaveDispositions,
  useSaveNotifications,
  useSaveTelephonyNumber,
  useSaveWorkingHours,
  useSetExcludedActive,
  useUpdateOrganization,
} from "../hooks/useSettings";
import { useTelephony } from "@modules/telephony/hooks/useTelephony";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TONES = ["hot", "warm", "cold", "caution", "missed", "connected", "neutral"];

function Saved({ m }: { m: { isSuccess: boolean; isError: boolean; error: unknown } }) {
  if (m.isError) return <Banner tone="error" message={apiErrorMessage(m.error)} />;
  if (m.isSuccess) return <Banner tone="success" message="Saved." />;
  return null;
}

// ---- call statuses ---------------------------------------------------------

const editableOf = (c: Company) => c.dispositions.filter((d) => !d.fixed).map(({ key, label, tone }) => ({ key, label, tone }));

export function StatusesSection({ company }: { company: Company }) {
  const initial = editableOf(company);
  const [rows, setRows] = useState(initial);
  const save = useSaveDispositions();
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <View style={styles.section}>
      <Text tone="secondary">
        What reps pick after a call. Renaming changes new calls only — last month’s reports keep what was picked then. Up to five of your own, plus three that are always there.
      </Text>
      <Saved m={save} />
      {rows.map((r, i) => (
        <View key={r.key ?? `new-${i}`} style={styles.statusRow}>
          <View style={{ flex: 1 }}>
            <TextField label={`Status ${i + 1}`} value={r.label} onChangeText={(label) => set(i, { label })} maxLength={24} />
          </View>
          <View style={styles.tones} accessibilityRole="radiogroup" accessibilityLabel={`Colour for ${r.label}`}>
            {TONES.map((t) => (
              <Pressable
                key={t}
                accessibilityRole="radio"
                accessibilityLabel={t}
                aria-checked={r.tone === t}
                onPress={() => set(i, { tone: t })}
                style={[styles.tone, { backgroundColor: TONE_COLOR[t] }, r.tone === t && styles.toneOn]}
              />
            ))}
          </View>
          <Button kind="quiet" size="sm" label="Remove" onPress={() => setRows((x) => x.filter((_, j) => j !== i))} />
        </View>
      ))}
      {rows.length < 5 ? <Button kind="ghost" size="sm" label="Add a status" onPress={() => setRows((x) => [...x, { key: "", label: "", tone: "neutral" }])} /> : null}
      <View style={styles.fixed}>
        <Text variant="eyebrow" tone="tertiary">
          Always available
        </Text>
        <View style={styles.chips}>
          {company.dispositions.filter((d) => d.fixed).map((d) => (
            <Chip key={d.key} label={d.label} tone={d.tone} />
          ))}
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label="Save statuses"
          disabled={!dirty || rows.some((r) => r.label.trim().length < 2)}
          loading={save.isPending}
          onPress={() =>
            save.mutate(
              rows.map((r) => ({ ...(r.key ? { key: r.key } : {}), label: r.label.trim(), tone: r.tone })),
              // new rows come back with their real keys
              { onSuccess: (saved) => setRows(editableOf(saved)) },
            )
          }
        />
        {dirty ? <Button kind="quiet" label="Undo changes" onPress={() => setRows(initial)} /> : null}
      </View>
    </View>
  );
}

// ---- excluded numbers -------------------------------------------------------

export function ExcludedSection() {
  const [search, setSearch] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [imported, setImported] = useState<ImportResult | null>(null);
  const list = useExcludedNumbers(search);
  const add = useAddExcluded();
  const toggle = useSetExcludedActive();
  const remove = useRemoveExcluded();
  const imp = useImportExcluded();
  const err = add.error ?? toggle.error ?? remove.error ?? imp.error;

  async function pick() {
    const r = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "text/comma-separated-values", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      copyToCacheDirectory: true,
    });
    if (!r.canceled && r.assets[0]) imp.mutate(r.assets[0], { onSuccess: setImported });
  }

  return (
    <View style={styles.section}>
      <Text tone="secondary">
        Numbers never tracked: a rep’s family, the office landline, suppliers. Calls to them are dropped when the phone sends them, and left out of every report.
      </Text>
      {err ? <Banner tone="error" message={apiErrorMessage(err)} /> : null}
      {imported ? (
        <Banner
          tone={imported.invalidCount ? "info" : "success"}
          message={`${imported.added} added, ${imported.updated} already on the list.${imported.invalidCount ? ` ${imported.invalidCount} row(s) skipped — not a phone number: ${imported.invalid.map((i) => `row ${i.row}`).join(", ")}.` : ""}`}
        />
      ) : null}

      <View style={styles.addRow}>
        <View style={{ flex: 1, minWidth: 180 }}>
          <TextField label="Phone number" prefix="+91" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98765 43210" />
        </View>
        <View style={{ flex: 1, minWidth: 160 }}>
          <TextField label="Name (optional)" value={name} onChangeText={setName} placeholder="Home" />
        </View>
        <Button label="Add" disabled={phone.replace(/\D/g, "").length < 10} loading={add.isPending} onPress={() =>
            add.mutate(
              { phone, name },
              {
                onSuccess: () => {
                  setPhone("");
                  setName("");
                },
              },
            )
          }
        />
      </View>

      <View style={styles.chips}>
        <Button kind="ghost" size="sm" label="Import CSV or Excel" loading={imp.isPending} onPress={pick} />
        <Button kind="quiet" size="sm" label="Sample file" onPress={() => downloadExport("/excluded-numbers/sample.xlsx", {}, "excluded-numbers-sample.xlsx")} />
        <Button kind="quiet" size="sm" label="Export list" onPress={() => downloadExport("/excluded-numbers/export.xlsx", {}, "excluded-numbers.xlsx")} />
      </View>

      <TextField label="Search the list" value={search} onChangeText={setSearch} placeholder="Name or digits" />
      <View style={styles.list}>
        {(list.data?.items ?? []).map((x) => (
          <View key={x.id} style={styles.listRow}>
            <View style={{ flex: 1 }}>
              <Text variant="mono" style={!x.isActive && { color: palette.ink3, textDecorationLine: "line-through" }}>
                {formatPhone(x.phone)}
              </Text>
              {x.name ? (
                <Text variant="caption" tone="tertiary">
                  {x.name}
                </Text>
              ) : null}
            </View>
            <Chip role="checkbox" label={x.isActive ? "Excluded" : "Paused"} selected={x.isActive} onPress={() => toggle.mutate({ id: x.id, on: !x.isActive })} />
            <Button kind="quiet" size="sm" label="Delete" onPress={() => remove.mutate(x.id)} />
          </View>
        ))}
        {list.data && !list.data.items.length ? (
          <Text variant="caption" tone="tertiary" style={{ padding: space.md }}>
            {search ? "Nothing matches." : "No numbers excluded yet."}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ---- working hours ----------------------------------------------------------

export function HoursSection({ company }: { company: Company }) {
  const wh = company.workingHours;
  const [start, setStart] = useState(wh.start);
  const [end, setEnd] = useState(wh.end);
  const [brk, setBrk] = useState(String(wh.breakMinutes));
  const [days, setDays] = useState(wh.days);
  const save = useSaveWorkingHours();
  const valid = /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) && start < end && days.length > 0;

  return (
    <View style={styles.section}>
      <Text tone="secondary">Reports split talk time into inside and outside these hours, in {company.timezone.replace("_", " ")}.</Text>
      <Saved m={save} />
      <View style={styles.addRow}>
        <View style={{ flex: 1, minWidth: 120 }}>
          <TextField label="Day starts" value={start} onChangeText={setStart} placeholder="10:00" hint="24-hour, HH:MM" />
        </View>
        <View style={{ flex: 1, minWidth: 120 }}>
          <TextField label="Day ends" value={end} onChangeText={setEnd} placeholder="19:00" />
        </View>
        <View style={{ flex: 1, minWidth: 120 }}>
          <TextField label="Break (minutes)" value={brk} onChangeText={(v) => setBrk(v.replace(/\D/g, ""))} keyboardType="number-pad" />
        </View>
      </View>
      <Text variant="label">Working days</Text>
      <View style={styles.chips}>
        {DAYS.map((d, i) => (
          <Chip key={d} role="checkbox" label={d} selected={days.includes(i)} onPress={() => setDays((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i].sort()))} />
        ))}
      </View>
      <View style={styles.actions}>
        <Button
          label="Save hours"
          disabled={!valid}
          loading={save.isPending}
          onPress={() => save.mutate({ start, end, breakMinutes: Math.min(240, Number(brk) || 0), days })}
        />
      </View>
    </View>
  );
}

// ---- daily email + popup ------------------------------------------------------

export function NotificationsSection({ company }: { company: Company }) {
  const d = company.dailyReport ?? { enabled: false, formats: ["pdf" as const], recipients: [], days: [1, 2, 3, 4, 5, 6] };
  const [enabled, setEnabled] = useState(d.enabled);
  const [formats, setFormats] = useState<("pdf" | "xlsx")[]>(d.formats);
  const [recipients, setRecipients] = useState<string[]>(d.recipients);
  const [days, setDays] = useState(d.days);
  const [draft, setDraft] = useState("");
  const [popup, setPopup] = useState(company.afterCallPopup);
  const save = useSaveNotifications();

  const addEmail = () => {
    const parts = draft.split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
    if (parts.length) setRecipients((r) => [...new Set([...r, ...parts])].slice(0, 20));
    setDraft("");
  };
  const toggleFormat = (f: "pdf" | "xlsx") => setFormats((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]));

  return (
    <View style={styles.section}>
      <Saved m={save} />
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text variant="heading">After-call popup</Text>
          <Text variant="caption" tone="secondary">
            The Android app asks for a status and notes when each call ends. Off: reps can still set them from the call log.
          </Text>
        </View>
        <Chip role="checkbox" label={popup ? "On" : "Off"} selected={popup} onPress={() => setPopup(!popup)} />
      </View>

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text variant="heading">Daily report by email</Text>
          <Text variant="caption" tone="secondary">
            Sent 30 minutes after the working day ends, with the day’s numbers and a report attached.
          </Text>
        </View>
        <Chip role="checkbox" label={enabled ? "On" : "Off"} selected={enabled} onPress={() => setEnabled(!enabled)} />
      </View>

      {enabled ? (
        <View style={{ gap: space.md }}>
          <Text variant="label">Attach as</Text>
          <View style={styles.chips}>
            <Chip role="checkbox" label="PDF" selected={formats.includes("pdf")} onPress={() => toggleFormat("pdf")} />
            <Chip role="checkbox" label="Excel" selected={formats.includes("xlsx")} onPress={() => toggleFormat("xlsx")} />
          </View>
          <View style={styles.addRow}>
            <View style={{ flex: 1, minWidth: 220 }}>
              <TextField
                label="Send to"
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={addEmail}
                placeholder="name@company.com"
                autoCapitalize="none"
                keyboardType="email-address"
                hint="Press Enter to add. Up to 20."
              />
            </View>
            <Button kind="ghost" label="Add" onPress={addEmail} disabled={!draft.trim()} />
          </View>
          <View style={styles.chips}>
            {recipients.map((r) => (
              <Chip key={r} label={`${r}  ×`} onPress={() => setRecipients((x) => x.filter((y) => y !== r))} />
            ))}
          </View>
          <Text variant="label">On these days</Text>
          <View style={styles.chips}>
            {DAYS.map((dd, i) => (
              <Chip key={dd} role="checkbox" label={dd} selected={days.includes(i)} onPress={() => setDays((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i].sort()))} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Save"
          disabled={enabled && (!recipients.length || !formats.length)}
          loading={save.isPending}
          onPress={() => save.mutate({ afterCallPopup: popup, dailyReport: { enabled, formats, recipients, days } })}
        />
      </View>
    </View>
  );
}

// ---- organisation -------------------------------------------------------------

const SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];

export function OrganizationSection({ company }: { company: Company }) {
  const a = company.address ?? { line: "", city: "", state: "", country: "India", pin: "" };
  const [f, setF] = useState({
    name: company.name,
    industry: company.industry,
    teamSize: company.teamSize ?? null,
    website: company.website ?? "",
    gstin: company.gstin ?? "",
    line: a.line,
    city: a.city,
    state: a.state,
    country: a.country,
    pin: a.pin,
  });
  const save = useUpdateOrganization();
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <View style={styles.section}>
      <Saved m={save} />
      <TextField label="Company name" value={f.name} onChangeText={set("name")} />
      <IndustryPicker label="Industry" value={f.industry} onChange={(industry) => setF((x) => ({ ...x, industry }))} />
      <Text variant="caption" tone="tertiary">
        Decides which call scripts and WhatsApp messages the library opens on.
      </Text>
      <Text variant="label">Team size</Text>
      <View style={styles.chips}>
        {SIZES.map((s) => (
          <Chip key={s} role="radio" label={s} selected={f.teamSize === s} onPress={() => setF((x) => ({ ...x, teamSize: s }))} />
        ))}
      </View>
      <TextField label="Website" value={f.website} onChangeText={set("website")} placeholder="https://example.com" autoCapitalize="none" keyboardType="url" />
      <TextField label="GSTIN" value={f.gstin} onChangeText={(v) => set("gstin")(v.toUpperCase())} placeholder="24ABCDE1234F1Z5" autoCapitalize="characters" hint="Printed on your invoices." maxLength={15} />
      <TextField label="Address" value={f.line} onChangeText={set("line")} />
      <View style={styles.addRow}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <TextField label="City" value={f.city} onChangeText={set("city")} />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <TextField label="State" value={f.state} onChangeText={set("state")} />
        </View>
      </View>
      <View style={styles.addRow}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <TextField label="Country" value={f.country} onChangeText={set("country")} />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <TextField label="PIN code" value={f.pin} onChangeText={(v) => set("pin")(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label="Save organisation"
          loading={save.isPending}
          disabled={f.name.trim().length < 2}
          onPress={() =>
            save.mutate({
              name: f.name.trim(),
              industry: f.industry,
              ...(f.teamSize ? { teamSize: f.teamSize } : {}),
              website: f.website.trim(),
              gstin: f.gstin.trim(),
              address: { line: f.line, city: f.city, state: f.state, country: f.country, pin: f.pin },
            })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  statusRow: { flexDirection: "row", alignItems: "flex-end", gap: space.md, flexWrap: "wrap" },
  tones: { flexDirection: "row", gap: 6, paddingBottom: 14 },
  tone: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: palette.card },
  toneOn: { borderColor: palette.ink, transform: [{ scale: 1.15 }] },
  fixed: { gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: palette.rule },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  addRow: { flexDirection: "row", gap: space.md, alignItems: "flex-end", flexWrap: "wrap" },
  list: { borderWidth: 1, borderColor: palette.rule, borderRadius: radius.md },
  listRow: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, borderBottomWidth: 1, borderBottomColor: palette.rule },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: palette.rule },
});

// ---- cloud calling -----------------------------------------------------------

export function CloudCallingSection({ company }: { company: Company }) {
  const tel = useTelephony();
  const [number, setNumber] = useState(company.telephonyNumber ?? "");
  const save = useSaveTelephonyNumber();
  const valid = number === "" || /^\+[1-9]\d{7,14}$/.test(number.trim());

  return (
    <View style={styles.section}>
      <Text tone="secondary">
        Reps on a laptop call from the dashboard over the company’s Twilio number. Every call is recorded, transcribed and logged with the phone calls.
      </Text>
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text variant="heading">{tel.data?.enabled ? "Calling from the browser is on" : "Not set up yet"}</Text>
          <Text variant="caption" tone="secondary">
            {tel.data?.enabled
              ? `Calls go out from ${tel.data.callerId}.`
              : "Needs the Twilio account, a TwiML App and a public API address — see docs/TELEPHONY.md."}
          </Text>
        </View>
      </View>
      <Saved m={save} />
      <TextField
        label="Company’s Twilio number"
        value={number}
        onChangeText={setNumber}
        placeholder="+14155550100"
        autoCapitalize="none"
        keyboardType="phone-pad"
        hint="Clients see this number, and calls to it ring your team’s browsers. As Twilio shows it, with + and the country code."
        error={valid ? undefined : "Use + and the country code, digits only"}
      />
      <View style={styles.actions}>
        <Button
          label="Save number"
          disabled={!valid || number.trim() === (company.telephonyNumber ?? "")}
          loading={save.isPending}
          onPress={() => save.mutate(number.trim() || null)}
        />
      </View>
    </View>
  );
}

import { StyleSheet, View } from "react-native";
import { palette, space } from "@shared/designSystem";
import { Card, Icon, Tag, Text } from "@shared/ui";
import { InviteCard } from "@modules/company/components/InviteCard";
import { useTeam } from "@modules/team/hooks/useTeam";
import type { Company } from "@modules/auth/types";

interface Step {
  label: string;
  detail: string;
  done: boolean;
  soon?: boolean;
}

/** Shown to managers until their team has made its first call. */
export function SetupPanel({ company }: { company: Company }) {
  const team = useTeam({ status: "active" });
  const reps = team.data?.items.filter((u) => u.role === "rep").length ?? 0;
  const steps: Step[] = [
    { label: "Create your company", detail: `${company.name} is set up.`, done: true },
    {
      label: "Get your first rep in",
      detail: reps ? `${reps} rep${reps === 1 ? "" : "s"} joined.` : "Share your company code with your team.",
      done: reps > 0,
    },
    { label: "Install the app on each rep’s phone", detail: "Android 10 or newer. Tracks calls on the work SIM.", done: false, soon: true },
    { label: "First call recorded", detail: "Appears on this screen within a minute of the call.", done: false },
  ];
  const done = steps.filter((s) => s.done).length;

  return (
    <View style={styles.wrap}>
      <Card padded={false} style={{ flex: 1.4, minWidth: 300 }}>
        <View style={styles.head}>
          <Text variant="heading">Getting set up</Text>
          <Text variant="mono" tone="tertiary">
            {done}/{steps.length}
          </Text>
        </View>
        {steps.map((s, i) => (
          <View
            key={s.label}
            style={[styles.step, i === steps.length - 1 && { borderBottomWidth: 0 }]}
            accessible
            accessibilityLabel={`${s.label}. ${s.done ? "Done" : s.soon ? "Coming soon" : "Not done yet"}. ${s.detail}`}
          >
            <View style={[styles.tick, s.done && styles.tickDone]}>{s.done ? <Icon name="check" size={14} color={palette.paper} /> : null}</View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyMedium" tone={s.done ? "tertiary" : "primary"} style={s.done && { textDecorationLine: "line-through" }}>
                {s.label}
              </Text>
              <Text variant="caption" tone="secondary">
                {s.detail}
              </Text>
            </View>
            {s.soon ? <Tag label="Coming soon" tone="dashed" /> : null}
          </View>
        ))}
      </Card>
      {company.code ? (
        <View style={{ flex: 1, minWidth: 280 }}>
          <InviteCard code={company.code} companyName={company.name} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    borderBottomWidth: 1,
    borderBottomColor: palette.rule,
  },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: palette.ruleStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  tickDone: { backgroundColor: palette.connected, borderColor: palette.connected },
});

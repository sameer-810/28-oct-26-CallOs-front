import { StyleSheet, View } from "react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import { space } from "@shared/designSystem";
import { Button, Screen, Text } from "@shared/ui";
import { Brand } from "@shared/ui/BrandMark";
import { BillingPanel } from "./BillingPanel";

/**
 * Shown instead of the app once a plan has ended past its grace days. The
 * owner can pay right here; everyone else is told who can. Phones keep
 * sending calls underneath, so nothing is lost meanwhile.
 */
export function PlanEnded() {
  const user = useAuthStore((s) => s.user);
  const company = useAuthStore((s) => s.company);
  const logout = useAuthStore((s) => s.logout);

  if (user?.role === "owner") {
    return (
      <Screen>
        <View style={styles.brand}>
          <Brand />
          <Button kind="quiet" size="sm" label="Sign out" onPress={() => void logout()} />
        </View>
        <BillingPanel />
      </Screen>
    );
  }
  return (
    <Screen maxWidth={520}>
      <View style={styles.brand}>
        <Brand />
      </View>
      <View style={{ gap: space.md, marginTop: space.xxl }}>
        <Text variant="eyebrow" tone="tertiary">
          {company?.name}
        </Text>
        <Text variant="display">The plan has ended</Text>
        <Text tone="secondary">
          Your company’s plan needs renewing before the app opens again. Ask the account owner — it takes them a minute in Billing. Your calls are still being saved from your phone.
        </Text>
        <Button kind="ghost" label="Sign out" onPress={() => void logout()} style={{ alignSelf: "flex-start", marginTop: space.md }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.xl },
});

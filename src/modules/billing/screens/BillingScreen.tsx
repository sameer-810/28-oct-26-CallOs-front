import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { AppTabParamList } from "@navigation/types";
import { Screen, Text } from "@shared/ui";
import { BillingPanel } from "../components/BillingPanel";

type Props = BottomTabScreenProps<AppTabParamList, "Billing">;

export default function BillingScreen({ route }: Props) {
  return (
    <Screen>
      <Text variant="eyebrow" tone="tertiary" style={{ marginBottom: 6 }}>
        Plan & billing
      </Text>
      {/* back from Razorpay: ?invoice=… waits for that payment */}
      <BillingPanel key={route.params?.invoice ?? "billing"} invoiceId={route.params?.invoice} />
    </Screen>
  );
}

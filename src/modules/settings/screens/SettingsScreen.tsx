import { useState } from "react";
import { View } from "react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import { space } from "@shared/designSystem";
import { Card, Screen, Segmented, Text } from "@shared/ui";
import { CloudCallingSection, ExcludedSection, HoursSection, NotificationsSection, OrganizationSection, StatusesSection } from "../components/Sections";

type Section = "statuses" | "excluded" | "hours" | "notifications" | "calling" | "organization";

export default function SettingsScreen() {
  const company = useAuthStore((s) => s.company);
  const role = useAuthStore((s) => s.user?.role);
  const owner = role === "owner";
  const [section, setSection] = useState<Section>("statuses");
  if (!company) return null;

  const items: { id: Section; label: string }[] = [
    { id: "statuses", label: "Call statuses" },
    { id: "excluded", label: "Excluded numbers" },
    ...(owner
      ? ([
          { id: "hours", label: "Working hours" },
          { id: "notifications", label: "Notifications" },
          { id: "calling", label: "Cloud calling" },
          { id: "organization", label: "Organisation" },
        ] as const)
      : []),
  ];

  return (
    <Screen maxWidth={860}>
      <Text variant="eyebrow" tone="tertiary">
        {company.name}
      </Text>
      <Text variant="display" style={{ marginTop: 6 }}>
        Settings
      </Text>
      <View style={{ marginTop: space.xl }}>
        <Segmented label="Settings section" scroll value={section} onChange={setSection} items={items} />
      </View>
      <Card style={{ marginTop: space.lg }}>
        {/* each form starts from the saved values when its tab opens, and keeps its own "Saved." after */}
        {section === "statuses" ? <StatusesSection company={company} /> : null}
        {section === "excluded" ? <ExcludedSection /> : null}
        {section === "hours" && owner ? <HoursSection company={company} /> : null}
        {section === "notifications" && owner ? <NotificationsSection company={company} /> : null}
        {section === "calling" && owner ? <CloudCallingSection company={company} /> : null}
        {section === "organization" && owner ? <OrganizationSection company={company} /> : null}
      </Card>
    </Screen>
  );
}

import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@navigation/types";
import { apiErrorMessage } from "@api/apiClient";
import { FormField } from "@shared/form/FormField";
import { Banner, Button, Card, Text } from "@shared/ui";
import { space } from "@shared/designSystem";
import { AuthLayout } from "../components/AuthLayout";
import { CODE_LENGTH, CodeInput } from "../components/CodeInput";
import { useCodePreview, useJoin } from "../hooks/useAuth";
import { joinDetailsSchema, type JoinDetailsForm } from "../auth.validation";
import { INDUSTRY_LABEL } from "../types";

type Props = NativeStackScreenProps<AuthStackParamList, "Join">;

/**
 * Two steps: the code first, so the rep sees which company they're joining
 * before typing anything about themselves; then their details.
 */
export default function JoinScreen({ navigation, route }: Props) {
  const [code, setCode] = useState((route.params?.code ?? "").toUpperCase().slice(0, CODE_LENGTH));
  const preview = useCodePreview();
  const join = useJoin();
  const company = preview.data;

  const { control, handleSubmit } = useForm<JoinDetailsForm>({
    resolver: zodResolver(joinDetailsSchema),
    defaultValues: { name: "", phone: "", email: "", password: "" },
  });

  // a join link arrives with the code filled in
  useEffect(() => {
    if (route.params?.code && code.length === CODE_LENGTH) preview.mutate(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = handleSubmit((v) =>
    join.mutate({ code, name: v.name, phone: v.phone, password: v.password, email: v.email || undefined }),
  );

  if (!company) {
    return (
      <AuthLayout title="Join your team" subtitle="Ask your manager for your company's code.">
        <CodeInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (preview.isError) preview.reset();
          }}
          onComplete={(v) => preview.mutate(v)}
          error={preview.isError ? apiErrorMessage(preview.error) : undefined}
        />
        <Button
          label="Continue"
          onPress={() => preview.mutate(code)}
          disabled={code.length !== CODE_LENGTH}
          loading={preview.isPending}
        />
        <Button kind="quiet" label="Back to sign in" onPress={() => navigation.navigate("SignIn")} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Almost in" subtitle="Your details, so your calls show up under your name.">
      <Card style={styles.company}>
        <View style={{ flex: 1 }}>
          <Text variant="eyebrow" tone="tertiary">
            Joining
          </Text>
          <Text variant="title" style={styles.companyName}>
            {company.name}
          </Text>
          <Text variant="caption" tone="secondary">
            {INDUSTRY_LABEL[company.industry]}
          </Text>
        </View>
        <Button
          kind="quiet"
          size="sm"
          label="Change"
          accessibilityHint="Enter a different company code"
          onPress={() => {
            preview.reset();
            setCode("");
          }}
        />
      </Card>

      {join.isError ? <Banner tone="error" message={apiErrorMessage(join.error)} /> : null}

      <FormField control={control} name="name" label="Your name" autoComplete="name" />
      <FormField
        control={control}
        name="phone"
        label="Mobile number"
        prefix="+91"
        placeholder="98765 43210"
        keyboardType="phone-pad"
        autoComplete="tel"
        hint="Use the number on your work SIM."
      />
      <FormField
        control={control}
        name="email"
        label="Email (optional)"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <FormField
        control={control}
        name="password"
        label="Password"
        secureToggle
        autoComplete="new-password"
        hint="At least 8 characters."
        onSubmitEditing={submit}
      />
      <Button label={`Join ${company.name}`} onPress={submit} loading={join.isPending} testID="join-submit" />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  company: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  companyName: { fontSize: 26, lineHeight: 30, marginTop: 4, marginBottom: 2 },
});

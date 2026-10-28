import { StyleSheet, View } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@navigation/types";
import { apiErrorMessage } from "@api/apiClient";
import { FormField } from "@shared/form/FormField";
import { Banner, Button, Text } from "@shared/ui";
import { palette, space } from "@shared/designSystem";
import { AuthLayout } from "../components/AuthLayout";
import { IndustryPicker } from "../components/IndustryPicker";
import { useSignUp } from "../hooks/useAuth";
import { signUpSchema, type SignUpForm } from "../auth.validation";

type Props = NativeStackScreenProps<AuthStackParamList, "SignUp">;

export default function SignUpScreen({ navigation }: Props) {
  const signUp = useSignUp();
  const { control, handleSubmit } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { companyName: "", industry: "real_estate", name: "", phone: "", email: "", password: "" },
  });

  const submit = handleSubmit((v) => signUp.mutate(v));

  return (
    <AuthLayout
      title="Set up your company"
      subtitle="You'll get a code your team uses to join. Free for 14 days, no card needed."
    >
      {signUp.isError ? <Banner tone="error" message={apiErrorMessage(signUp.error)} /> : null}

      <Text variant="eyebrow" tone="tertiary">
        Company
      </Text>
      <FormField control={control} name="companyName" label="Company name" placeholder="Sevagiri Realty" autoComplete="organization" />
      <Controller
        control={control}
        name="industry"
        render={({ field }) => <IndustryPicker value={field.value} onChange={field.onChange} />}
      />

      <View style={styles.divider} />
      <Text variant="eyebrow" tone="tertiary">
        You
      </Text>
      <FormField control={control} name="name" label="Your name" autoComplete="name" />
      <FormField
        control={control}
        name="phone"
        label="Mobile number"
        prefix="+91"
        placeholder="98765 43210"
        keyboardType="phone-pad"
        autoComplete="tel"
        hint="You'll sign in with this."
      />
      <FormField
        control={control}
        name="email"
        label="Work email"
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
        hint="At least 8 characters. A short sentence works well."
        onSubmitEditing={submit}
      />

      <Button label="Create account" onPress={submit} loading={signUp.isPending} testID="signup-submit" />
      <Button kind="quiet" label="I already have an account" onPress={() => navigation.navigate("SignIn")} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: palette.rule, marginVertical: space.sm },
});

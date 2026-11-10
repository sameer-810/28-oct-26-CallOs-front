import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@navigation/types";
import { apiErrorMessage } from "@api/apiClient";
import { FormField } from "@shared/form/FormField";
import { Banner, Button, Text } from "@shared/ui";
import { space } from "@shared/designSystem";
import { AuthLayout } from "../components/AuthLayout";
import { useForgotPassword, useResetPassword } from "../hooks/useAuth";
import { forgotSchema, resetSchema, type ForgotForm, type ResetForm } from "../auth.validation";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;

/**
 * Forgot password, in two steps on one screen: the email, then the 6-digit
 * code from it with the new password. The link in the email lands here too,
 * with the email filled in.
 */
export default function ResetPasswordScreen({ navigation, route }: Props) {
  const forgot = useForgotPassword();
  const reset = useResetPassword();
  const [email, setEmail] = useState<string | null>(route.params?.email ?? null);

  const emailForm = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: route.params?.email ?? "" },
  });
  const codeForm = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { code: "", newPassword: "", confirm: "" },
  });

  const sendCode = emailForm.handleSubmit((v) =>
    forgot.mutate(v.email, { onSuccess: () => setEmail(v.email.trim().toLowerCase()) }),
  );
  const submit = codeForm.handleSubmit((v) =>
    reset.mutate({ email: email ?? "", code: v.code, newPassword: v.newPassword }),
  );

  if (reset.isSuccess) {
    return (
      <AuthLayout title="Password changed" subtitle="Sign in with your new password. Every device was signed out.">
        <Button label="Back to sign in" onPress={() => navigation.navigate("SignIn")} />
      </AuthLayout>
    );
  }

  if (!email) {
    return (
      <AuthLayout title="Reset your password" subtitle="Enter your email and we'll send you a code to reset your password.">
        {forgot.isError ? <Banner tone="error" message={apiErrorMessage(forgot.error)} /> : null}
        <FormField
          control={emailForm.control}
          name="email"
          label="Email"
          placeholder="you@company.com"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="go"
          onSubmitEditing={sendCode}
        />
        <Button label="Send code" onPress={sendCode} loading={forgot.isPending} testID="forgot-submit" />
        <Button kind="ghost" label="Back to sign in" onPress={() => navigation.navigate("SignIn")} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Enter the code" subtitle={`If ${email} has an account, a 6-digit code is on its way. It works for 30 minutes.`}>
      {reset.isError ? <Banner tone="error" message={apiErrorMessage(reset.error)} /> : null}
      <FormField
        control={codeForm.control}
        name="code"
        label="Code from the email"
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
      />
      <FormField control={codeForm.control} name="newPassword" label="New password" secureToggle autoComplete="new-password" />
      <FormField
        control={codeForm.control}
        name="confirm"
        label="New password again"
        secureToggle
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label="Set new password" onPress={submit} loading={reset.isPending} testID="reset-submit" />
      <View style={styles.row}>
        <Text tone="secondary">No email?</Text>
        <Button
          kind="ghost"
          label="Send it again"
          loading={forgot.isPending}
          onPress={() => forgot.mutate(email)}
        />
        <Button kind="ghost" label="Use another email" onPress={() => setEmail(null)} />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm },
});

import { useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@navigation/types";
import { apiErrorMessage } from "@api/apiClient";
import { FormField } from "@shared/form/FormField";
import { Banner, Button, Rule, Text } from "@shared/ui";
import { space } from "@shared/designSystem";
import { AuthLayout } from "../components/AuthLayout";
import { useSignIn } from "../hooks/useAuth";
import { signInSchema, type SignInForm } from "../auth.validation";

type Props = NativeStackScreenProps<AuthStackParamList, "SignIn">;

export default function SignInScreen({ navigation }: Props) {
  const signIn = useSignIn();
  const passwordRef = useRef<TextInput>(null);
  const { control, handleSubmit } = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const submit = handleSubmit((v) => signIn.mutate(v));

  return (
    <AuthLayout title="Sign in" subtitle="With the mobile number or email you signed up with.">
      {signIn.isError ? <Banner tone="error" message={apiErrorMessage(signIn.error)} /> : null}

      <FormField
        control={control}
        name="identifier"
        label="Mobile number or email"
        placeholder="98765 43210"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        keyboardType="email-address"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <FormField
        ref={passwordRef}
        control={control}
        name="password"
        label="Password"
        secureToggle
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Button label="Sign in" onPress={submit} loading={signIn.isPending} testID="signin-submit" />

      <Rule style={styles.rule} />

      <View style={styles.alt}>
        <Text tone="secondary">Joining your team?</Text>
        <Button kind="ghost" label="Enter company code" onPress={() => navigation.navigate("Join")} />
      </View>
      <View style={styles.alt}>
        <Text tone="secondary">Setting up for your company?</Text>
        <Button kind="ghost" label="Create a company account" onPress={() => navigation.navigate("SignUp")} />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  rule: { marginVertical: space.sm },
  alt: { gap: space.sm },
});

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { apiErrorMessage } from "@api/apiClient";
import { space } from "@shared/designSystem";
import { Banner, Button, Card, Text, TextField } from "@shared/ui";
import { useDeleteAccount } from "@modules/auth/hooks/useAuth";
import { deleteAccountSchema } from "@modules/auth/auth.validation";

/**
 * Deleting your own account. The owner can't (the company needs someone to
 * run it), so this isn't shown to them. Asks for the password, not a second
 * tap, because an unlocked phone in someone else's hand shouldn't be enough.
 */
export function DeleteAccount() {
  const del = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const v = deleteAccountSchema.safeParse({ password });
    if (!v.success) return setError(v.error.issues[0]?.message ?? "Enter your password");
    setError(null);
    del.mutate(v.data.password);
  };

  if (!open) {
    return (
      <View style={styles.wrap}>
        <Button kind="ghost" label="Delete account" onPress={() => setOpen(true)} testID="delete-account" />
      </View>
    );
  }

  return (
    <Card style={styles.card}>
      <Text variant="heading">Delete your account?</Text>
      <Text tone="secondary">
        You’ll be signed out everywhere and can’t sign in again. Calls you made stay with your company — they’re its
        records. To join again later, use the company code.
      </Text>
      {del.isError ? <Banner tone="error" message={apiErrorMessage(del.error)} /> : null}
      <TextField
        label="Your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        error={error ?? undefined}
      />
      <View style={styles.row}>
        <Button kind="ghost" label="Keep my account" onPress={() => setOpen(false)} />
        <Button kind="danger" label="Delete for good" loading={del.isPending} onPress={submit} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.sm },
  card: { marginTop: space.xl, gap: space.md },
  row: { flexDirection: "row", gap: space.sm, justifyContent: "flex-end", flexWrap: "wrap" },
});

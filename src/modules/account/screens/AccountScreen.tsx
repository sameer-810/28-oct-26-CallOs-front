import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { apiErrorMessage } from "@api/apiClient";
import { useAuthStore } from "@shared/store/useAuthStore";
import { formatPhone, spacedCode } from "@shared/format";
import { FORM_MAX, space } from "@shared/designSystem";
import { Banner, Button, Card, ConfirmDialog, Rule, Screen, Tag, Text, TextField } from "@shared/ui";
import { INDUSTRY_LABEL, ROLE_LABEL, type AuthUser } from "@modules/auth/types";
import { useRotateCode } from "@modules/company/hooks/useCompany";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { AppTabParamList } from "@navigation/types";
import { useUpdateMe } from "@modules/team/hooks/useTeam";
import { useChangePassword } from "@modules/auth/hooks/useAuth";
import { changePasswordSchema, type ChangePasswordForm } from "@modules/auth/auth.validation";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="eyebrow" tone="tertiary">
        {title}
      </Text>
      <Card style={styles.card}>{children}</Card>
    </View>
  );
}

function ReadOnly({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.ro}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <Text variant={mono ? "mono" : "body"}>{value}</Text>
    </View>
  );
}

/** Keyed on the saved values by its parent, so a save elsewhere resets the draft. */
function ProfileForm({ user }: { user: AuthUser }) {
  const updateMe = useUpdateMe();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? "");
  const dirty = name.trim() !== user.name || (email.trim() || null) !== (user.email ?? null);

  return (
    <Section title="You">
      {updateMe.isError ? <Banner tone="error" message={apiErrorMessage(updateMe.error)} /> : null}
      <TextField label="Name" value={name} onChangeText={setName} autoComplete="name" />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <ReadOnly label="Mobile number" value={formatPhone(user.phone)} mono />
      <View style={styles.inline}>
        <Text variant="label" tone="secondary">
          Role
        </Text>
        <Tag label={ROLE_LABEL[user.role]} tone={user.role === "rep" ? "neutral" : "ink"} />
      </View>
      <Button
        label="Save changes"
        disabled={!dirty || name.trim().length < 2}
        loading={updateMe.isPending}
        onPress={() => updateMe.mutate({ name: name.trim(), email: email.trim() || null })}
      />
    </Section>
  );
}

const BLANK: ChangePasswordForm = { currentPassword: "", newPassword: "", confirm: "" };

/** Other devices are signed out by the server; this one carries on with fresh tokens. */
function PasswordForm() {
  const change = useChangePassword();
  const [f, setF] = useState(BLANK);
  const [errors, setErrors] = useState<Partial<Record<keyof ChangePasswordForm, string>>>({});
  const set = (k: keyof ChangePasswordForm) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  function submit() {
    const parsed = changePasswordSchema.safeParse(f);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const i of parsed.error.issues) next[i.path[0] as keyof ChangePasswordForm] ??= i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    change.mutate(
      { currentPassword: f.currentPassword, newPassword: f.newPassword },
      { onSuccess: () => setF(BLANK) },
    );
  }

  return (
    <Section title="Change password">
      {change.isError ? <Banner tone="error" message={apiErrorMessage(change.error)} /> : null}
      {change.isSuccess ? <Banner tone="success" message="Password changed. Your other devices have been signed out." /> : null}
      <TextField label="Current password" value={f.currentPassword} onChangeText={set("currentPassword")} secureTextEntry secureToggle autoComplete="current-password" error={errors.currentPassword} />
      <TextField label="New password" value={f.newPassword} onChangeText={set("newPassword")} secureTextEntry secureToggle autoComplete="new-password" hint="At least 8 characters. A short sentence is easier to remember than P@ssw0rd." error={errors.newPassword} />
      <TextField label="Confirm new password" value={f.confirm} onChangeText={set("confirm")} secureTextEntry secureToggle autoComplete="new-password" error={errors.confirm} />
      <Button label="Change password" loading={change.isPending} disabled={!f.currentPassword || !f.newPassword || !f.confirm} onPress={submit} />
    </Section>
  );
}

export default function AccountScreen({ navigation }: BottomTabScreenProps<AppTabParamList, "Account">) {
  const user = useAuthStore((s) => s.user);
  const company = useAuthStore((s) => s.company);
  const logout = useAuthStore((s) => s.logout);
  const rotate = useRotateCode();
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  if (!user || !company) return null;
  const isOwner = user.role === "owner";

  return (
    <Screen maxWidth={FORM_MAX + 160}>
      <Text variant="display">Account</Text>

      <ProfileForm key={`${user.name}|${user.email}`} user={user} />

      <PasswordForm />

      <Section title="Company">
        <ReadOnly label="Company" value={company.name} />
        <ReadOnly label="Industry" value={INDUSTRY_LABEL[company.industry]} />
        {isOwner ? <Button kind="ghost" label="Company settings" onPress={() => navigation.navigate("Settings")} /> : null}

        {company.code ? (
          <>
            <Rule />
            <ReadOnly label="Join code" value={spacedCode(company.code)} mono />
            {isOwner ? (
              <>
                <Text variant="caption" tone="secondary">
                  Shared it too widely? Issue a new one. The old code stops working; nobody already in the team is
                  affected.
                </Text>
                {rotate.isError ? <Banner tone="error" message={apiErrorMessage(rotate.error)} /> : null}
                <Button kind="ghost" label="Issue a new code" onPress={() => setConfirmRotate(true)} />
              </>
            ) : null}
          </>
        ) : null}
      </Section>

      <View style={styles.section}>
        <Button kind="ghost" label="Sign out" onPress={() => setConfirmOut(true)} />
      </View>

      <ConfirmDialog
        visible={confirmRotate}
        title="Issue a new code?"
        message={`${spacedCode(company.code ?? "")} will stop working straight away. Share the new code with anyone who still needs to join.`}
        confirmLabel="Issue new code"
        loading={rotate.isPending}
        onConfirm={() => rotate.mutate(undefined, { onSettled: () => setConfirmRotate(false) })}
        onCancel={() => setConfirmRotate(false)}
      />
      <ConfirmDialog
        visible={confirmOut}
        title="Sign out?"
        message="You’ll need your mobile number and password to sign back in."
        confirmLabel="Sign out"
        onConfirm={() => {
          setConfirmOut(false);
          void logout();
        }}
        onCancel={() => setConfirmOut(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl, gap: space.sm },
  card: { gap: space.lg },
  ro: { gap: 4 },
  inline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});

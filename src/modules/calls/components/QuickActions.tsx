import { useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { CallTracker } from "@/modules/call-tracker";
import { askPermissions } from "@modules/device/permissions";
import { palette, radius, space } from "@shared/designSystem";
import { Icon, Text, type IconName } from "@shared/ui";

/** Digits for wa.me: an Indian 10-digit number gets its 91. */
export function waDigits(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
}

/**
 * Rings the number. On the Android app it calls straight out (asking for the
 * call permission once); anywhere else, or if refused, it opens the dialler.
 */
export async function callNumber(phone: string) {
  if (CallTracker && Platform.OS === "android") {
    if (!CallTracker.getPermissions().callPhone) await askPermissions(["callPhone"]);
    CallTracker.placeCall(phone, null);
    return;
  }
  await Linking.openURL(`tel:${phone}`);
}

export const smsNumber = (phone: string) => Linking.openURL(`sms:${phone}`);
export const whatsappNumber = (phone: string) => Linking.openURL(`https://wa.me/${waDigits(phone)}`);

interface Action {
  icon: IconName;
  label: string;
  run: () => void;
  disabled?: boolean;
}

/**
 * The strip under a call on a phone: call back, text, WhatsApp, copy the
 * number, play the recording — what a rep does next with a call, one tap each.
 */
export function QuickActions({ phone, hasRecording, onPlay }: { phone: string; hasRecording: boolean; onPlay: () => void }) {
  const [copied, setCopied] = useState(false);
  const actions: Action[] = [
    { icon: "phone", label: "Call", run: () => void callNumber(phone) },
    { icon: "sms", label: "SMS", run: () => void smsNumber(phone) },
    { icon: "whatsapp", label: "WhatsApp", run: () => void whatsappNumber(phone) },
    {
      icon: copied ? "check" : "copy",
      label: copied ? "Copied" : "Copy number",
      run: () => {
        void Clipboard.setStringAsync(phone);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
    },
    { icon: "play", label: hasRecording ? "Play recording" : "No recording", run: onPlay, disabled: !hasRecording },
  ];
  return (
    <View style={styles.bar}>
      {actions.map((a) => (
        <Pressable
          key={a.label}
          onPress={a.run}
          disabled={a.disabled}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          hitSlop={4}
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        >
          <Icon name={a.icon} size={20} color={a.disabled ? palette.ruleStrong : a.icon === "check" ? palette.connected : palette.ink} />
        </Pressable>
      ))}
      {copied ? (
        <Text variant="caption" tone="secondary" style={styles.toast}>
          Number copied
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: palette.paper,
    borderRadius: radius.md,
    paddingVertical: 2,
  },
  btn: { padding: space.sm, borderRadius: radius.md },
  pressed: { backgroundColor: palette.paper2 },
  toast: { position: "absolute", right: space.sm, top: -18 },
});

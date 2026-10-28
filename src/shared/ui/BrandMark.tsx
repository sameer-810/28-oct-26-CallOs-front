import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { environment } from "@config/env";
import { fonts, palette } from "../designSystem";
import { Text } from "./Text";

export function BrandMark({ size = 26, inverse = false }: { size?: number; inverse?: boolean }) {
  const fg = inverse ? palette.ink : palette.paper;
  const bg = inverse ? palette.paper : palette.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no">
      <Rect width={64} height={64} rx={12} fill={bg} />
      <Path d="M22 18c-2 0-4 2-4 4 0 13 11 24 24 24 2 0 4-2 4-4v-4l-7-3-3 3c-4-2-8-6-10-10l3-3-3-7z" fill={fg} />
      <Circle cx={46} cy={18} r={5} fill={palette.missed} />
    </Svg>
  );
}

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel={environment.appName}>
      <BrandMark inverse={inverse} />
      <Text style={[styles.name, { color: inverse ? palette.paper : palette.ink }]}>{environment.appName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { fontFamily: fonts.textSemi, fontSize: 17, letterSpacing: -0.3 },
});

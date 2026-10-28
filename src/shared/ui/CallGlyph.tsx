import Svg, { Path } from "react-native-svg";
import { palette } from "../designSystem";

type Kind = "incoming" | "outgoing" | "missed" | "rejected" | "blocked";

const COLOR: Record<Kind, string> = {
  outgoing: palette.ink2,
  incoming: palette.connected,
  missed: palette.missed,
  rejected: palette.missed,
  blocked: palette.ink3,
};

/**
 * Call direction as a shape first and a colour second — an arrow out, an arrow
 * in, a broken arrow for missed, a cross for rejected, a bar for blocked.
 */
export function CallGlyph({ type, size = 16 }: { type: Kind; size?: number }) {
  const p = { stroke: COLOR[type], strokeWidth: 1.7, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" accessibilityElementsHidden importantForAccessibility="no">
      {type === "outgoing" && <Path d="M4 12 12 4M6 4h6v6" {...p} />}
      {type === "incoming" && <Path d="M12 4 4 12M10 12H4V6" {...p} />}
      {type === "missed" && <Path d="M3 5l4.5 4.5L13 4M3 5v4M3 5h4" {...p} />}
      {type === "rejected" && <Path d="M4 4l8 8M12 4l-8 8" {...p} />}
      {type === "blocked" && <Path d="M3.5 8h9M8 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9" {...p} />}
    </Svg>
  );
}

import { useMemo } from "react";
import Svg, { Path, Rect } from "react-native-svg";
import QRCode from "qrcode";
import { palette } from "../designSystem";

/**
 * A QR code drawn locally from the text — no image service, so a join link
 * never leaves the page. One path for all dark modules keeps it a single
 * node however long the link.
 */
export function QrCode({ value, size = 148, label }: { value: string; size?: number; label: string }) {
  const { path, n } = useMemo(() => {
    const m = QRCode.create(value, { errorCorrectionLevel: "M" }).modules;
    let d = "";
    for (let y = 0; y < m.size; y++) {
      for (let x = 0; x < m.size; x++) if (m.data[y * m.size + x]) d += `M${x} ${y}h1v1h-1z`;
    }
    return { path: d, n: m.size };
  }, [value]);
  // four modules of quiet zone, as scanners expect
  const q = 4;
  return (
    <Svg width={size} height={size} viewBox={`${-q} ${-q} ${n + q * 2} ${n + q * 2}`} accessibilityRole="image" accessibilityLabel={label}>
      <Rect x={-q} y={-q} width={n + q * 2} height={n + q * 2} fill={palette.white} />
      <Path d={path} fill={palette.ink} />
    </Svg>
  );
}

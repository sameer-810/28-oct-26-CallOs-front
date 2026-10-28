/**
 * Tokens. Same "call sheet" direction as the landing page — see
 * docs/DESIGN_SYSTEM.md. Colour carries call state and nothing else; the
 * marker yellow is the only decorative colour.
 */
export const palette = {
  paper: "#F3EFE6",
  paper2: "#EAE4D6",
  card: "#FBF9F4",
  ink: "#17140F",
  ink2: "#4A443A",
  ink3: "#776F61",
  rule: "#DAD2C2",
  ruleStrong: "#BFB4A0",

  marker: "#F5CF3D",
  markerSoft: "rgba(245, 207, 61, 0.35)",
  connected: "#2C6B43",
  connectedBg: "#E3EEE4",
  missed: "#B3261E",
  missedBg: "#F8E5E2",

  white: "#FFFFFF",
} as const;

export const fonts = {
  display: "Newsreader_400Regular",
  displayMedium: "Newsreader_500Medium",
  text: "Geist_400Regular",
  textMedium: "Geist_500Medium",
  textSemi: "Geist_600SemiBold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
} as const;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 10,
  xl: 14,
  pill: 999,
} as const;

/** Above this width the app is a desktop dashboard: sidebar, wider content. */
export const WIDE = 900;

/** Comfortable reading width for forms; content never stretches past it. */
export const FORM_MAX = 440;
export const PAGE_MAX = 1080;

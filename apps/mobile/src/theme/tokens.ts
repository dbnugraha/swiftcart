import { Platform, type TextStyle, type ViewStyle } from "react-native";

/**
 * Swiftcart design tokens — the single source of every visual constant.
 * No raw hex, spacing number or radius should appear anywhere else.
 *
 * The palette is deliberately close to SauceDemo's: near-white ground, deep
 * slate ink, and a single confident green for actions.
 */

export const colors = {
  background: "#F6F7F9",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF1F4",

  primary: "#0F7B6C",
  primaryDark: "#0A5C51",
  accent: "#E2703A",

  text: "#132029",
  textSecondary: "#5B6B77",
  border: "#DEE3E8",

  danger: "#C0392B",
  success: "#1E8E5A",
  star: "#E8A33D",

  overlay: "rgba(19, 32, 41, 0.55)",
  imagePlaceholder: "#E7EBEF",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  card: 14,
  pill: 999,
} as const;

export const durations = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

/** Android ignores shadow*, iOS ignores elevation — both declared per level. */
export const shadows: Record<"soft" | "card" | "floating", ViewStyle> = {
  soft: Platform.select({
    ios: {
      shadowColor: colors.text,
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    default: { elevation: 2 },
  })!,
  card: Platform.select({
    ios: {
      shadowColor: colors.text,
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
    },
    default: { elevation: 4 },
  })!,
  floating: Platform.select({
    ios: {
      shadowColor: colors.text,
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 9 },
    },
    default: { elevation: 10 },
  })!,
};

export const typography = {
  screenTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.4,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.text,
  },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  bodyMuted: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  cardTitle: { fontSize: 14, lineHeight: 19, fontWeight: "600", color: colors.text },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "600", color: colors.textSecondary },
  caption: { fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  price: { fontSize: 16, lineHeight: 21, fontWeight: "700", color: colors.text },
  button: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
} satisfies Record<string, TextStyle>;

export const TAB_BAR_HEIGHT = 60;

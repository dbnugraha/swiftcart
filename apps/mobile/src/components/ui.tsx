import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Edge, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radii, spacing, TAB_BAR_HEIGHT, typography } from "@/theme";

/** The small shared pieces every screen reaches for. */

/**
 * Breathing room under the status bar. The safe-area inset only guarantees
 * content is not *behind* the notch — sitting flush against it still reads as
 * cramped, so every header adds this on top. One constant, so no screen ends up
 * looking tighter than its neighbours.
 */
const HEADER_TOP = spacing.lg;

export function Screen({
  children,
  style,
  edges = ["top", "left", "right"],
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: readonly Edge[];
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <View style={[styles.fill, style]}>{children}</View>
    </SafeAreaView>
  );
}

/** Bottom padding that clears the floating tab bar. */
export function useTabBarInset() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + insets.bottom + spacing.lg;
}

export function Header({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTitles}>
        <Text style={typography.screenTitle} numberOfLines={1}>
          {title}
        </Text>
        {/* Always rendered, so header height is identical on every screen. */}
        <Text style={[typography.caption, styles.headerSubtitle]} numberOfLines={1}>
          {subtitle ?? " "}
        </Text>
      </View>
      {right}
    </View>
  );
}

/**
 * The header for any screen you can go back from — the stack counterpart to
 * `Header`. Owning the back affordance here is what keeps its spacing, size and
 * fallback identical everywhere, and stops each screen inventing its own.
 */
export function BackHeader({
  title,
  subtitle,
  right,
  onBack,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  /** Overrides going back — for a screen with its own steps to unwind. */
  onBack?: () => void;
}) {
  const goBack = () => {
    if (onBack) return onBack();
    // Deep links and replaced routes can leave nothing to return to, and a
    // dead back button is worse than one that goes somewhere sensible.
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <View style={styles.backHeader}>
      <Pressable
        onPress={goBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>

      <View style={styles.backHeaderTitles}>
        {title && (
          <Text style={typography.sectionTitle} numberOfLines={1}>
            {title}
          </Text>
        )}
        {subtitle && (
          <Text style={typography.caption} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {right}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
  icon,
  trailingIcon,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  busy?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  /** Sits after the label — for a button that both names a thing and moves. */
  trailingIcon?: React.ComponentProps<typeof Ionicons>["name"];
  /** For when the label alone is too terse to announce, e.g. a bare count. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || busy;
  const tint =
    variant === "primary" ? colors.surface : variant === "danger" ? colors.danger : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy }}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={tint} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={tint} />}
          {/* One line always: a button sharing a row with another is narrow
              enough that a long label would otherwise wrap and break its
              fixed height. */}
          <Text style={[typography.button, { color: tint }]} numberOfLines={1}>
            {label}
          </Text>
          {trailingIcon && <Ionicons name={trailingIcon} size={18} color={tint} />}
        </>
      )}
    </Pressable>
  );
}

/**
 * Every empty, error and loading dead-end in the app. Having one component
 * means none of them can quietly ship without an explanation or a way out.
 */
export function StateView({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <Ionicons name={icon} size={28} color={colors.textSecondary} />
      </View>
      <Text style={typography.sectionTitle}>{title}</Text>
      {body && <Text style={[typography.bodyMuted, styles.stateBody]}>{body}</Text>}
      {action && <View style={styles.stateAction}>{action}</View>}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.state}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label && <Text style={[typography.bodyMuted, styles.stateBody]}>{label}</Text>}
    </View>
  );
}

export function Badge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <View style={styles.stars} accessibilityLabel={`Rated ${rating.toFixed(1)} of 5`}>
      <Ionicons name="star" size={13} color={colors.star} />
      <Text style={typography.caption}>{rating.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: HEADER_TOP,
    paddingBottom: spacing.md,
  },
  headerTitles: { flex: 1 },
  headerSubtitle: { marginTop: 2 },
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: HEADER_TOP,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backHeaderTitles: { flex: 1 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 50,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDanger: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  stateIcon: {
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  stateBody: { textAlign: "center" },
  stateAction: { marginTop: spacing.sm },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.surface,
  },
  stars: { flexDirection: "row", alignItems: "center", gap: 3 },
});

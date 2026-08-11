import Ionicons from "@expo/vector-icons/Ionicons";
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

export function Button({
  label,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  busy?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
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
          <Text style={[typography.button, { color: tint }]}>{label}</Text>
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitles: { flex: 1 },
  headerSubtitle: { marginTop: 2 },
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

import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import type { OrderStatus } from "@swiftcart/shared";

import { colors, radii, spacing, typography } from "@/theme";

/**
 * One definition of what each order status looks like and means, shared by the
 * orders list and the order detail screen. Keyed by `OrderStatus` rather than
 * `string`, so adding a status to the shared type breaks the build here instead
 * of quietly falling through to a default.
 */

/** Every order walks this sequence, in this order. */
export const ORDER_STATUS_STEPS: readonly OrderStatus[] = [
  "PLACED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
];

const LABELS: Record<OrderStatus, string> = {
  PLACED: "Placed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
};

const BLURBS: Record<OrderStatus, string> = {
  PLACED: "We've got your order and it's being prepared.",
  PACKED: "Everything is boxed up and waiting for collection.",
  SHIPPED: "On its way to your address.",
  DELIVERED: "Delivered. Thanks for shopping with us.",
};

const TONES: Record<OrderStatus, { bg: string; fg: string }> = {
  PLACED: { bg: `${colors.primary}18`, fg: colors.primary },
  PACKED: { bg: `${colors.accent}18`, fg: colors.accent },
  SHIPPED: { bg: `${colors.star}22`, fg: "#A8721F" },
  DELIVERED: { bg: `${colors.success}18`, fg: colors.success },
};

export const orderStatusLabel = (status: OrderStatus) => LABELS[status];
export const orderStatusBlurb = (status: OrderStatus) => BLURBS[status];

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const tone = TONES[status];

  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.pillText, { color: tone.fg }]}>{LABELS[status]}</Text>
    </View>
  );
}

/**
 * Progress through the four statuses.
 *
 * Each step owns an equal share of the width and centres its own dot, and the
 * connecting rails are absolutely positioned halves that meet under the dots.
 * The previous version gave every step a fixed-width rail sitting *beside* its
 * dot, so nothing lined up once the labels were different lengths.
 */
export function OrderTimeline({ status }: { status: OrderStatus }) {
  const current = ORDER_STATUS_STEPS.indexOf(status);
  const last = ORDER_STATUS_STEPS.length - 1;

  return (
    <View
      style={styles.timeline}
      accessibilityRole="progressbar"
      accessibilityLabel={`Order status: ${LABELS[status]}, step ${current + 1} of ${last + 1}`}
    >
      {ORDER_STATUS_STEPS.map((step, index) => {
        const reached = index <= current;
        const isCurrent = index === current;

        return (
          <View key={step} style={styles.step}>
            {/* Rails first so the dot paints over where they meet. */}
            {index > 0 && (
              <View style={[styles.rail, styles.railLeft, reached && styles.railOn]} />
            )}
            {index < last && (
              <View
                style={[styles.rail, styles.railRight, index < current && styles.railOn]}
              />
            )}

            {isCurrent && <View style={styles.halo} />}

            <View style={[styles.dot, reached && styles.dotOn]}>
              {reached && <Ionicons name="checkmark" size={13} color={colors.surface} />}
            </View>

            <Text
              style={[typography.caption, reached && styles.stepLabelOn]}
              numberOfLines={1}
            >
              {LABELS[step]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const DOT = 24;

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  pillText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timeline: { flexDirection: "row", marginTop: spacing.md },
  step: { flex: 1, alignItems: "center", gap: spacing.xs },
  rail: {
    position: "absolute",
    top: DOT / 2 - 1,
    height: 2,
    backgroundColor: colors.border,
  },
  // Halves rather than one full-width rail: a step at either end has only the
  // inner half, so the track starts and stops under the first and last dots.
  railLeft: { left: 0, right: "50%" },
  railRight: { left: "50%", right: 0 },
  railOn: { backgroundColor: colors.primary },
  halo: {
    position: "absolute",
    top: -4,
    width: DOT + 8,
    height: DOT + 8,
    borderRadius: radii.pill,
    backgroundColor: `${colors.primary}1F`,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.border,
  },
  dotOn: { backgroundColor: colors.primary },
  stepLabelOn: { color: colors.primary, fontWeight: "700" },
});

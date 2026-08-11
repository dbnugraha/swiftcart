import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatCents, type Order, type OrderStatus } from "@swiftcart/shared";

import { Button, Loading, Screen, StateView } from "@/components/ui";
import { useResource } from "@/hooks/use-resource";
import { colors, radii, shadows, spacing, typography } from "@/theme";

const STATUS_STEPS: OrderStatus[] = ["PLACED", "PACKED", "SHIPPED", "DELIVERED"];
const STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: "Placed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
};

export default function OrderDetailScreen() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const insets = useSafeAreaInsets();
  const justPlaced = placed === "1";

  const { data: order, isLoading, error, retry } = useResource<Order>(
    id ? `/orders/${id}` : null,
  );

  if (isLoading) {
    return (
      <Screen>
        <Loading label="Loading order details" />
      </Screen>
    );
  }

  if (error || !order) {
    return (
      <Screen>
        <BackBar />
        <StateView
          icon="alert-circle-outline"
          title="Couldn't load this order"
          body={error ?? "It may no longer exist."}
          action={<Button label="Try again" icon="refresh" onPress={retry} />}
        />
      </Screen>
    );
  }

  const dateStr = new Date(order.createdAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Screen edges={["top", "left", "right"]}>
      <BackBar />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Banner */}
        {justPlaced && (
          <View style={styles.successBanner}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={36} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Order Placed!</Text>
            <Text style={[typography.bodyMuted, styles.successBody]}>
              Thank you for your order. This is a demo — no payment was collected.
            </Text>
          </View>
        )}

        {/* Reference & Date */}
        <View style={[styles.card, shadows.soft]}>
          <Text style={typography.label}>Order Reference</Text>
          <Text style={styles.reference}>{order.reference}</Text>
          <Text style={typography.caption}>{dateStr}</Text>
        </View>

        {/* Status Timeline */}
        <View style={[styles.card, shadows.soft]}>
          <Text style={typography.label}>Status</Text>
          <View style={styles.timeline}>
            {STATUS_STEPS.map((step, i) => {
              const currentIdx = STATUS_STEPS.indexOf(order.status);
              const reached = i <= currentIdx;
              const isActive = i === currentIdx;

              return (
                <View key={step} style={styles.timelineStep}>
                  <View style={styles.timelineTrack}>
                    <View
                      style={[
                        styles.timelineDot,
                        reached && styles.timelineDotActive,
                        isActive && styles.timelineDotCurrent,
                      ]}
                    >
                      {reached && (
                        <Ionicons name="checkmark" size={10} color={colors.surface} />
                      )}
                    </View>
                    {i < STATUS_STEPS.length - 1 && (
                      <View
                        style={[
                          styles.timelineLine,
                          reached && i < currentIdx && styles.timelineLineActive,
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      typography.caption,
                      reached && { color: colors.primary, fontWeight: "700" },
                    ]}
                  >
                    {STATUS_LABELS[step]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Items */}
        <View style={[styles.card, shadows.soft]}>
          <Text style={typography.label}>
            {order.lines.length} {order.lines.length === 1 ? "item" : "items"}
          </Text>
          {order.lines.map((line, i) => (
            <View key={i}>
              {i > 0 && <View style={styles.separator} />}
              <View style={styles.lineItem}>
                <Image
                  source={{ uri: line.thumbnail }}
                  style={styles.lineThumb}
                  contentFit="contain"
                  transition={120}
                />
                <View style={styles.lineBody}>
                  <Text style={typography.cardTitle} numberOfLines={2}>
                    {line.title}
                  </Text>
                  <View style={styles.lineDetail}>
                    <Text style={typography.caption}>
                      {line.quantity} × {formatCents(line.unitPrice)}
                    </Text>
                    <Text style={typography.price}>{formatCents(line.lineTotal)}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Shipping Address */}
        <View style={[styles.card, shadows.soft]}>
          <Text style={typography.label}>Shipping Address</Text>
          <Text style={typography.body}>{order.shippingAddress.fullName}</Text>
          <Text style={typography.bodyMuted}>{order.shippingAddress.addressLine}</Text>
          <Text style={typography.bodyMuted}>
            {order.shippingAddress.city} {order.shippingAddress.postalCode}
          </Text>
          <Text style={typography.bodyMuted}>{order.shippingAddress.country}</Text>
        </View>

        {/* Totals */}
        <View style={[styles.card, shadows.soft]}>
          <Text style={typography.label}>Payment Summary</Text>
          <Row label="Subtotal" value={formatCents(order.subtotal)} />
          <Row label="Tax (8%)" value={formatCents(order.tax)} />
          <Row
            label="Shipping"
            value={order.shipping === 0 ? "Free" : formatCents(order.shipping)}
          />
          <View style={styles.separator} />
          <Row label="Total" value={formatCents(order.total)} strong />
        </View>

        {/* Actions */}
        <Button
          label="Back to shop"
          icon="storefront-outline"
          onPress={() => router.replace("/")}
        />
      </ScrollView>
    </Screen>
  );
}

function BackBar() {
  return (
    <View style={styles.backBar}>
      <Button
        label="Back"
        icon="chevron-back"
        variant="secondary"
        onPress={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
        style={styles.backButton}
      />
    </View>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={strong ? typography.sectionTitle : typography.bodyMuted}>
        {label}
      </Text>
      <Text style={strong ? typography.sectionTitle : typography.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backBar: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backButton: {
    alignSelf: "flex-start",
    height: 40,
    paddingHorizontal: spacing.md,
  },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },

  /* Success Banner */
  successBanner: {
    alignItems: "center",
    padding: spacing.xl,
    borderRadius: radii.card,
    backgroundColor: `${colors.success}0C`,
    gap: spacing.xs,
  },
  successIcon: { marginBottom: spacing.xs },
  successTitle: {
    ...typography.sectionTitle,
    color: colors.success,
    fontSize: 22,
  },
  successBody: { textAlign: "center" },

  /* Cards */
  card: {
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  reference: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 1.5,
  },

  /* Timeline */
  timeline: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  timelineStep: { alignItems: "center", gap: spacing.xs },
  timelineTrack: {
    flexDirection: "row",
    alignItems: "center",
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotActive: { backgroundColor: colors.primary },
  timelineDotCurrent: {
    width: 26,
    height: 26,
    borderWidth: 3,
    borderColor: `${colors.primary}40`,
  },
  timelineLine: {
    width: 30,
    height: 3,
    backgroundColor: colors.border,
    marginHorizontal: 2,
  },
  timelineLineActive: { backgroundColor: colors.primary },

  /* Line Items */
  lineItem: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  lineThumb: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  lineBody: { flex: 1, gap: 2 },
  lineDetail: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  /* Totals */
  row: { flexDirection: "row", justifyContent: "space-between" },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
});

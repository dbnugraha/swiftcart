import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatCents, type Order } from "@swiftcart/shared";

import { Button, Loading, Screen, StateView } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { colors, radii, shadows, spacing, typography } from "@/theme";

const DEFAULT_STATUS_COLOR = { bg: `${colors.primary}18`, fg: colors.primary };

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PLACED: DEFAULT_STATUS_COLOR,
  PACKED: { bg: `${colors.accent}18`, fg: colors.accent },
  SHIPPED: { bg: "#3498db22", fg: "#2980b9" },
  DELIVERED: { bg: `${colors.success}18`, fg: colors.success },
};

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    api
      .get<{ items: Order[] }>("/orders", { signal })
      .then((payload) => {
        if (!signal.aborted) setOrders(payload.items);
      })
      .catch((cause) => {
        if (!signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  return (
    <Screen edges={["top", "left", "right"]}>
      <View style={styles.head}>
        <Button
          label="Back"
          icon="chevron-back"
          variant="secondary"
          style={styles.backButton}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        />
        <Text style={typography.screenTitle}>My Orders</Text>
      </View>

      {isLoading ? (
        <Loading label="Loading your orders" />
      ) : error ? (
        <StateView
          icon="cloud-offline-outline"
          title="Couldn't load orders"
          body={error}
          action={
            <Button
              label="Try again"
              icon="refresh"
              onPress={() => {
                setError(null);
                setIsLoading(true);
                api
                  .get<{ items: Order[] }>("/orders")
                  .then((payload) => setOrders(payload.items))
                  .catch((cause) => setError(errorMessage(cause)))
                  .finally(() => setIsLoading(false));
              }}
            />
          }
        />
      ) : orders.length === 0 ? (
        <StateView
          icon="receipt-outline"
          title="No orders yet"
          body="Once you place an order, it will appear here."
          action={
            <Button
              label="Start shopping"
              icon="storefront-outline"
              onPress={() => router.replace("/")}
            />
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

function OrderCard({ order }: { order: Order }) {
  const statusColor = STATUS_COLORS[order.status] ?? STATUS_COLORS.PLACED;
  const itemCount = order.lines.reduce((sum, l) => sum + l.quantity, 0);
  const dateStr = new Date(order.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        shadows.soft,
        pressed && styles.pressed,
      ]}
      onPress={() => router.push(`/order/${order.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.reference}`}
    >
      <View style={styles.cardTop}>
        <View>
          <Text style={typography.cardTitle}>{order.reference}</Text>
          <Text style={typography.caption}>{dateStr}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: (statusColor ?? DEFAULT_STATUS_COLOR).bg }]}>
          <Text style={[styles.statusText, { color: (statusColor ?? DEFAULT_STATUS_COLOR).fg }]}>
            {order.status}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardBottom}>
        <Text style={typography.bodyMuted}>
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </Text>
        <Text style={typography.price}>{formatCents(order.total)}</Text>
      </View>

      <View style={styles.cardArrow}>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  backButton: {
    alignSelf: "flex-start",
    height: 38,
    paddingHorizontal: spacing.md,
  },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardArrow: {
    position: "absolute",
    right: spacing.lg,
    top: "50%",
    marginTop: -9,
    opacity: 0.5,
  },
  pressed: { opacity: 0.85 },
});

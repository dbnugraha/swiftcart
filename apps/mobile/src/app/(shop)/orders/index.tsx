import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatCents, type Order } from "@swiftcart/shared";

import { OrderStatusPill } from "@/components/OrderStatus";
import { BackHeader, Button, Loading, Screen, StateView } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { colors, radii, shadows, spacing, typography } from "@/theme";

/** Thumbnails shown on a card before it collapses the rest into "+N". */
const THUMBS_SHOWN = 3;

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
      <BackHeader
        title="My orders"
        subtitle={
          isLoading || error
            ? undefined
            : `${orders.length} ${orders.length === 1 ? "order" : "orders"}`
        }
      />

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
  const itemCount = order.lines.reduce((sum, l) => sum + l.quantity, 0);
  const dateStr = new Date(order.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const thumbs = order.lines.slice(0, THUMBS_SHOWN);
  const hidden = order.lines.length - thumbs.length;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        shadows.soft,
        pressed && styles.pressed,
      ]}
      onPress={() =>
        router.push({ pathname: "/order/[id]", params: { id: order.id } })
      }
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.reference}, ${itemCount} items, ${formatCents(order.total)}`}
    >
      <View style={styles.cardTop}>
        {/* flex so a long reference wraps instead of running under the pill. */}
        <View style={styles.cardHeading}>
          <Text style={typography.cardTitle} numberOfLines={1}>
            {order.reference}
          </Text>
          <Text style={typography.caption}>{dateStr}</Text>
        </View>
        <OrderStatusPill status={order.status} />
      </View>

      <View style={styles.thumbs}>
        {thumbs.map((line, i) => (
          <Image
            key={i}
            source={{ uri: line.thumbnail }}
            style={styles.thumb}
            contentFit="contain"
            transition={120}
          />
        ))}
        {hidden > 0 && (
          <View style={[styles.thumb, styles.thumbMore]}>
            <Text style={typography.caption}>+{hidden}</Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      {/* Everything in flow — the chevron used to be absolutely positioned at
          the card's midpoint, which put it straight on top of the total. */}
      <View style={styles.cardBottom}>
        <Text style={typography.bodyMuted}>
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </Text>
        <View style={styles.cardTotal}>
          <Text style={typography.price}>{formatCents(order.total)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  cardHeading: { flex: 1, gap: 2 },
  thumbs: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  thumbMore: { alignItems: "center", justifyContent: "center" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  cardTotal: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  pressed: { opacity: 0.85 },
});

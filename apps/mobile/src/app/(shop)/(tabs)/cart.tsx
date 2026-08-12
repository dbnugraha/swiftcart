import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { formatCents, type CartLine } from "@swiftcart/shared";

import { Button, Header, Loading, Screen, StateView, useTabBarInset } from "@/components/ui";
import { useCart } from "@/context/cart";
import { useConfirm } from "@/context/confirm";
import { useToast } from "@/context/toast";
import { colors, radii, shadows, spacing, typography } from "@/theme";

export default function CartScreen() {
  const { cart, isLoading, changeQuantity, remove, clear } = useCart();
  const bottomInset = useTabBarInset();
  const toast = useToast();
  const confirm = useConfirm();

  if (isLoading) return <Screen><Loading label="Loading your cart" /></Screen>;

  if (cart.lines.length === 0) {
    return (
      <Screen>
        <Header title="Cart" subtitle="Nothing in it yet" />
        <StateView
          icon="cart-outline"
          title="Your cart is empty"
          body="Browse the shop and add something you like."
          action={<Button label="Start shopping" onPress={() => router.push("/")} />}
        />
      </Screen>
    );
  }

  const onClear = async () => {
    const confirmed = await confirm({
      title: "Empty your cart?",
      body: `This removes all ${cart.itemCount} ${cart.itemCount === 1 ? "item" : "items"}.`,
      confirmLabel: "Empty cart",
      tone: "danger",
      icon: "trash-outline",
    });

    if (confirmed) await clear();
  };

  return (
    <Screen>
      <Header
        title="Cart"
        subtitle={`${cart.itemCount} ${cart.itemCount === 1 ? "item" : "items"}`}
        right={
          <Pressable onPress={() => void onClear()} hitSlop={8} accessibilityRole="button">
            <Text style={styles.clear}>Empty</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {cart.lines.map((line) => (
          <Line
            key={line.productId}
            line={line}
            // Deltas, not absolutes: the context resolves the target when it
            // actually sends, so fast taps can't send a stale base.
            onDecrease={() => changeQuantity(line.productId, -1)}
            onIncrease={() => changeQuantity(line.productId, 1)}
            onRemove={() => {
              remove(line.productId);
              // The line vanishes instantly, so say what went — otherwise a
              // mis-tap looks like the cart lost something on its own.
              toast.show(`${line.product.title} removed`, "info");
            }}
            onPress={() => router.push(`/product/${line.productId}`)}
          />
        ))}

        <View style={[styles.summary, shadows.soft]}>
          <Row label="Subtotal" value={formatCents(cart.subtotal)} />
          <Row label="Tax (8%)" value={formatCents(cart.tax)} />
          <Row
            label="Shipping"
            value={cart.shipping === 0 ? "Free" : formatCents(cart.shipping)}
          />
          <View style={styles.divider} />
          <Row label="Total" value={formatCents(cart.total)} strong />
        </View>
      </ScrollView>

      {/* Sticky, so the total and the way forward are always visible. */}
      <View style={[styles.bar, shadows.floating, { paddingBottom: bottomInset }]}>
        <View>
          <Text style={typography.caption}>Total</Text>
          <Text style={typography.screenTitle}>{formatCents(cart.total)}</Text>
        </View>
        <Button
          label="Checkout"
          icon="arrow-forward"
          onPress={() => router.push("/checkout")}
          style={styles.checkoutButton}
        />
      </View>
    </Screen>
  );
}

function Line({
  line,
  onDecrease,
  onIncrease,
  onRemove,
  onPress,
}: {
  line: CartLine;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
  onPress: () => void;
}) {
  // Stock is the limit that means something; 99 is only a sanity bound and
  // mirrors MAX_QUANTITY_PER_LINE on the server.
  const atStockLimit = line.quantity >= Math.min(line.product.stock, 99);

  return (
    <View style={[styles.line, shadows.soft]}>
      <Pressable onPress={onPress} accessibilityRole="button">
        <Image
          style={styles.thumb}
          source={{ uri: line.product.thumbnail }}
          contentFit="contain"
          transition={140}
        />
      </Pressable>

      <View style={styles.lineBody}>
        <View style={styles.lineHead}>
          <Text style={[typography.cardTitle, styles.lineTitle]} numberOfLines={2}>
            {line.product.title}
          </Text>

          {/* Removing has its own control rather than hiding behind "minus at
              quantity 1" — that was only discoverable by trying it. */}
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${line.product.title} from cart`}
            style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </Pressable>
        </View>

        <Text style={typography.caption}>
          {formatCents(line.product.salePrice)} each
        </Text>

        <View style={styles.lineFooter}>
          <View style={styles.stepper}>
            <Stepper
              icon="remove"
              label="Decrease quantity"
              onPress={onDecrease}
              disabled={line.quantity <= 1}
            />
            <Text style={styles.quantity}>{line.quantity}</Text>
            <Stepper
              icon="add"
              label="Increase quantity"
              onPress={onIncrease}
              disabled={atStockLimit}
            />
          </View>

          <Text style={typography.price}>{formatCents(line.lineTotal)}</Text>
        </View>

        {atStockLimit && (
          <Text style={styles.stockNote}>Only {line.product.stock} in stock</Text>
        )}
      </View>
    </View>
  );
}

function Stepper({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.stepperButton,
        disabled && styles.stepperDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={disabled ? colors.textSecondary : colors.text}
      />
    </Pressable>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={strong ? typography.sectionTitle : typography.bodyMuted}>{label}</Text>
      <Text style={strong ? typography.sectionTitle : typography.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  clear: { ...typography.body, fontWeight: "700", color: colors.danger },
  line: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  lineBody: { flex: 1, gap: spacing.xs },
  lineHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  lineTitle: { flex: 1 },
  remove: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  lineFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stepperDisabled: { opacity: 0.4 },
  quantity: { ...typography.body, fontWeight: "700", minWidth: 16, textAlign: "center" },
  stockNote: { ...typography.caption, color: colors.accent },
  summary: {
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkoutButton: { flex: 1 },
  pressed: { opacity: 0.7 },
});

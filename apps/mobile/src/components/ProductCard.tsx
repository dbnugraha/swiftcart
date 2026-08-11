import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatCents, type Product } from "@swiftcart/shared";

import { Stars } from "@/components/ui";
import { colors, radii, shadows, spacing, typography } from "@/theme";

export default function ProductCard({
  product,
  width,
  inCart,
  onPress,
  onAdd,
}: {
  product: Product;
  width: number;
  inCart: number;
  onPress: () => void;
  onAdd: () => void;
}) {
  const isDiscounted = product.discountPercentage >= 1;
  const soldOut = product.stock <= 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.title}, ${formatCents(product.salePrice)}`}
      style={({ pressed }) => [
        styles.card,
        shadows.soft,
        { width },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.imageWrap}>
        <Image
          style={styles.image}
          source={{ uri: product.thumbnail }}
          recyclingKey={product.id}
          contentFit="contain"
          transition={160}
        />

        {isDiscounted && (
          <View style={styles.discount}>
            <Text style={styles.discountText}>
              -{Math.round(product.discountPercentage)}%
            </Text>
          </View>
        )}

        {soldOut && (
          <View style={styles.soldOut}>
            <Text style={styles.soldOutText}>Sold out</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={typography.cardTitle} numberOfLines={2}>
          {product.title}
        </Text>

        <Stars rating={product.rating} />

        <View style={styles.priceRow}>
          <View style={styles.prices}>
            <Text style={typography.price}>{formatCents(product.salePrice)}</Text>
            {isDiscounted && (
              <Text style={styles.wasPrice}>{formatCents(product.price)}</Text>
            )}
          </View>

          <Pressable
            onPress={onAdd}
            disabled={soldOut}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={
              soldOut ? `${product.title} is sold out` : `Add ${product.title} to cart`
            }
            style={({ pressed }) => [
              styles.add,
              inCart > 0 && styles.addActive,
              soldOut && styles.addDisabled,
              pressed && !soldOut && styles.pressed,
            ]}
          >
            {inCart > 0 ? (
              <Text style={styles.addCount}>{inCart}</Text>
            ) : (
              <Ionicons name="add" size={18} color={colors.surface} />
            )}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  pressed: { opacity: 0.9 },
  imageWrap: {
    aspectRatio: 1,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  image: { flex: 1 },
  discount: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
  },
  discountText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.surface,
  },
  soldOut: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  soldOutText: {
    ...typography.label,
    color: colors.danger,
    textTransform: "uppercase",
  },
  body: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  prices: { flex: 1 },
  wasPrice: {
    ...typography.caption,
    textDecorationLine: "line-through",
  },
  add: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  addActive: { backgroundColor: colors.primaryDark },
  addDisabled: { backgroundColor: colors.border },
  addCount: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.surface,
  },
});

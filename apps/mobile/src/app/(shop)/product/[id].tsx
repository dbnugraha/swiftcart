import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatCents, type ProductDetail } from "@swiftcart/shared";

import { BackHeader, Button, Loading, Screen, StateView, Stars } from "@/components/ui";
import { useCart } from "@/context/cart";
import { useToast } from "@/context/toast";
import { useResource } from "@/hooks/use-resource";
import { colors, radii, shadows, spacing, typography } from "@/theme";

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const toast = useToast();

  const { data: product, isLoading, error, retry } = useResource<ProductDetail>(
    id ? `/products/${id}` : null,
  );

  if (isLoading) return <Screen><Loading /></Screen>;

  if (error || !product) {
    return (
      <Screen>
        <BackHeader />
        <StateView
          icon="alert-circle-outline"
          title="Couldn't load this product"
          body={error ?? "It may have been removed."}
          action={<Button label="Try again" icon="refresh" onPress={retry} />}
        />
      </Screen>
    );
  }

  const inCart = cart.quantityOf(product.id);
  const soldOut = product.stock <= 0;
  const atLimit = inCart >= product.stock;
  const isDiscounted = product.discountPercentage >= 1;

  return (
    <Screen edges={["top", "left", "right"]}>
      <BackHeader />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gallery}>
          <Image
            style={styles.hero}
            source={{ uri: product.images[0] ?? product.thumbnail }}
            contentFit="contain"
            transition={180}
          />
        </View>

        {product.images.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
          >
            {product.images.map((image) => (
              <Image
                key={image}
                style={styles.thumb}
                source={{ uri: image }}
                recyclingKey={image}
                contentFit="contain"
                transition={140}
              />
            ))}
          </ScrollView>
        )}

        <View style={styles.body}>
          <Text style={typography.caption}>
            {product.brand ? `${product.brand} · ` : ""}
            {product.category}
          </Text>

          <Text style={typography.screenTitle}>{product.title}</Text>

          <View style={styles.metaRow}>
            <Stars rating={product.rating} />
            <Text style={typography.caption}>SKU {product.sku}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCents(product.salePrice)}</Text>
            {isDiscounted && (
              <>
                <Text style={styles.wasPrice}>{formatCents(product.price)}</Text>
                <View style={styles.saveTag}>
                  <Text style={styles.saveTagText}>
                    Save {Math.round(product.discountPercentage)}%
                  </Text>
                </View>
              </>
            )}
          </View>

          <StockLine stock={product.stock} />

          <Text style={typography.body}>{product.description}</Text>

          {product.tags.length > 0 && (
            <View style={styles.tags}>
              {product.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={typography.caption}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {product.reviews.length > 0 && (
            <View style={styles.reviews}>
              <Text style={typography.sectionTitle}>
                Reviews ({product.reviews.length})
              </Text>

              {product.reviews.slice(0, 5).map((review) => (
                <View key={review.id} style={[styles.review, shadows.soft]}>
                  <View style={styles.reviewHead}>
                    <Text style={typography.cardTitle}>{review.reviewerName}</Text>
                    <Stars rating={review.rating} />
                  </View>
                  <Text style={typography.bodyMuted}>{review.comment}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bar, shadows.floating, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={
            soldOut
              ? "Sold out"
              : atLimit
                ? `Max ${product.stock} in cart`
                : inCart > 0
                  ? `Add another (${inCart} in cart)`
                  : "Add to cart"
          }
          icon={soldOut ? "close-circle-outline" : "cart-outline"}
          disabled={soldOut || atLimit}
          onPress={() => {
            cart.add(product);
            toast.show(`${product.title} added`, "success");
          }}
        />
      </View>
    </Screen>
  );
}

function StockLine({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <View style={styles.stockRow}>
        <Ionicons name="close-circle" size={15} color={colors.danger} />
        <Text style={[typography.caption, { color: colors.danger }]}>Out of stock</Text>
      </View>
    );
  }

  const low = stock <= 10;

  return (
    <View style={styles.stockRow}>
      <Ionicons
        name={low ? "alert-circle" : "checkmark-circle"}
        size={15}
        color={low ? colors.accent : colors.success}
      />
      <Text style={[typography.caption, { color: low ? colors.accent : colors.success }]}>
        {low ? `Only ${stock} left` : "In stock"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  gallery: {
    height: 260,
    marginHorizontal: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  hero: { flex: 1 },
  strip: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.xs,
  },
  body: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  price: { fontSize: 26, lineHeight: 32, fontWeight: "800", color: colors.text },
  wasPrice: { ...typography.bodyMuted, textDecorationLine: "line-through" },
  saveTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
  },
  saveTagText: { fontSize: 11, fontWeight: "700", color: colors.surface },
  stockRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
  },
  reviews: { gap: spacing.sm, marginTop: spacing.lg },
  review: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  reviewHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});

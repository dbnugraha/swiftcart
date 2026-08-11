import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { formatCents, type Product } from "@swiftcart/shared";

import { Stars } from "@/components/ui";
import { colors, radii, shadows, spacing, typography } from "@/theme";

/** Fraction of screen width that commits a swipe. */
const COMMIT_RATIO = 0.28;
const COMMIT_VELOCITY = 800;
const ROTATION_DEGREES = 10;

/**
 * Tinder-style product discovery.
 *
 * Right adds to the cart, left skips. Skipping is non-destructive — it only
 * advances a cursor, so nothing is lost and a reshuffle brings more.
 *
 * The buttons below are not a convenience: a swipe-only surface is unreachable
 * with a screen reader, and they are the accessible path to the same actions.
 */
export default function SwipeDeck({
  products,
  onWant,
  onOpen,
  onExhausted,
}: {
  products: Product[];
  onWant: (product: Product) => void;
  onOpen: (product: Product) => void;
  onExhausted: () => void;
}) {
  const { width } = useWindowDimensions();
  const [cursor, setCursor] = useState(0);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const current = products[cursor];
  const next = products[cursor + 1];

  // Plain functions, not useCallback: the React Compiler is enabled so it
  // memoises these itself, and listing shared values as hook dependencies is
  // what trips the compiler's immutability rule.
  const advance = () => {
    setCursor((prev) => prev + 1);
    translateX.value = 0;
    translateY.value = 0;
  };

  const commit = (direction: "left" | "right") => {
    const product = products[cursor];
    if (product && direction === "right") onWant(product);
    advance();
  };

  /** Shared by the gesture and the buttons so both animate identically. */
  const flingOut = (direction: "left" | "right") => {
    const target = direction === "left" ? -width * 1.5 : width * 1.5;

    translateX.value = withTiming(target, { duration: 180 }, (finished) => {
      if (finished) runOnJS(commit)(direction);
    });
  };

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const past =
        Math.abs(event.translationX) > width * COMMIT_RATIO ||
        Math.abs(event.velocityX) > COMMIT_VELOCITY;

      if (past) {
        runOnJS(flingOut)(event.translationX < 0 ? "left" : "right");
        return;
      }

      translateX.value = withSpring(0, { damping: 18, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-width, 0, width],
          [-ROTATION_DEGREES, 0, ROTATION_DEGREES],
        )}deg`,
      },
    ],
  }));

  const wantStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, width * COMMIT_RATIO], [0, 1], "clamp"),
  }));

  const skipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -width * COMMIT_RATIO], [0, 1], "clamp"),
  }));

  const nextStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      Math.abs(translateX.value),
      [0, width * COMMIT_RATIO],
      [0, 1],
      "clamp",
    );

    return {
      transform: [{ scale: 0.94 + progress * 0.06 }],
      opacity: 0.55 + progress * 0.45,
    };
  });

  if (!current) {
    return (
      <View style={styles.done}>
        <Ionicons name="checkmark-done" size={30} color={colors.textSecondary} />
        <Text style={typography.sectionTitle}>That&apos;s the lot</Text>
        <Text style={[typography.bodyMuted, styles.doneBody]}>
          Shuffle for a fresh set of products.
        </Text>
        <Pressable
          onPress={onExhausted}
          accessibilityRole="button"
          style={({ pressed }) => [styles.shuffle, pressed && styles.pressed]}
        >
          <Ionicons name="shuffle" size={18} color={colors.surface} />
          <Text style={styles.shuffleLabel}>Shuffle</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        {next && (
          <Animated.View
            pointerEvents="none"
            style={[styles.card, styles.cardBehind, nextStyle]}
          >
            <Image
              style={styles.image}
              source={{ uri: next.thumbnail }}
              recyclingKey={next.id}
              contentFit="contain"
              transition={140}
            />
          </Animated.View>
        )}

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.card, shadows.floating, cardStyle]}>
            <Pressable
              style={styles.cardPress}
              onPress={() => onOpen(current)}
              accessibilityRole="button"
              accessibilityLabel={`${current.title}, ${formatCents(current.salePrice)}. Open details.`}
            >
              <Image
                style={styles.image}
                source={{ uri: current.thumbnail }}
                recyclingKey={current.id}
                contentFit="contain"
                transition={180}
              />

              <View style={styles.caption}>
                <Text style={typography.sectionTitle} numberOfLines={2}>
                  {current.title}
                </Text>
                <View style={styles.captionRow}>
                  <Text style={typography.price}>{formatCents(current.salePrice)}</Text>
                  <Stars rating={current.rating} />
                </View>
                <Text style={typography.caption} numberOfLines={1}>
                  {current.brand ? `${current.brand} · ` : ""}
                  {current.category}
                </Text>
              </View>

              <Animated.View
                pointerEvents="none"
                style={[styles.stamp, styles.stampWant, wantStyle]}
              >
                <Text style={[styles.stampText, { color: colors.success }]}>WANT</Text>
              </Animated.View>

              <Animated.View
                pointerEvents="none"
                style={[styles.stamp, styles.stampSkip, skipStyle]}
              >
                <Text style={[styles.stampText, { color: colors.danger }]}>SKIP</Text>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={() => flingOut("left")}
          accessibilityRole="button"
          accessibilityLabel={`Skip ${current.title}`}
          style={({ pressed }) => [styles.control, styles.skip, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={26} color={colors.danger} />
        </Pressable>

        <Text style={typography.caption}>
          {products.length - cursor} left
        </Text>

        <Pressable
          onPress={() => flingOut("right")}
          accessibilityRole="button"
          accessibilityLabel={`Add ${current.title} to cart`}
          style={({ pressed }) => [styles.control, styles.want, pressed && styles.pressed]}
        >
          <Ionicons name="cart" size={22} color={colors.surface} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.lg },
  stage: { flex: 1, justifyContent: "center" },
  card: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radii.card + spacing.xs,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  cardBehind: {},
  cardPress: { flex: 1 },
  image: { flex: 1, backgroundColor: colors.surface, margin: spacing.lg },
  caption: {
    padding: spacing.lg,
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  captionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stamp: {
    position: "absolute",
    top: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 3,
    backgroundColor: colors.surface,
  },
  stampWant: {
    left: spacing.xl,
    borderColor: colors.success,
    transform: [{ rotate: "-12deg" }],
  },
  stampSkip: {
    right: spacing.xl,
    borderColor: colors.danger,
    transform: [{ rotate: "12deg" }],
  },
  stampText: { fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
  },
  control: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  skip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  want: { backgroundColor: colors.primary },
  done: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  doneBody: { textAlign: "center" },
  shuffle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  shuffleLabel: { ...typography.button, color: colors.surface },
  pressed: { opacity: 0.8 },
});

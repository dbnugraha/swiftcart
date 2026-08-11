import Ionicons from "@expo/vector-icons/Ionicons";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_SPRING, useTabSwipe } from "@/components/TabSwipe";
import { Badge } from "@/components/ui";
import { useCart } from "@/context/cart";
import { colors, radii, shadows, spacing, TAB_BAR_HEIGHT, typography } from "@/theme";

type IconPair = {
  on: React.ComponentProps<typeof Ionicons>["name"];
  off: React.ComponentProps<typeof Ionicons>["name"];
};

const ICONS: Record<string, IconPair> = {
  index: { on: "storefront", off: "storefront-outline" },
  discover: { on: "sparkles", off: "sparkles-outline" },
  cart: { on: "cart", off: "cart-outline" },
  account: { on: "person", off: "person-outline" },
};

/** Gap between the indicator and the tab it sits under. */
const PILL_INSET = 6;
/** How much the indicator elongates at the midpoint between two tabs. */
const STRETCH = 0.8;
/** …and how much it flattens while stretched, which is what reads as liquid. */
const SQUASH = 0.25;

/**
 * Floating tab bar. Content scrolls underneath it — screens reserve room with
 * `useTabBarInset()` rather than the bar pushing layout.
 *
 * The indicator is driven by `TabSwipeArea`'s shared value rather than by the
 * focused route, so during a swipe it tracks your finger and shows where you
 * would land before you commit. It stretches as it travels and rounds out as it
 * settles, which is what makes it read as one blob moving rather than a
 * rectangle teleporting.
 */
export default function ShopTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { cart } = useCart();
  const [barWidth, setBarWidth] = useState(0);

  // The bar is only ever mounted inside the tabs, but it stays usable without
  // them: its own shared value then simply never moves except on a tab change.
  const swipe = useTabSwipe();
  const ownIndicator = useSharedValue(0);
  const indicator = swipe?.indicator ?? ownIndicator;

  const activeIndex = state.index;
  const tabWidth = barWidth / state.routes.length;

  useEffect(() => {
    // Settles the indicator after a tap, and after a swipe commits — by then it
    // is already most of the way there, so this is a short spring, not a jump.
    indicator.value = withSpring(activeIndex, TAB_SPRING);
    // `indicator` is a stable ref; listing it is what trips the compiler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const pillStyle = useAnimatedStyle(() => {
    // Distance from the nearest tab: 0 parked, 0.5 exactly between two.
    const travel = Math.abs(indicator.value - Math.round(indicator.value));

    return {
      transform: [
        { translateX: indicator.value * tabWidth + PILL_INSET },
        { scaleX: 1 + travel * STRETCH },
        { scaleY: 1 - travel * SQUASH },
      ],
    };
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: insets.bottom + spacing.sm }]}
    >
      <View
        style={[styles.bar, shadows.floating]}
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      >
        {barWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.pill, { width: tabWidth - PILL_INSET * 2 }, pillStyle]}
          />
        )}

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key]!;
          const label = options.title ?? route.name;
          const icon = ICONS[route.name] ?? ICONS.index!;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Tab
              key={route.key}
              index={index}
              indicator={indicator}
              icon={icon}
              label={label}
              isFocused={isFocused}
              badge={route.name === "cart" ? cart.itemCount : 0}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function Tab({
  index,
  indicator,
  icon,
  label,
  isFocused,
  badge,
  onPress,
}: {
  index: number;
  indicator: SharedValue<number>;
  icon: IconPair;
  label: string;
  isFocused: boolean;
  badge: number;
  onPress: () => void;
}) {
  // Lifts as the indicator arrives, so a half-finished swipe already looks like
  // it is going somewhere rather than waiting for navigation to catch up.
  const contentStyle = useAnimatedStyle(() => {
    const nearness = 1 - Math.min(1, Math.abs(indicator.value - index));

    return {
      opacity: 0.65 + nearness * 0.35,
      transform: [{ scale: 0.94 + nearness * 0.06 }],
    };
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={label}
      android_ripple={{ color: colors.border, borderless: true }}
      style={styles.tab}
    >
      <Animated.View style={[styles.tabContent, contentStyle]}>
        <View>
          <Ionicons
            name={isFocused ? icon.on : icon.off}
            size={22}
            color={isFocused ? colors.primary : colors.textSecondary}
          />
          {badge > 0 && (
            <View style={styles.badgeSlot}>
              <Badge count={badge} />
            </View>
          )}
        </View>

        <Text style={[styles.label, isFocused && styles.labelOn]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pill: {
    position: "absolute",
    left: 0,
    top: PILL_INSET,
    bottom: PILL_INSET,
    borderRadius: radii.pill,
    backgroundColor: `${colors.primary}14`,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabContent: { alignItems: "center", justifyContent: "center", gap: 2 },
  badgeSlot: { position: "absolute", top: -6, right: -10 },
  label: { ...typography.caption, fontSize: 11 },
  labelOn: { color: colors.primary, fontWeight: "700" },
});

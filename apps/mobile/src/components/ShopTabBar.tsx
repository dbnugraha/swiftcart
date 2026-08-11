import Ionicons from "@expo/vector-icons/Ionicons";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

/**
 * Floating tab bar. Content scrolls underneath it — screens reserve room with
 * `useTabBarInset()` rather than the bar pushing layout.
 */
export default function ShopTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { cart } = useCart();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: insets.bottom + spacing.sm }]}
    >
      <View style={[styles.bar, shadows.floating]}>
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
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={label}
              android_ripple={{ color: colors.border, borderless: true }}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <View>
                <Ionicons
                  name={isFocused ? icon.on : icon.off}
                  size={22}
                  color={isFocused ? colors.primary : colors.textSecondary}
                />
                {route.name === "cart" && (
                  <View style={styles.badgeSlot}>
                    <Badge count={cart.itemCount} />
                  </View>
                )}
              </View>

              <Text style={[styles.label, isFocused && styles.labelOn]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  pressed: { opacity: 0.7 },
  badgeSlot: { position: "absolute", top: -6, right: -10 },
  label: { ...typography.caption, fontSize: 11 },
  labelOn: { color: colors.primary, fontWeight: "700" },
});

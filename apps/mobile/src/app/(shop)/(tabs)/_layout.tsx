import { Tabs } from "expo-router/js-tabs";

import ShopTabBar from "@/components/ShopTabBar";
import TabSwipeArea from "@/components/TabSwipe";
import { colors } from "@/theme";

// Hoisted so this layout renders the identical element every time and the
// navigator is never reconfigured for nothing.
const SCREEN_OPTIONS = {
  headerShown: false,
  // Screens slide in the direction of travel, so a swipe and a tap on the bar
  // resolve the same way.
  animation: "shift",
  sceneStyle: { backgroundColor: colors.background },
} as const;

const renderTabBar = (props: React.ComponentProps<typeof ShopTabBar>) => (
  <ShopTabBar {...props} />
);

export default function TabsLayout() {
  return (
    <TabSwipeArea>
      <Tabs screenOptions={SCREEN_OPTIONS} tabBar={renderTabBar}>
        <Tabs.Screen name="index" options={{ title: "Shop" }} />
        <Tabs.Screen name="discover" options={{ title: "Discover" }} />
        <Tabs.Screen name="cart" options={{ title: "Cart" }} />
        <Tabs.Screen name="account" options={{ title: "Account" }} />
      </Tabs>
    </TabSwipeArea>
  );
}

import { Tabs } from "expo-router/js-tabs";

import ShopTabBar from "@/components/ShopTabBar";
import TabSwipeArea from "@/components/TabSwipe";
import { colors } from "@/theme";

// Hoisted so this layout renders the identical element every time and the
// navigator is never reconfigured for nothing.
const SCREEN_OPTIONS = {
  headerShown: false,
  // No scene animation, deliberately. The "shift" preset cross-fades the two
  // screens over 150ms, so mid-transition both are around half opacity and the
  // outgoing tab's contents ghost through the incoming one — on screens this
  // dense it reads as a glitch, not a transition. The tab bar indicator already
  // carries the motion, and it tracks the swipe rather than trailing it.
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

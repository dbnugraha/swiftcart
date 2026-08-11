import { router, usePathname } from "expo-router";
import { createContext, use } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  runOnJS,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Drag left or right anywhere on a tab screen to move to the neighbouring tab.
 *
 * The gesture lives above the navigator, so it exists exactly once and cannot
 * drift out of step with the tab bar.
 *
 * **Activation is manual.** Letting gesture-handler decide, with an
 * `activeOffsetX` threshold, meant it competed with the horizontal scrollers
 * inside the screens — the category chips especially — and the tab would change
 * out from under someone who was only scrolling the filters. Relating the
 * gestures to each other did not settle it reliably. Deciding here instead
 * makes the rule explicit and unconditional: a child that owns horizontal drags
 * marks itself with `useTabSwipeSuppressor()`, and while a drag starts inside
 * one, this gesture fails outright rather than racing it.
 *
 * The drag also drives `indicator`, a continuous position in tab units that the
 * tab bar renders, so the bar follows your finger and shows where you would
 * land before you let go.
 */

/** Tab order, matching the bar. The index is what a swipe moves by. */
const TAB_ROUTES = ["/", "/discover", "/cart", "/account"] as const;

type TabRoute = (typeof TAB_ROUTES)[number];

/** Horizontal travel before the swipe takes the drag. */
const ACTIVATE_X = 20;
/** Vertical travel that abandons it — that is a scroll, not a tab change. */
const FAIL_Y = 14;
/** Fraction of a tab's travel that commits on release. */
const COMMIT_PROGRESS = 0.35;
/** …or this much speed, so a quick flick works without crossing the distance. */
const COMMIT_VELOCITY = 550;
/** Drag distance worth one whole tab, as a fraction of screen width. */
const SPAN_RATIO = 0.45;

/** Shared by the swipe and the bar, so both settle identically. */
export const TAB_SPRING = { damping: 17, stiffness: 170, mass: 0.6 };

type TabSwipeApi = {
  /** Where the bar's indicator sits, in tab units. Fractional mid-drag. */
  indicator: SharedValue<number>;
  /** True while a child owns the drag and the tab swipe must stand aside. */
  suppressed: SharedValue<boolean>;
};

const TabSwipeContext = createContext<TabSwipeApi | null>(null);

/** Null outside the tabs — the deck and the bar are both reusable elsewhere. */
export function useTabSwipe() {
  return use(TabSwipeContext);
}

/**
 * Props for a view that owns horizontal drags of its own — a carousel, the
 * Discover deck. Spread them on it and the tab swipe will not fight it:
 *
 * ```tsx
 * <ScrollView horizontal {...useTabSwipeSuppressor()} />
 * ```
 */
export function useTabSwipeSuppressor() {
  const api = use(TabSwipeContext);

  const set = (value: boolean) => () => {
    if (api) api.suppressed.value = value;
  };

  return {
    onTouchStart: set(true),
    onTouchEnd: set(false),
    onTouchCancel: set(false),
  };
}

export default function TabSwipeArea({ children }: { children: React.ReactNode }) {
  // Reading the path here rather than in the layout is deliberate: this
  // component re-renders on navigation, but `children` is the same element as
  // last time, so the navigator itself is left alone.
  const pathname = usePathname();
  const index = TAB_ROUTES.indexOf(pathname as TabRoute);
  const { width } = useWindowDimensions();
  const span = width * SPAN_RATIO;

  const indicator = useSharedValue(0);
  const suppressed = useSharedValue(false);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const go = (step: number) => {
    const next = TAB_ROUTES[index + step];
    if (next) router.navigate(next);
  };

  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((event) => {
      const touch = event.allTouches[0];
      if (!touch) return;

      startX.value = touch.absoluteX;
      startY.value = touch.absoluteY;
    })
    .onTouchesMove((event, manager) => {
      // -1 means a screen is stacked above the tabs, so there is no current tab
      // to move from.
      if (index === -1 || suppressed.value) {
        manager.fail();
        return;
      }

      const touch = event.allTouches[0];
      if (!touch) return;

      const dx = touch.absoluteX - startX.value;
      const dy = touch.absoluteY - startY.value;

      if (Math.abs(dy) > FAIL_Y) manager.fail();
      else if (Math.abs(dx) > ACTIVATE_X) manager.activate();
    })
    .onUpdate((event) => {
      // Dragging content left reveals what is to its right — the next tab.
      const offset = -event.translationX / span;

      // Clamped to the ends: there is nothing past Shop or Account, and the
      // indicator refusing to move is the honest way to say so.
      const bounded = Math.min(Math.max(offset, -index), TAB_ROUTES.length - 1 - index);
      indicator.value = index + bounded;
    })
    .onEnd((event) => {
      const offset = -event.translationX / span;
      const velocity = -event.velocityX;

      const flung = Math.abs(velocity) > COMMIT_VELOCITY;
      const committed = flung || Math.abs(offset) > COMMIT_PROGRESS;
      const step = committed ? Math.sign(flung ? velocity : offset) : 0;

      const target = Math.min(Math.max(index + step, 0), TAB_ROUTES.length - 1);

      indicator.value = withSpring(target, TAB_SPRING);
      if (target !== index) runOnJS(go)(step);
    })
    .onFinalize(() => {
      // Belt and braces: a child that never sees its touch end — because a
      // parent claimed the responder — would otherwise leave this stuck on.
      suppressed.value = false;
    });

  return (
    <TabSwipeContext value={{ indicator, suppressed }}>
      <GestureDetector gesture={pan}>
        <View style={styles.fill} collapsable={false}>
          {children}
        </View>
      </GestureDetector>
    </TabSwipeContext>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

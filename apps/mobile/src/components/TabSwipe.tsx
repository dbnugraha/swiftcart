import { router, usePathname } from "expo-router";
import { createContext, use, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, type GestureType } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

/**
 * Drag left or right anywhere on a tab screen to move to the neighbouring tab.
 *
 * The gesture lives above the navigator rather than inside each screen, so it
 * exists exactly once and cannot drift out of step with the tab bar.
 *
 * Two thresholds keep it out of everyone else's way:
 *   - `failOffsetY` abandons the gesture as soon as the drag leans vertical, so
 *     scrolling a list is untouched.
 *   - `activeOffsetX` means a tap or a short drag never counts.
 *
 * That still leaves genuinely horizontal children — the category chips, the
 * Discover deck — competing for the same drag. Rather than guess, they claim
 * priority explicitly with `useTabSwipeRef()`; see `blocksExternalGesture`.
 */

/** Tab order, matching the bar. The index is what a swipe moves by. */
const TAB_ROUTES = ["/", "/discover", "/cart", "/account"] as const;

type TabRoute = (typeof TAB_ROUTES)[number];

/** Horizontal travel before the gesture takes over from anything beneath it. */
const ACTIVATE_X = 24;
/** Vertical travel that abandons it — a scroll, not a tab change. */
const FAIL_Y = 18;
/** Either of these commits the swipe: far enough, or fast enough. */
const COMMIT_DISTANCE = 64;
const COMMIT_VELOCITY = 450;

const TabSwipeContext = createContext<React.RefObject<GestureType | undefined> | null>(null);

/**
 * A handle on the tab-swipe gesture, for a nested gesture that must win the
 * same drag. Spread it into `blocksExternalGesture`, which then makes the tab
 * swipe wait for that gesture to fail:
 *
 * ```ts
 * const tabSwipe = useTabSwipeRef();
 * const pan = Gesture.Pan().blocksExternalGesture(...(tabSwipe ? [tabSwipe] : []));
 * ```
 *
 * Returns null outside the tabs, where there is nothing to block.
 */
export function useTabSwipeRef() {
  return use(TabSwipeContext);
}

export default function TabSwipeArea({ children }: { children: React.ReactNode }) {
  // Reading the path here rather than in the layout is deliberate: this
  // component re-renders on navigation, but `children` is the same element as
  // last time, so the navigator itself is left alone.
  const pathname = usePathname();
  const index = TAB_ROUTES.indexOf(pathname as TabRoute);

  const gestureRef = useRef<GestureType | undefined>(undefined);

  const go = (step: 1 | -1) => {
    // -1 means a screen is stacked above the tabs, so there is no current tab
    // to move from. Stopping at the ends is intentional; wrapping around from
    // Account to Shop reads as a mis-swipe.
    if (index === -1) return;

    const next = TAB_ROUTES[index + step];
    if (next) router.navigate(next);
  };

  const pan = Gesture.Pan()
    // Gesture handler stores this and writes to it when the detector attaches;
    // it is never read during render. The compiler's ref rule can't see that
    // through the builder call, so the suppression is scoped to this line.
    // eslint-disable-next-line react-hooks/refs
    .withRef(gestureRef)
    .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
    .failOffsetY([-FAIL_Y, FAIL_Y])
    .onEnd((event) => {
      const committed =
        Math.abs(event.translationX) > COMMIT_DISTANCE ||
        Math.abs(event.velocityX) > COMMIT_VELOCITY;

      // Dragging content left reveals what is to its right — the next tab.
      if (committed) runOnJS(go)(event.translationX < 0 ? 1 : -1);
    });

  return (
    <TabSwipeContext value={gestureRef}>
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

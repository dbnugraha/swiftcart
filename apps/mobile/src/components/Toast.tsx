import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, durations, radii, shadows, spacing, typography } from "@/theme";

export type ToastTone = "info" | "success" | "error";

export type ToastMessage = {
  /** Bumped on every show so repeating the same text still re-triggers. */
  id: number;
  text: string;
  tone: ToastTone;
};

const HOLD_MS = 2200;

const TONE_COLOR: Record<ToastTone, string> = {
  info: colors.text,
  success: colors.success,
  error: colors.danger,
};

export default function Toast({ message }: { message: ToastMessage | null }) {
  const insets = useSafeAreaInsets();
  // Lazy useState rather than `useRef(new Animated.Value()).current`: reading
  // `.current` during render is unsafe under the React Compiler, which this
  // app enables. The initialiser runs once, so it is just as stable.
  const [progress] = useState(() => new Animated.Value(0));
  const [dismissedId, setDismissedId] = useState<number | null>(null);

  // Derived rather than mirrored into state: the toast is whatever the
  // provider last published, until its own animation retires it by id.
  const visible = message && message.id !== dismissedId ? message : null;

  useEffect(() => {
    if (!message) return;

    progress.setValue(0);

    const animation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: durations.base,
        useNativeDriver: true,
      }),
      Animated.delay(HOLD_MS),
      Animated.timing(progress, {
        toValue: 0,
        duration: durations.base,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished) setDismissedId(message.id);
    });

    return () => animation.stop();
  }, [message, progress]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.wrapper,
        shadows.floating,
        {
          // Anchored to the top: the bottom edge is crowded by the tab bar and
          // sticky checkout buttons.
          top: insets.top + spacing.sm,
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={[styles.text, { color: TONE_COLOR[visible.tone] }]} numberOfLines={2}>
        {visible.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  text: {
    ...typography.body,
    fontWeight: "600",
    textAlign: "center",
  },
});

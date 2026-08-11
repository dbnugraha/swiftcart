import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Screen, StateView } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme";

/**
 * expo-router renders this instead of a red screen when a route throws during
 * render.
 *
 * Without it a single bad render kills the whole app with a stack trace the
 * user can do nothing about; with it they get an explanation and a way back.
 * The stack is shown only in development — in a release build it is noise at
 * best and an information leak at worst.
 */
export function ErrorBoundary({
  error,
  retry,
}: {
  error: Error;
  retry: () => Promise<void>;
}) {
  return (
    <Screen edges={["top", "bottom", "left", "right"]}>
      <StateView
        icon="warning-outline"
        title="This screen hit a snag"
        body="Something went wrong while drawing this page. Trying again usually clears it."
        action={<Button label="Try again" onPress={() => void retry()} icon="refresh" />}
      />

      {__DEV__ && (
        <ScrollView style={styles.details} contentContainerStyle={styles.detailsBody}>
          <Text style={typography.label}>Development detail</Text>
          <View style={styles.stack}>
            <Text style={styles.stackText}>{error.message}</Text>
            {error.stack && <Text style={styles.stackText}>{error.stack}</Text>}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  details: {
    maxHeight: 220,
    margin: spacing.lg,
  },
  detailsBody: { gap: spacing.sm },
  stack: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  stackText: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
    fontFamily: "monospace",
  },
});

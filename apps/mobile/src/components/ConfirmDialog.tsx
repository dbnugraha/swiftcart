import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui";
import { colors, radii, shadows, spacing, typography } from "@/theme";

/**
 * The app's own confirmation dialog, in place of `Alert.alert`.
 *
 * The native alert is the one surface that ignores everything else here — its
 * own typeface, corners, button order and colours, and a different look on each
 * platform. For a destructive step like emptying a cart, that inconsistency
 * lands exactly where the user is deciding whether to trust the app.
 *
 * Cancel sits first and is the wider habit; the destructive action is on the
 * right, in the danger variant, and never the one you hit by reflex.
 */

export type ConfirmRequest = {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for anything that destroys or signs out. */
  tone?: "danger" | "primary";
  icon?: React.ComponentProps<typeof Ionicons>["name"];
};

export default function ConfirmDialog({
  request,
  visible,
  onConfirm,
  onCancel,
}: {
  /**
   * Kept while the dialog fades out — clearing it with `visible` would empty
   * the card for the length of the animation.
   */
  request: ConfirmRequest | null;
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isDanger = request?.tone === "danger";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android's back button. Dismissing has to mean cancel, never confirm.
      onRequestClose={onCancel}
    >
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        />

        {request && (
          <View style={[styles.card, shadows.floating]} accessibilityViewIsModal>
            {request.icon && (
              <View style={[styles.icon, isDanger && styles.iconDanger]}>
                <Ionicons
                  name={request.icon}
                  size={24}
                  color={isDanger ? colors.danger : colors.primary}
                />
              </View>
            )}

            <Text style={[typography.sectionTitle, styles.title]}>{request.title}</Text>

            {request.body && (
              <Text style={[typography.bodyMuted, styles.body]}>{request.body}</Text>
            )}

            <View style={styles.actions}>
              <Button
                label={request.cancelLabel ?? "Cancel"}
                variant="secondary"
                style={styles.action}
                onPress={onCancel}
              />
              <Button
                label={request.confirmLabel}
                variant={isDanger ? "danger" : "primary"}
                style={styles.action}
                onPress={onConfirm}
              />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.overlay,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    padding: spacing.xl,
    borderRadius: radii.card + spacing.xs,
    backgroundColor: colors.surface,
  },
  icon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: `${colors.primary}14`,
    marginBottom: spacing.md,
  },
  iconDanger: { backgroundColor: `${colors.danger}14` },
  title: { textAlign: "center" },
  body: { textAlign: "center", marginTop: spacing.xs },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xl,
    alignSelf: "stretch",
  },
  action: { flex: 1, paddingHorizontal: spacing.md },
});

import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ProductSort } from "@swiftcart/shared";

import { colors, radii, shadows, spacing, typography } from "@/theme";

/** The same four orderings SauceDemo offers, plus rating. */
const OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "name-asc", label: "Name (A to Z)" },
  { value: "name-desc", label: "Name (Z to A)" },
  { value: "price-asc", label: "Price (low to high)" },
  { value: "price-desc", label: "Price (high to low)" },
  { value: "rating-desc", label: "Rating (high to low)" },
];

export const sortLabel = (sort: ProductSort) =>
  OPTIONS.find((option) => option.value === sort)?.label ?? "Sort";

export default function SortSheet({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: ProductSort;
  onChange: (sort: ProductSort) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />

      <View style={[styles.sheet, shadows.floating, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.grabber} />
        <Text style={[typography.sectionTitle, styles.title]}>Sort by</Text>

        {OPTIONS.map((option) => {
          const isOn = option.value === value;

          return (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                onClose();
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: isOn }}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <Text style={[typography.body, isOn && styles.optionOn]}>{option.label}</Text>
              {isOn && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopLeftRadius: radii.card + spacing.xs,
    borderTopRightRadius: radii.card + spacing.xs,
    backgroundColor: colors.surface,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  title: { marginTop: spacing.md, marginBottom: spacing.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  optionOn: { color: colors.primary, fontWeight: "700" },
  pressed: { opacity: 0.7 },
});

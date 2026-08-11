import Ionicons from "@expo/vector-icons/Ionicons";
import { forwardRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { Screen } from "@/components/ui";
import { colors, radii, spacing, typography } from "@/theme";

/** The shared furniture of the sign-in and sign-up screens. */

export function AuthShell({
  tagline,
  children,
}: {
  tagline: string;
  children: React.ReactNode;
}) {
  return (
    <Screen edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        // Android's window already resizes, so "height" would double-compensate.
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.brand}>
            <View style={styles.mark}>
              <Ionicons name="bag-handle" size={30} color={colors.surface} />
            </View>
            <Text style={styles.wordmark}>Swiftcart</Text>
            <Text style={[typography.bodyMuted, styles.tagline]}>{tagline}</Text>
          </View>

          <View style={styles.form}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

type FieldProps = TextInputProps & { secure?: boolean; label: string };

export const AuthField = forwardRef<TextInput, FieldProps>(function AuthField(
  { secure = false, label, style, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={typography.label}>{label}</Text>

      <View style={styles.inputWrap}>
        <TextInput
          ref={ref}
          style={[styles.input, secure && styles.inputWithAffix, style]}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={secure && !visible}
          {...props}
        />

        {secure && (
          <Pressable
            onPress={() => setVisible((prev) => !prev)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            style={styles.affix}
          >
            <Ionicons
              name={visible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
});

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <View style={styles.error} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle" size={16} color={colors.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function AuthSwitch({
  prompt,
  action,
  onPress,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      hitSlop={8}
      style={({ pressed }) => [styles.switch, pressed && styles.pressed]}
    >
      <Text style={typography.bodyMuted}>{prompt} </Text>
      <Text style={styles.switchAction}>{action}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  brand: { alignItems: "center", marginBottom: spacing.xxl },
  mark: {
    width: 60,
    height: 60,
    borderRadius: radii.card,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  wordmark: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: colors.text,
  },
  tagline: { marginTop: spacing.xs, textAlign: "center" },
  form: { gap: spacing.lg },
  field: { gap: spacing.xs },
  inputWrap: { justifyContent: "center" },
  input: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    ...typography.body,
  },
  inputWithAffix: { paddingRight: spacing.xxl + spacing.md },
  affix: { position: "absolute", right: spacing.lg },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "rgba(192, 57, 43, 0.08)",
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
    fontWeight: "600",
  },
  switch: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  switchAction: {
    ...typography.body,
    fontWeight: "700",
    color: colors.primary,
  },
  pressed: { opacity: 0.7 },
});

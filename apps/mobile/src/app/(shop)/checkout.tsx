import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ERROR_CODES, formatCents, type Order, type ShippingAddress } from "@swiftcart/shared";

import { BackHeader, Button, Screen, StateView } from "@/components/ui";
import { useCart } from "@/context/cart";
import { api, errorMessage, isApiError } from "@/lib/api";
import { colors, radii, shadows, spacing, typography } from "@/theme";

type Step = "address" | "review";

const EMPTY: ShippingAddress = {
  fullName: "",
  addressLine: "",
  city: "",
  postalCode: "",
  country: "",
};

/**
 * Two steps, then place. There is deliberately no payment step — a real
 * checkout would collect a payment method between review and placing, and the
 * order would be created on its confirmation rather than here.
 */
export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { cart, reload } = useCart();

  const [step, setStep] = useState<Step>("address");
  const [address, setAddress] = useState<ShippingAddress>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);

  if (cart.lines.length === 0) {
    return (
      <Screen edges={["top", "bottom", "left", "right"]}>
        <StateView
          icon="cart-outline"
          title="Your cart is empty"
          body="Add something before checking out."
          action={<Button label="Back to shop" onPress={() => router.replace("/")} />}
        />
      </Screen>
    );
  }

  const set = (key: keyof ShippingAddress) => (value: string) => {
    setAddress((prev) => ({ ...prev, [key]: value }));
    // Clear just this field's error — leaving it under a corrected input reads
    // as a second, phantom rejection.
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setError(null);
  };

  const validate = () => {
    const errors: Record<string, string> = {};

    if (!address.fullName.trim()) errors.fullName = "Name is required.";
    if (!address.addressLine.trim()) errors.addressLine = "Address is required.";
    if (!address.city.trim()) errors.city = "City is required.";
    if (address.postalCode.trim().length < 3) errors.postalCode = "Postal code is too short.";
    if (address.country.trim().length < 2) errors.country = "Country is required.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const placeOrder = async () => {
    if (isPlacing) return;

    setIsPlacing(true);
    setError(null);

    try {
      const order = await api.post<Order>("/orders", address);

      // The server empties the cart as part of the same transaction, so pull
      // the authoritative state rather than assuming.
      await reload().catch(() => undefined);

      // `placed` makes the confirmation screen celebrate rather than read as a
      // plain order lookup.
      router.replace({
        pathname: "/order/[id]",
        params: { id: order.id, placed: "1" },
      });
    } catch (cause) {
      // Stock can vanish between adding to the cart and paying, so this is a
      // normal outcome rather than an exception — say which item and send them
      // back to fix it.
      if (isApiError(cause) && cause.code === ERROR_CODES.OUT_OF_STOCK) {
        await reload().catch(() => undefined);
        setError(`${cause.message} Your cart has been updated.`);
        setStep("address");
      } else if (isApiError(cause) && cause.fields?.length) {
        setFieldErrors(
          Object.fromEntries(cause.fields.map((field) => [field.field, field.message])),
        );
        setStep("address");
      } else {
        setError(errorMessage(cause));
      }
    } finally {
      setIsPlacing(false);
    }
  };

  return (
    <Screen edges={["top", "left", "right"]}>
      <BackHeader
        title="Checkout"
        subtitle={
          step === "address" ? "Step 1 of 2 · Delivery address" : "Step 2 of 2 · Review"
        }
        // Back unwinds the step first — leaving the whole flow from the review
        // screen would silently discard a filled-in address.
        onBack={() => {
          if (step === "review") return setStep("address");
          if (router.canGoBack()) router.back();
          else router.replace("/cart");
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error && (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={17} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {step === "address" ? (
            <View style={styles.form}>
              <Field
                label="Full name"
                value={address.fullName}
                onChangeText={set("fullName")}
                error={fieldErrors.fullName}
                autoComplete="name"
                textContentType="name"
              />
              <Field
                label="Address"
                value={address.addressLine}
                onChangeText={set("addressLine")}
                error={fieldErrors.addressLine}
                autoComplete="street-address"
              />
              <Field
                label="City"
                value={address.city}
                onChangeText={set("city")}
                error={fieldErrors.city}
              />
              <Field
                label="Postal code"
                value={address.postalCode}
                onChangeText={set("postalCode")}
                error={fieldErrors.postalCode}
                autoComplete="postal-code"
              />
              <Field
                label="Country"
                value={address.country}
                onChangeText={set("country")}
                error={fieldErrors.country}
                autoComplete="country"
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Card title="Delivering to">
                <Text style={typography.body}>{address.fullName}</Text>
                <Text style={typography.bodyMuted}>{address.addressLine}</Text>
                <Text style={typography.bodyMuted}>
                  {address.city} {address.postalCode}
                </Text>
                <Text style={typography.bodyMuted}>{address.country}</Text>
              </Card>

              <Card title={`${cart.itemCount} ${cart.itemCount === 1 ? "item" : "items"}`}>
                {cart.lines.map((line) => (
                  <View key={line.productId} style={styles.reviewLine}>
                    <Text style={[typography.body, styles.reviewTitle]} numberOfLines={1}>
                      {line.quantity}× {line.product.title}
                    </Text>
                    <Text style={typography.body}>{formatCents(line.lineTotal)}</Text>
                  </View>
                ))}
              </Card>

              <Card title="Payment">
                <View style={styles.payment}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                  <Text style={typography.bodyMuted}>
                    This is a demo — no payment is taken and no card details are collected.
                  </Text>
                </View>
              </Card>

              <Card title="Total">
                <Row label="Subtotal" value={formatCents(cart.subtotal)} />
                <Row label="Tax (8%)" value={formatCents(cart.tax)} />
                <Row
                  label="Shipping"
                  value={cart.shipping === 0 ? "Free" : formatCents(cart.shipping)}
                />
                <View style={styles.divider} />
                <Row label="Total" value={formatCents(cart.total)} strong />
              </Card>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bar, shadows.floating, { paddingBottom: insets.bottom + spacing.md }]}>
        <View>
          <Text style={typography.caption}>Total</Text>
          <Text style={typography.sectionTitle}>{formatCents(cart.total)}</Text>
        </View>

        <Button
          label={step === "address" ? "Review order" : "Place order"}
          icon={step === "address" ? "arrow-forward" : "checkmark"}
          busy={isPlacing}
          style={styles.cta}
          onPress={() => {
            if (step === "address") {
              if (validate()) setStep("review");
              return;
            }
            void placeOrder();
          }}
        />
      </View>
    </Screen>
  );
}

function Field({
  label,
  error,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={typography.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="words"
        {...props}
      />
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={[styles.card, shadows.soft]}>
      <Text style={typography.label}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={strong ? typography.sectionTitle : typography.bodyMuted}>{label}</Text>
      <Text style={strong ? typography.sectionTitle : typography.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  form: { gap: spacing.md },
  field: { gap: spacing.xs },
  input: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  inputError: { borderColor: colors.danger },
  fieldError: { ...typography.caption, color: colors.danger },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "rgba(192, 57, 43, 0.08)",
  },
  errorText: { ...typography.caption, color: colors.danger, flex: 1, fontWeight: "600" },
  card: {
    padding: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  reviewLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 2,
  },
  reviewTitle: { flex: 1 },
  payment: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  cta: { flex: 1 },
});

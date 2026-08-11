import { router } from "expo-router";
import { useRef, useState } from "react";
import { Keyboard, StyleSheet, Text, View, type TextInput } from "react-native";

import { AuthError, AuthField, AuthShell, AuthSwitch } from "@/components/AuthForm";
import { Button } from "@/components/ui";
import { useAuth } from "@/context/auth";
import { errorMessage } from "@/lib/api";
import { colors, radii, spacing, typography } from "@/theme";

const DEMO = { email: "demo@swiftcart.test", password: "swiftcart123" };

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn } = useAuth();

  const passwordRef = useRef<TextInput>(null);

  // Any edit clears the last failure — leaving a stale error under a field the
  // user has already corrected reads as a second, phantom rejection.
  const edit = (setter: (value: string) => void) => (text: string) => {
    setter(text);
    setError(null);
  };

  const submit = async (credentials = { email: email.trim(), password }) => {
    if (isSubmitting) return;

    Keyboard.dismiss();
    setIsSubmitting(true);
    setError(null);

    try {
      // No manual navigation — the root guard redirects once the session lands.
      await signIn(credentials.email, credentials.password);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell tagline="Everything you need, delivered fast.">
      <AuthField
        label="Email"
        value={email}
        onChangeText={edit(setEmail)}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />

      <AuthField
        ref={passwordRef}
        label="Password"
        secure
        value={password}
        onChangeText={edit(setPassword)}
        placeholder="Your password"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />

      <AuthError message={error} />

      <Button label="Sign in" onPress={() => void submit()} busy={isSubmitting} />

      {/* This is a demo app, so the credentials are on the door — the same
          courtesy SauceDemo extends. */}
      <View style={styles.demo}>
        <Text style={typography.caption}>Demo account</Text>
        <Text style={styles.demoCreds}>
          {DEMO.email} / {DEMO.password}
        </Text>
        <Button
          label="Fill demo credentials"
          variant="secondary"
          onPress={() => {
            setEmail(DEMO.email);
            setPassword(DEMO.password);
            setError(null);
          }}
        />
      </View>

      <AuthSwitch
        prompt="New here?"
        action="Create an account"
        onPress={() => router.push("/sign-up")}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  demo: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
  },
  demoCreds: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
  },
});

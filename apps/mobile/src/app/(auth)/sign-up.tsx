import { router } from "expo-router";
import { useRef, useState } from "react";
import { Keyboard, type TextInput } from "react-native";

import { AuthError, AuthField, AuthShell, AuthSwitch } from "@/components/AuthForm";
import { Button } from "@/components/ui";
import { useAuth } from "@/context/auth";
import { errorMessage } from "@/lib/api";

// Mirrors the server's zod rule. Checked here too so a short password costs a
// keystroke of feedback rather than a round trip.
const MIN_PASSWORD = 8;

export default function SignUpScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signUp } = useAuth();

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const edit = (setter: (value: string) => void) => (text: string) => {
    setter(text);
    setError(null);
  };

  const submit = async () => {
    if (isSubmitting) return;

    Keyboard.dismiss();

    if (!name.trim()) return setError("Enter your name.");
    if (password.length < MIN_PASSWORD) {
      return setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Signing up signs you in; the root guard handles navigation.
      await signUp(name.trim(), email.trim(), password);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell tagline="Create an account to start shopping.">
      <AuthField
        label="Name"
        value={name}
        onChangeText={edit(setName)}
        placeholder="Your name"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
      />

      <AuthField
        ref={emailRef}
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
        placeholder={`At least ${MIN_PASSWORD} characters`}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />

      <AuthError message={error} />

      <Button label="Create account" onPress={() => void submit()} busy={isSubmitting} />

      <AuthSwitch
        prompt="Already have an account?"
        action="Sign in"
        // back(), not push(): sign-in is the stack root, so pushing would put a
        // second copy of it behind this screen.
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/sign-in"))}
      />
    </AuthShell>
  );
}

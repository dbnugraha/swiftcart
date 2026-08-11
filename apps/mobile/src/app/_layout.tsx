import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AuthProvider, { useAuth } from "@/context/auth";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from "@/components/ErrorBoundary";

export default function RootLayout() {
  // GestureHandlerRootView must be outermost and have flex: 1 — every
  // react-native-gesture-handler gesture is silently dead without it.
  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </SafeAreaProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { user, isLoading } = useAuth();

  // Hold the splash until the stored session has resolved. Without this there
  // is a frame of the sign-in screen before SecureStore answers, which reads
  // as being logged out.
  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(shop)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

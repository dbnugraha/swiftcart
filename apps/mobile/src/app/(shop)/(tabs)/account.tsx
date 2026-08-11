import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Profile } from "@swiftcart/shared";

import { Button, Header, Loading, Screen, StateView, useTabBarInset } from "@/components/ui";
import { useAuth } from "@/context/auth";
import { useResource } from "@/hooks/use-resource";
import { colors, radii, shadows, spacing, typography } from "@/theme";

export default function AccountScreen() {
  const { signOut } = useAuth();
  const { data: profile, isLoading, error, retry } = useResource<Profile>("/me");
  const bottomInset = useTabBarInset();

  const confirmSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => void signOut(),
      },
    ]);
  };

  if (isLoading) {
    return (
      <Screen>
        <Header title="Account" />
        <Loading label="Loading your profile" />
      </Screen>
    );
  }

  if (error || !profile) {
    return (
      <Screen>
        <Header title="Account" />
        <StateView
          icon="alert-circle-outline"
          title="Couldn't load your profile"
          body={error ?? "Please try again."}
          action={<Button label="Retry" icon="refresh" onPress={retry} />}
        />
      </Screen>
    );
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <Screen>
      <Header title="Account" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, shadows.soft]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </Text>
          </View>
          <Text style={typography.sectionTitle}>{profile.name}</Text>
          <Text style={typography.bodyMuted}>{profile.email}</Text>
          <Text style={typography.caption}>Member since {memberSince}</Text>
        </View>

        {/* Menu Items */}
        <View style={[styles.menuCard, shadows.soft]}>
          <MenuItem
            icon="receipt-outline"
            label="My Orders"
            detail={`${profile.orderCount} ${profile.orderCount === 1 ? "order" : "orders"}`}
            onPress={() => router.push("/orders" as any)}
          />

          <View style={styles.separator} />

          <MenuItem
            icon="storefront-outline"
            label="Shop"
            detail="Browse products"
            onPress={() => router.push("/")}
          />
        </View>

        {/* App Info Card */}
        <View style={[styles.menuCard, shadows.soft]}>
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: `${colors.primary}14` }]}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.menuContent}>
              <Text style={typography.body}>Swiftcart Demo</Text>
              <Text style={typography.caption}>
                Inspired by SauceDemo · DummyJSON catalogue
              </Text>
            </View>
          </View>
        </View>

        {/* Sign Out */}
        <Button
          label="Sign out"
          icon="log-out-outline"
          variant="danger"
          onPress={confirmSignOut}
        />
      </ScrollView>
    </Screen>
  );
}

function MenuItem({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[styles.menuIcon, { backgroundColor: `${colors.primary}14` }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.menuContent}>
        <Text style={typography.body}>{label}</Text>
        {detail && <Text style={typography.caption}>{detail}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  profileCard: {
    alignItems: "center",
    padding: spacing.xl,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.surface,
  },
  menuCard: {
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  menuContent: { flex: 1 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.lg + 40 + spacing.md,
  },
  pressed: { opacity: 0.7 },
});

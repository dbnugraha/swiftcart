import Ionicons from "@expo/vector-icons/Ionicons";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import type { Product } from "@swiftcart/shared";

import DiscoverDeck from "@/components/DiscoverDeck";
import ProductCard from "@/components/ProductCard";
import SortSheet, { sortLabel } from "@/components/SortSheet";
import { useTabSwipeSuppressor } from "@/components/TabSwipe";
import { Button, Header, Loading, Screen, StateView, useTabBarInset } from "@/components/ui";
import { useCart } from "@/context/cart";
import { useToast } from "@/context/toast";
import { useCatalogue } from "@/hooks/use-catalogue";
import { useResource } from "@/hooks/use-resource";
import { colors, radii, spacing, typography } from "@/theme";

const COLUMNS = 2;
const GAP = spacing.md;
const PADDING = spacing.lg;

/** Two ways of looking at one catalogue, not two destinations. */
type Mode = "grid" | "discover";

export default function ShopScreen() {
  const catalogue = useCatalogue();
  const cart = useCart();
  const toast = useToast();
  const bottomInset = useTabBarInset();
  const { width } = useWindowDimensions();
  const [sortOpen, setSortOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("grid");
  const [deckLoaded, setDeckLoaded] = useState(false);

  const suppressTabSwipe = useTabSwipeSuppressor();

  const categories = useResource<{ categories: { name: string; count: number }[] }>(
    "/products/categories",
  );

  const columnWidth = (width - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  const onAdd = (product: Product) => {
    cart.add(product);
    toast.show(`${product.title} added`, "success");
  };

  const isDiscover = mode === "discover";

  return (
    <Screen>
      <Header
        title={isDiscover ? "Discover" : "Shop"}
        subtitle={
          isDiscover
            ? "Swipe right to add, left to skip"
            : catalogue.isLoading
              ? "Loading…"
              : `${catalogue.total} products available`
        }
        right={
          <ModeToggle
            mode={mode}
            onPress={() => {
              if (isDiscover) {
                setMode("grid");
                return;
              }
              setDeckLoaded(true);
              setMode("discover");
            }}
          />
        }
      />

      {/* Both panes stay mounted and are hidden rather than unmounted. The grid
          would otherwise lose its scroll position every time you glanced at the
          deck, and the deck would reshuffle out from under you. */}
      <View style={[styles.pane, isDiscover && styles.hidden]}>
        <View style={styles.controls}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={17} color={colors.textSecondary} />
            <TextInput
              style={styles.search}
              value={catalogue.filters.search}
              onChangeText={catalogue.setSearch}
              placeholder="Search products"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {catalogue.filters.search.length > 0 && (
              <Pressable
                onPress={() => catalogue.setSearch("")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={17} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={() => setSortOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Sort: ${sortLabel(catalogue.filters.sort)}`}
            style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}
          >
            <Ionicons name="swap-vertical" size={17} color={colors.text} />
          </Pressable>
        </View>

        {/* Scrolling the chips is a horizontal drag too, so it claims the drag
            outright — otherwise browsing 24 categories keeps changing tab. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipRow}
          {...suppressTabSwipe}
        >
          <Chip
            label="All"
            isOn={catalogue.filters.category === null}
            onPress={() => catalogue.setCategory(null)}
          />
          {(categories.data?.categories ?? []).map((category) => (
            <Chip
              key={category.name}
              label={`${category.name} (${category.count})`}
              isOn={catalogue.filters.category === category.name}
              onPress={() =>
                catalogue.setCategory(
                  catalogue.filters.category === category.name ? null : category.name,
                )
              }
            />
          ))}
        </ScrollView>

        {catalogue.isLoading ? (
          <Loading label="Fetching the catalogue" />
        ) : catalogue.error && catalogue.items.length === 0 ? (
          <StateView
            icon="cloud-offline-outline"
            title="Couldn't load products"
            body={catalogue.error}
            action={<Button label="Try again" onPress={catalogue.retry} icon="refresh" />}
          />
        ) : catalogue.items.length === 0 ? (
          <StateView
            icon="search-outline"
            title="Nothing matches"
            body={
              catalogue.filters.search
                ? `No products for "${catalogue.filters.search}".`
                : "No products in this category."
            }
            action={
              <Button
                label="Clear filters"
                variant="secondary"
                onPress={() => {
                  catalogue.setSearch("");
                  catalogue.setCategory(null);
                }}
              />
            }
          />
        ) : (
          <FlashList
            data={catalogue.items}
            numColumns={COLUMNS}
            keyExtractor={(product) => product.id}
            extraData={cart.cart.itemCount}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={catalogue.isRefreshing}
                onRefresh={catalogue.refresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            renderItem={({ item }) => (
              <View style={styles.cell}>
                <ProductCard
                  product={item}
                  width={columnWidth}
                  inCart={cart.quantityOf(item.id)}
                  onPress={() => router.push(`/product/${item.id}`)}
                  onAdd={() => onAdd(item)}
                />
              </View>
            )}
            onEndReached={catalogue.loadMore}
            onEndReachedThreshold={0.6}
            ListFooterComponent={
              <View style={[styles.footer, { paddingBottom: bottomInset }]}>
                {catalogue.isLoadingMore && <ActivityIndicator color={colors.primary} />}
                {!catalogue.hasMore && catalogue.items.length > 0 && (
                  <Text style={typography.caption}>That&apos;s everything</Text>
                )}
              </View>
            }
          />
        )}
      </View>

      {/* Mounted on first use rather than with the screen, so opening the app
          does not fetch a deck nobody asked for. */}
      {deckLoaded && (
        <View style={[styles.pane, !isDiscover && styles.hidden]}>
          <DiscoverDeck />
        </View>
      )}

      <SortSheet
        visible={sortOpen}
        value={catalogue.filters.sort}
        onChange={catalogue.setSort}
        onClose={() => setSortOpen(false)}
      />
    </Screen>
  );
}

/**
 * Switches the shop between the grid and the deck. Labelled rather than a bare
 * icon: "sparkles" alone does not tell anyone what it does, and this is the
 * only way into Discover now that it has no tab of its own.
 */
function ModeToggle({ mode, onPress }: { mode: Mode; onPress: () => void }) {
  const isDiscover = mode === "discover";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isDiscover }}
      accessibilityLabel={isDiscover ? "Back to the product grid" : "Open Discover"}
      style={({ pressed }) => [
        styles.mode,
        isDiscover && styles.modeOn,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={isDiscover ? "grid-outline" : "sparkles"}
        size={15}
        color={isDiscover ? colors.surface : colors.primary}
      />
      <Text style={[styles.modeLabel, isDiscover && styles.modeLabelOn]}>
        {isDiscover ? "Grid" : "Discover"}
      </Text>
    </Pressable>
  );
}

function Chip({
  label,
  isOn,
  onPress,
}: {
  label: string;
  isOn: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isOn }}
      style={({ pressed }) => [styles.chip, isOn && styles.chipOn, pressed && styles.pressed]}
    >
      <Text style={[styles.chipLabel, isOn && styles.chipLabelOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1 },
  // display:none rather than unmounting: Yoga drops it from layout entirely, so
  // the visible pane still fills the screen, but React keeps the subtree alive.
  hidden: { display: "none" },
  mode: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeLabel: { ...typography.caption, fontWeight: "700", color: colors.primary },
  modeLabelOn: { color: colors.surface },
  controls: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: PADDING,
    paddingBottom: spacing.md,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  search: { flex: 1, ...typography.body },
  sortButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipRow: { flexGrow: 0, marginBottom: spacing.md },
  chips: { gap: spacing.sm, paddingHorizontal: PADDING },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { ...typography.caption, fontWeight: "600", textTransform: "capitalize" },
  chipLabelOn: { color: colors.surface },
  list: { paddingHorizontal: PADDING - GAP / 2 },
  cell: { paddingHorizontal: GAP / 2, paddingBottom: GAP },
  footer: { alignItems: "center", paddingTop: spacing.md, gap: spacing.sm },
  pressed: { opacity: 0.8 },
});

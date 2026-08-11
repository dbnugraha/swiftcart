import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import type { Product } from "@swiftcart/shared";

import SwipeDeck from "@/components/SwipeDeck";
import { Button, Header, Loading, Screen, StateView, useTabBarInset } from "@/components/ui";
import { useCart } from "@/context/cart";
import { useToast } from "@/context/toast";
import { api, errorMessage } from "@/lib/api";

type FetchResult = { round: number; products: Product[]; error: string | null };

export default function DiscoverScreen() {
  const [result, setResult] = useState<FetchResult | null>(null);
  const [round, setRound] = useState(0);

  const cart = useCart();
  const toast = useToast();
  const bottomInset = useTabBarInset();

  // Loading and error are derived — no synchronous setState inside the effect.
  const isLoading = result === null || result.round !== round;
  const products = result?.round === round ? result.products : [];
  const error = result?.round === round ? result.error : null;

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const currentRound = round;

    api
      .get<{ items: Product[] }>("/products/random?count=15", { signal })
      .then((payload) => {
        if (!signal.aborted)
          setResult({ round: currentRound, products: payload.items, error: null });
      })
      .catch((cause) => {
        if (!signal.aborted)
          setResult({ round: currentRound, products: [], error: errorMessage(cause) });
      });

    return () => controller.abort();
  }, [round]);

  const onWant = (product: Product) => {
    cart.add(product);
    toast.show(`${product.title} added to cart`, "success");
  };

  return (
    <Screen>
      <Header title="Discover" subtitle="Swipe right to add, left to skip" />

      <View style={{ flex: 1, paddingBottom: bottomInset }}>
        {isLoading ? (
          <Loading label="Finding things you might like" />
        ) : error ? (
          <StateView
            icon="cloud-offline-outline"
            title="Couldn't load suggestions"
            body={error}
            action={
              <Button label="Try again" icon="refresh" onPress={() => setRound((r) => r + 1)} />
            }
          />
        ) : (
          <SwipeDeck
            // Remounting on each round resets the deck cursor; without this a
            // reshuffle would land straight back on the exhausted state.
            key={round}
            products={products}
            onWant={onWant}
            onOpen={(product) => router.push(`/product/${product.id}`)}
            onExhausted={() => setRound((r) => r + 1)}
          />
        )}
      </View>
    </Screen>
  );
}

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { calculateTotals, type Cart, type CartLine, type Product } from "@swiftcart/shared";

import { useToast } from "@/context/toast";
import { api, errorMessage } from "@/lib/api";

/**
 * The cart: local state is the user's intent, the server is told to match.
 *
 * Rapid taps on a quantity stepper are the whole difficulty here, and there are
 * two distinct ways to get them wrong. This file has had both.
 *
 * 1. **A stale payload.** Capturing the target when the button is tapped means
 *    three fast taps from 1 all send "set to 2". Fixed by reading the target at
 *    SEND time instead.
 *
 * 2. **A stale response.** Far subtler: with several requests queued, the first
 *    response carries quantity 2 while the user has already tapped up to 4.
 *    Applying it clobbers the newer intent and the number visibly rebounds.
 *
 * So the model is a per-product **sync loop**. Local state moves freely; one
 * loop per product drives the server toward whatever the local value currently
 * is, re-sending if the user moved again mid-flight, and a response is only
 * adopted once it is known not to be stale. Because `PATCH /cart/items/:id` is
 * an absolute upsert, re-sending is always safe and intermediate taps collapse
 * into a single request.
 */

const EMPTY_CART: Cart = {
  lines: [],
  itemCount: 0,
  ...calculateTotals(0),
};

const CartContext = createContext<{
  cart: Cart;
  isLoading: boolean;
  /** Quantity of one product, 0 when absent — drives every "in cart" badge. */
  quantityOf: (productId: string) => number;
  add: (product: Product, quantity?: number) => void;
  /** Nudge a line by a delta; the loop resolves the absolute target itself. */
  changeQuantity: (productId: string, delta: number) => void;
  remove: (productId: string) => void;
  clear: () => Promise<void>;
  reload: () => Promise<void>;
} | null>(null);

/**
 * Recomputes the whole cart from its lines so an optimistic edit shows correct
 * totals — not just a changed number with a stale total underneath.
 */
function recalculate(lines: CartLine[]): Cart {
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  return {
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    ...calculateTotals(subtotal),
  };
}

const quantityIn = (cart: Cart, productId: string) =>
  cart.lines.find((line) => line.productId === productId)?.quantity ?? 0;

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  // Synchronous mirror of `cart`. The sync loops read this, never state —
  // scheduled state can be several taps behind.
  const cartRef = useRef<Cart>(EMPTY_CART);

  // Products with a running sync loop. While non-empty, no server response may
  // be adopted wholesale: it could be older than the local intent.
  const syncing = useRef(new Set<string>());
  // Set when a response had to be discarded, so we true up once things settle.
  const staleResponse = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /** The only way the cart changes. Keeps ref and state in lockstep. */
  const applyCart = useCallback((next: Cart | ((current: Cart) => Cart)) => {
    const resolved = typeof next === "function" ? next(cartRef.current) : next;
    cartRef.current = resolved;
    if (isMounted.current) setCart(resolved);
  }, []);

  const reload = useCallback(async () => {
    const next = await api.get<Cart>("/cart");
    applyCart(next);
  }, [applyCart]);

  useEffect(() => {
    // The provider only mounts inside the signed-in area, so mounting is the
    // signal to load.
    reload()
      .catch(() => undefined)
      .finally(() => {
        if (isMounted.current) setIsLoading(false);
      });
    // Mount-only: `reload` is stable and re-running would refetch for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Drives the server toward this product's local quantity, and keeps going
   * until the two agree. Only one loop runs per product; a tap arriving while
   * one is in flight is picked up by the loop itself rather than queuing
   * another request.
   */
  const syncProduct = useCallback(
    async (productId: string) => {
      if (syncing.current.has(productId)) return;
      syncing.current.add(productId);

      try {
        for (;;) {
          const target = quantityIn(cartRef.current, productId);

          const server = await api.patch<Cart>(`/cart/items/${productId}`, {
            quantity: target,
          });

          // Did the user move again while that was in flight? If so this
          // response is already out of date — send the new target instead of
          // adopting it.
          if (quantityIn(cartRef.current, productId) !== target) continue;

          syncing.current.delete(productId);

          if (syncing.current.size === 0) {
            // Nothing else is optimistic, so the server's view is current.
            applyCart(server);
            staleResponse.current = false;
          } else {
            // Another product is still in flight; adopting this whole-cart
            // response would clobber its optimistic line.
            staleResponse.current = true;
          }
          return;
        }
      } catch (error) {
        syncing.current.delete(productId);
        if (!isMounted.current) return;

        toast.show(errorMessage(error), "error");
        // Reload rather than restoring a snapshot: a whole-cart snapshot would
        // also revert concurrent edits to a different line.
        await reload().catch(() => undefined);
        staleResponse.current = false;
      } finally {
        syncing.current.delete(productId);

        if (syncing.current.size === 0 && staleResponse.current) {
          staleResponse.current = false;
          await reload().catch(() => undefined);
        }
      }
    },
    [applyCart, reload, toast],
  );

  /** Moves the local quantity, then lets the loop chase it. */
  const setLocalQuantity = useCallback(
    (productId: string, resolve: (current: number) => number, product?: Product) => {
      applyCart((current) => {
        const existing = current.lines.find((line) => line.productId === productId);
        const next = Math.max(0, resolve(existing?.quantity ?? 0));

        if (next === 0) {
          return recalculate(current.lines.filter((line) => line.productId !== productId));
        }

        if (existing) {
          return recalculate(
            current.lines.map((line) =>
              line.productId === productId
                ? { ...line, quantity: next, lineTotal: line.product.salePrice * next }
                : line,
            ),
          );
        }

        // Adding something not in the cart yet needs the product to render a
        // line at all; callers that can't supply it are changing an existing
        // line, so this is unreachable for them.
        if (!product) return current;

        return recalculate([
          ...current.lines,
          {
            productId,
            quantity: next,
            product,
            lineTotal: product.salePrice * next,
          },
        ]);
      });

      void syncProduct(productId);
    },
    [applyCart, syncProduct],
  );

  const add = useCallback(
    (product: Product, quantity = 1) => {
      setLocalQuantity(product.id, (current) => current + quantity, product);
    },
    [setLocalQuantity],
  );

  const changeQuantity = useCallback(
    (productId: string, delta: number) => {
      setLocalQuantity(productId, (current) => current + delta);
    },
    [setLocalQuantity],
  );

  const remove = useCallback(
    (productId: string) => {
      setLocalQuantity(productId, () => 0);
    },
    [setLocalQuantity],
  );

  const clear = useCallback(async () => {
    const snapshot = cartRef.current;
    applyCart(EMPTY_CART);

    try {
      applyCart(await api.del<Cart>("/cart"));
    } catch (error) {
      applyCart(snapshot);
      toast.show(errorMessage(error), "error");
    }
  }, [applyCart, toast]);

  const quantities = useMemo(
    () => new Map(cart.lines.map((line) => [line.productId, line.quantity])),
    [cart.lines],
  );

  return (
    <CartContext
      value={{
        cart,
        isLoading,
        quantityOf: (productId) => quantities.get(productId) ?? 0,
        add,
        changeQuantity,
        remove,
        clear,
        reload,
      }}
    >
      {children}
    </CartContext>
  );
}

export function useCart() {
  const ctx = use(CartContext);
  if (!ctx) throw new Error("useCart unavailable");
  return ctx;
}

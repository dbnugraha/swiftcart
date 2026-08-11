import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { calculateTotals, type Cart, type CartLine, type Product } from "@swiftcart/shared";

import { useToast } from "@/context/toast";
import { api, errorMessage } from "@/lib/api";

/**
 * The cart, backed by the API but applied optimistically.
 *
 * Three rules keep that honest:
 *
 * 1. **Writes are serialised per product.** Tapping "+" three times quickly
 *    produces three requests for the same line; unserialised they can land out
 *    of order and leave a quantity nobody asked for. Chaining per product —
 *    not globally — keeps unrelated lines parallel.
 *
 * 2. **The request payload is read at SEND time, never at tap time.** This is
 *    the bug this file used to have: `setQuantity` took an absolute target
 *    computed from the quantity that happened to be on screen, and the request
 *    closure captured it. Two fast taps from 1 both sent "set to 2" — the UI
 *    reached 3, then each response dragged it back down. Now the task reads the
 *    current optimistic quantity when it actually sends, which IS the user's
 *    intent, and an absolute PATCH makes that naturally idempotent.
 *
 * 3. **`cartRef` is the synchronous source of truth**, mirrored into state for
 *    rendering. React state updates are scheduled, so a queued task reading
 *    state could see a value two taps stale.
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
  /** Nudge a line by a delta. Prefer this over absolute sets — see rule 2. */
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

  // Synchronous mirror of `cart`. Queued tasks read this, never state.
  const cartRef = useRef<Cart>(EMPTY_CART);

  // One promise chain per product id, and the last quantity actually sent for
  // it. Refs, not state — sequencing handles that are never rendered.
  const queues = useRef(new Map<string, Promise<void>>());
  const lastSent = useRef(new Map<string, number>());
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
    // The server is authoritative, so anything we thought was in flight is moot.
    lastSent.current.clear();
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
   * Runs `task` after any in-flight write for the same product. Never rejects —
   * each task handles its own failure, and an unhandled rejection here would be
   * a redbox in development.
   */
  const enqueue = useCallback((productId: string, task: () => Promise<void>) => {
    const previous = queues.current.get(productId) ?? Promise.resolve();
    const next = previous.then(task, task).catch(() => undefined);

    queues.current.set(productId, next);

    void next.then(() => {
      // Only clear if nothing queued behind us in the meantime.
      if (queues.current.get(productId) === next) queues.current.delete(productId);
    });
  }, []);

  /**
   * Applies an optimistic change, then reconciles.
   *
   * On failure it RELOADS rather than restoring a snapshot: a whole-cart
   * snapshot would also revert concurrent edits to a different line.
   */
  const mutate = useCallback(
    (
      productId: string,
      optimistic: (current: Cart) => Cart,
      request: () => Promise<Cart | null>,
    ) => {
      applyCart(optimistic);

      enqueue(productId, async () => {
        try {
          const authoritative = await request();
          if (authoritative) applyCart(authoritative);
        } catch (error) {
          if (!isMounted.current) return;
          // Let the next attempt through rather than suppressing it as a repeat.
          lastSent.current.delete(productId);
          toast.show(errorMessage(error), "error");
          await reload().catch(() => undefined);
        }
      });
    },
    [applyCart, enqueue, reload, toast],
  );

  const add = useCallback(
    (product: Product, quantity = 1) => {
      mutate(
        product.id,
        (current) => {
          const existing = current.lines.find((line) => line.productId === product.id);

          const lines = existing
            ? current.lines.map((line) =>
                line.productId === product.id
                  ? {
                      ...line,
                      quantity: line.quantity + quantity,
                      lineTotal: product.salePrice * (line.quantity + quantity),
                    }
                  : line,
              )
            : [
                ...current.lines,
                {
                  productId: product.id,
                  quantity,
                  product,
                  lineTotal: product.salePrice * quantity,
                },
              ];

          return recalculate(lines);
        },
        // POST is a delta the server applies itself, so rapid adds accumulate
        // correctly without any of the coalescing below.
        () => api.post<Cart>("/cart/items", { productId: product.id, quantity }),
      );
    },
    [mutate],
  );

  const changeQuantity = useCallback(
    (productId: string, delta: number) => {
      mutate(
        productId,
        (current) => {
          const next = Math.max(0, quantityIn(current, productId) + delta);

          return recalculate(
            next === 0
              ? current.lines.filter((line) => line.productId !== productId)
              : current.lines.map((line) =>
                  line.productId === productId
                    ? { ...line, quantity: next, lineTotal: line.product.salePrice * next }
                    : line,
                ),
          );
        },
        async () => {
          // Read the target HERE, not at tap time. Several taps queued together
          // all resolve to the same end state, so the first send carries it and
          // the rest are skipped as no-ops.
          const target = quantityIn(cartRef.current, productId);

          if (lastSent.current.get(productId) === target) return null;
          lastSent.current.set(productId, target);

          return target === 0
            ? api.del<Cart>(`/cart/items/${productId}`)
            : api.patch<Cart>(`/cart/items/${productId}`, { quantity: target });
        },
      );
    },
    [mutate],
  );

  const remove = useCallback(
    (productId: string) => {
      mutate(
        productId,
        (current) =>
          recalculate(current.lines.filter((line) => line.productId !== productId)),
        async () => {
          lastSent.current.set(productId, 0);
          return api.del<Cart>(`/cart/items/${productId}`);
        },
      );
    },
    [mutate],
  );

  const clear = useCallback(async () => {
    const snapshot = cartRef.current;
    applyCart(EMPTY_CART);
    lastSent.current.clear();

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

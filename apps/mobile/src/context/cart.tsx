import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { calculateTotals, type Cart, type Product } from "@swiftcart/shared";

import { useToast } from "@/context/toast";
import { api, errorMessage } from "@/lib/api";

/**
 * The cart, backed by the API but applied optimistically.
 *
 * Every mutation takes effect on screen immediately and rolls back with a
 * toast if the server disagrees. Two rules keep that honest:
 *
 * 1. **Writes are serialised per product.** Tapping "+" three times quickly
 *    produces three requests for the same line; unserialised they can land out
 *    of order and leave a quantity nobody asked for. Chaining per product —
 *    not globally — keeps unrelated lines parallel.
 * 2. **The server's cart is the truth.** Every response replaces local state
 *    wholesale, so prices, totals and stock limits reconcile on their own
 *    rather than being recomputed in two places that can drift.
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
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => Promise<void>;
  reload: () => Promise<void>;
} | null>(null);

/**
 * Recomputes the whole cart from its lines so an optimistic edit shows correct
 * totals — not just a changed number with a stale total underneath.
 */
function recalculate(lines: Cart["lines"]): Cart {
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  return {
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    ...calculateTotals(subtotal),
  };
}

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  // One promise chain per product id. A ref, not state — these are sequencing
  // handles and are never rendered.
  const queues = useRef(new Map<string, Promise<void>>());
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const next = await api.get<Cart>("/cart");
    if (isMounted.current) setCart(next);
  }, []);

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
   * each task handles its own failure, and an unhandled rejection here would
   * be a redbox in development.
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

  /** Applies an optimistic change, then reconciles or rolls back. */
  const mutate = useCallback(
    (
      productId: string,
      optimistic: (current: Cart) => Cart,
      request: () => Promise<Cart>,
    ) => {
      let snapshot: Cart | null = null;

      setCart((current) => {
        snapshot = current;
        return optimistic(current);
      });

      enqueue(productId, async () => {
        try {
          const authoritative = await request();
          if (isMounted.current) setCart(authoritative);
        } catch (error) {
          if (!isMounted.current) return;
          // Restore exactly what was on screen before, then say why.
          if (snapshot) setCart(snapshot);
          toast.show(errorMessage(error), "error");
        }
      });
    },
    [enqueue, toast],
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
        () => api.post<Cart>("/cart/items", { productId: product.id, quantity }),
      );
    },
    [mutate],
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      mutate(
        productId,
        (current) =>
          recalculate(
            quantity === 0
              ? current.lines.filter((line) => line.productId !== productId)
              : current.lines.map((line) =>
                  line.productId === productId
                    ? {
                        ...line,
                        quantity,
                        lineTotal: line.product.salePrice * quantity,
                      }
                    : line,
                ),
          ),
        () => api.patch<Cart>(`/cart/items/${productId}`, { quantity }),
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
        () => api.del<Cart>(`/cart/items/${productId}`),
      );
    },
    [mutate],
  );

  const clear = useCallback(async () => {
    const snapshot = cart;
    setCart(EMPTY_CART);

    try {
      setCart(await api.del<Cart>("/cart"));
    } catch (error) {
      setCart(snapshot);
      toast.show(errorMessage(error), "error");
    }
  }, [cart, toast]);

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
        setQuantity,
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

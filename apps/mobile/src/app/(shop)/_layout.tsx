import { Stack } from "expo-router";

import CartProvider from "@/context/cart";
import ConfirmProvider from "@/context/confirm";
import ToastProvider from "@/context/toast";
import { colors } from "@/theme";

export default function ShopLayout() {
  // Toast wraps Cart, not the other way round: a failed cart write rolls back
  // and reports itself with a toast, so the cart provider has to be able to
  // call useToast(). Confirm goes innermost — only screens ask questions.
  return (
    <ToastProvider>
      <CartProvider>
        <ConfirmProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </ConfirmProvider>
      </CartProvider>
    </ToastProvider>
  );
}

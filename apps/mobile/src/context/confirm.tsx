import { createContext, use, useCallback, useEffect, useRef, useState } from "react";

import ConfirmDialog, { type ConfirmRequest } from "@/components/ConfirmDialog";

/**
 * Confirmation as a promise, so a call site reads the way `Alert.alert` never
 * did — top to bottom, with the answer where the question was asked:
 *
 * ```ts
 * if (await confirm({ title: "Empty your cart?", confirmLabel: "Empty cart" })) {
 *   await clear();
 * }
 * ```
 *
 * One dialog exists for the whole app rather than one per screen, so two
 * screens can never stack their own on top of each other.
 */

const ConfirmContext = createContext<((request: ConfirmRequest) => Promise<boolean>) | null>(
  null,
);

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [visible, setVisible] = useState(false);

  // Held outside state: resolving is a side effect, and the resolver must
  // survive the re-render that shows the dialog.
  const pending = useRef<((confirmed: boolean) => void) | null>(null);

  useEffect(
    // An unmount with a question still on screen answers it "no". Leaving the
    // promise unresolved would hang whatever awaited it, forever and silently.
    () => () => {
      pending.current?.(false);
      pending.current = null;
    },
    [],
  );

  const confirm = useCallback((next: ConfirmRequest) => {
    // A second question while one is open cancels the first rather than
    // replacing it silently — its caller is still waiting on an answer.
    pending.current?.(false);

    return new Promise<boolean>((resolve) => {
      pending.current = resolve;
      setRequest(next);
      setVisible(true);
    });
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    // `request` deliberately stays put: the dialog needs its content while it
    // fades out.
    setVisible(false);
    resolve?.(confirmed);
  }, []);

  return (
    <ConfirmContext value={confirm}>
      {children}
      <ConfirmDialog
        request={request}
        visible={visible}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext>
  );
}

export function useConfirm() {
  const ctx = use(ConfirmContext);
  if (!ctx) throw new Error("useConfirm unavailable");
  return ctx;
}

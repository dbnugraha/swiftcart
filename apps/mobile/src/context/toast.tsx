import { createContext, use, useRef, useState } from "react";

import Toast, { type ToastMessage, type ToastTone } from "@/components/Toast";

const ToastContext = createContext<{
  show: (text: string, tone?: ToastTone) => void;
  message: ToastMessage | null;
} | null>(null);

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const nextId = useRef(0);

  return (
    <ToastContext
      value={{
        message,
        show: (text, tone = "info") => {
          // Id bumps on every show so repeating the same text re-triggers the
          // animation instead of looking frozen.
          nextId.current += 1;
          setMessage({ id: nextId.current, text, tone });
        },
      }}
    >
      {children}
      <ToastHost />
    </ToastContext>
  );
}

/**
 * Renders the active toast. Mounted by the provider, and again inside any RN
 * `Modal` — modals render into a separate native window, so a toast fired from
 * one would otherwise update state and be invisible.
 */
export function ToastHost() {
  const ctx = use(ToastContext);
  return <Toast message={ctx?.message ?? null} />;
}

export function useToast() {
  const ctx = use(ToastContext);
  if (!ctx) throw new Error("useToast unavailable");
  return ctx;
}

import { createContext, use, useCallback, useEffect, useState } from "react";

import type { PublicUser, Session } from "@swiftcart/shared";

import { api, setSessionExpiredHandler } from "@/lib/api";
import {
  clearSession,
  getRefreshToken,
  persistSession,
  restoreSession,
} from "@/lib/token-store";

const AuthContext = createContext<{
  user: PublicUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
} | null>(null);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession()
      .then((session) => setUser(session?.user ?? null))
      // A keychain failure must not wedge the app on the splash screen.
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  // The api client clears storage itself when a refresh is rejected; this only
  // mirrors that into React state so the root guard reacts.
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    return () => setSessionExpiredHandler(null);
  }, []);

  const adopt = useCallback(async (session: Session) => {
    await persistSession(session.user, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    // State last: the root guard navigates the moment this lands, and must not
    // do so before the tokens are readable by the api client.
    setUser(session.user);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await adopt(
        await api.post<Session>("/auth/sign-in", { email, password }, { auth: false }),
      );
    },
    [adopt],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      await adopt(
        await api.post<Session>(
          "/auth/sign-up",
          { name, email, password },
          { auth: false },
        ),
      );
    },
    [adopt],
  );

  const signOut = useCallback(async () => {
    // Best-effort server-side revocation. Offline, the local session still has
    // to go, so this never rejects.
    await api
      .post("/auth/sign-out", { refreshToken: getRefreshToken() })
      .catch(() => undefined);

    await clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth unavailable");
  return ctx;
}
